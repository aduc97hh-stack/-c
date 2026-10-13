begin;
create function private.schedule_lock() returns void language sql security definer set search_path='' as $$select pg_advisory_xact_lock(7343001)$$;
create function private.schedule_conflict(p_class uuid,p_teacher uuid,p_start timestamptz,p_end timestamptz,p_ignore uuid default null) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.class_sessions s where s.status<>'cancelled' and s.id is distinct from p_ignore and (s.class_id=p_class or s.teacher_id=p_teacher) and s.starts_at<p_end and s.ends_at>p_start)$$;
create or replace function public.create_class_session(p_class uuid,p_teacher uuid,p_start timestamptz,p_end timestamptz,p_title text) returns uuid language plpgsql security definer set search_path='' as $$declare result uuid;begin
 if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;
 perform private.schedule_lock();
 if not exists(select 1 from public.classes where id=p_class and active) or not exists(select 1 from public.teacher_class_assignments a join public.profiles p on p.id=a.teacher_id where a.class_id=p_class and a.teacher_id=p_teacher and p.active and p.role='teacher') then raise exception 'Invalid assignment';end if;
 if private.schedule_conflict(p_class,p_teacher,p_start,p_end) then raise exception 'Schedule conflict' using errcode='23P01';end if;
 insert into public.class_sessions(class_id,teacher_id,starts_at,ends_at,lesson_title,created_by,updated_by) values(p_class,p_teacher,p_start,p_end,p_title,auth.uid(),auth.uid()) returning id into result;return result;
end $$;
create function public.save_schedule(p_class uuid,p_teacher uuid,p_from date,p_until date,p_weekdays int[],p_start time,p_end time,p_replace uuid default null,p_version int default null) returns uuid language plpgsql security definer set search_path='' as $$declare old public.class_schedule_templates;result uuid;day int;begin
 if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;
 perform private.schedule_lock();
 if p_from<(now() at time zone 'Asia/Bangkok')::date or cardinality(p_weekdays) not between 1 and 7 or p_weekdays is null or (select count(distinct d) from unnest(p_weekdays) d)<>cardinality(p_weekdays) or not exists(select 1 from public.teacher_class_assignments a join public.profiles p on p.id=a.teacher_id join public.classes c on c.id=a.class_id where a.class_id=p_class and a.teacher_id=p_teacher and p.active and p.role='teacher' and c.active) then raise exception 'Invalid schedule';end if;
 if (select pilot_mode from public.pilot_config) and private.in_pilot(p_teacher,p_class) is not true then raise exception 'Class outside pilot' using errcode='42501';end if;
 if p_replace is not null then
  select * into old from public.class_schedule_templates where id=p_replace for update;
  if not found or not old.active or p_from>old.ends_on or old.class_id<>p_class or p_version is null or old.version<>p_version then raise exception 'Schedule stale' using errcode='40001';end if;
  update public.class_schedule_templates set active=false,version=version+1 where id=old.id;
  update public.class_sessions set status='cancelled',updated_by=auth.uid(),updated_at=now() where template_id=old.id and status='scheduled' and starts_at>=(p_from::timestamp at time zone 'Asia/Bangkok');
 end if;
 insert into public.class_schedule_templates(class_id,teacher_id,starts_on,ends_on,created_by) values(p_class,p_teacher,p_from,p_until,auth.uid()) returning id into result;
 foreach day in array p_weekdays loop insert into public.schedule_rules(template_id,weekday,starts_local,ends_local) values(result,day,p_start,p_end);end loop;
 perform private.audit('schedule_saved','schedule',result,jsonb_build_object('class_id',p_class,'teacher_id',p_teacher,'from',p_from,'replaces',p_replace));return result;
end $$;
create function private.generate_schedule(p_template uuid,p_from date,p_until date) returns jsonb language plpgsql security definer set search_path='' as $$declare t public.class_schedule_templates;r public.schedule_rules;day date;st timestamptz;en timestamptz;existing public.class_sessions;n int:=0;conflicts jsonb:='[]';begin
 perform private.schedule_lock();select * into t from public.class_schedule_templates where id=p_template for update;
 if not found or not t.active then return jsonb_build_object('generated',0,'conflicts',conflicts);end if;
 if p_from is null or p_until is null or p_until<p_from or p_until-p_from>56 then raise exception 'Generation window max56 days';end if;
 if not exists(select 1 from public.teacher_class_assignments a join public.profiles p on p.id=a.teacher_id join public.classes c on c.id=a.class_id where a.teacher_id=t.teacher_id and a.class_id=t.class_id and p.active and p.role='teacher' and c.active) then return jsonb_build_object('generated',0,'conflicts',jsonb_build_array('Owner/class assignment invalid'));end if;
 for day in select d::date from generate_series(greatest(p_from,t.starts_on)::timestamp,least(p_until,t.ends_on)::timestamp,interval '1 day') d loop
  select * into r from public.schedule_rules where template_id=t.id and weekday=extract(dow from day)::int;
  if not found then continue;end if;
  st:=(day+r.starts_local) at time zone 'Asia/Bangkok';en:=(day+r.ends_local) at time zone 'Asia/Bangkok';
  if st<now() then continue;end if;
  select * into existing from public.class_sessions where class_id=t.class_id and starts_at=st for update;
  if found then
   if existing.status<>'cancelled' then
    if existing.template_id is distinct from t.id and existing.exception_reason='' then conflicts:=conflicts||jsonb_build_array(day::text);end if;
    continue;
   end if;
   if existing.template_id=t.id or existing.exception_reason<>'' then continue;end if;
  end if;
  if private.schedule_conflict(t.class_id,t.teacher_id,st,en,existing.id) then conflicts:=conflicts||jsonb_build_array(day::text);continue;end if;
  if existing.id is not null then update public.class_sessions set teacher_id=t.teacher_id,ends_at=en,status='scheduled',template_id=t.id,updated_by=auth.uid(),updated_at=now(),version=version+1 where id=existing.id;
  else insert into public.class_sessions(class_id,teacher_id,starts_at,ends_at,lesson_title,template_id,created_by,updated_by) values(t.class_id,t.teacher_id,st,en,'Buổi học theo lịch',t.id,coalesce(auth.uid(),t.created_by),auth.uid());end if;
  n:=n+1;
 end loop;
 return jsonb_build_object('generated',n,'conflicts',conflicts);
end $$;
create function public.generate_schedule(p_template uuid,p_from date,p_until date) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;
 if (select pilot_mode from public.pilot_config) and not exists(select 1 from public.class_schedule_templates t where t.id=p_template and private.in_pilot(t.teacher_id,t.class_id)) then raise exception 'Class outside pilot' using errcode='42501';end if;
 return private.generate_schedule(p_template,p_from,p_until);
end $$;
create function public.session_exception(p_session uuid,p_version int,p_cancel boolean,p_teacher uuid default null,p_reason text default '') returns void language plpgsql security definer set search_path='' as $$declare s public.class_sessions;begin
 if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;
 perform private.schedule_lock();select * into s from public.class_sessions where id=p_session for update;
 if not found or s.status<>'scheduled' or p_cancel is null or p_version is null or p_version<>s.version then raise exception 'Scheduled session required';end if;
 if length(trim(p_reason))<5 then raise exception 'Reason required';end if;
 if not p_cancel then
  if not exists(select 1 from public.teacher_class_assignments a join public.profiles p on p.id=a.teacher_id where a.class_id=s.class_id and a.teacher_id=p_teacher and p.active and p.role='teacher') or private.schedule_conflict(s.class_id,p_teacher,s.starts_at,s.ends_at,s.id) then raise exception 'Teacher assignment/conflict invalid';end if;
 end if;
 update public.class_sessions set status=case when p_cancel then 'cancelled'::public.session_status else status end,teacher_id=case when p_cancel then teacher_id else p_teacher end,exception_reason=p_reason,version=version+1,updated_at=now(),updated_by=auth.uid() where id=s.id;
end $$;
create function public.mark_notification(p_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if private.current_role() is null then raise exception 'Forbidden' using errcode='42501';end if;
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_id and user_id=auth.uid();if not found then raise exception 'Forbidden' using errcode='42501';end if;
end $$;
create function public.configure_pilot(p_mode boolean,p_teacher uuid,p_class uuid,p_enable boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if private.current_role() is distinct from 'admin' or p_mode is null or p_enable is null then raise exception 'Forbidden' using errcode='42501';end if;
 if p_enable then
  if not exists(select 1 from public.teacher_class_assignments a join public.profiles p on p.id=a.teacher_id where a.teacher_id=p_teacher and a.class_id=p_class and p.active and p.role='teacher') then raise exception 'Invalid assignment';end if;
  insert into public.pilot_assignments values(p_teacher,p_class) on conflict do nothing;
 else delete from public.pilot_assignments where teacher_id=p_teacher and class_id=p_class;end if;
 update public.pilot_config set pilot_mode=p_mode;
 perform private.audit('pilot_configured','class',p_class,jsonb_build_object('pilot_mode',p_mode,'teacher_id',p_teacher,'enabled',p_enable));
end $$;
create function public.open_pilot_checkout(p_session uuid,p_device text) returns uuid language plpgsql security definer set search_path='' as $$declare s public.class_sessions;attempt uuid;begin
 select * into s from public.class_sessions where id=p_session for update;
 if not found or private.current_role() is distinct from 'teacher' or s.teacher_id<>auth.uid() or private.can_class(s.class_id) is not true then raise exception 'Forbidden' using errcode='42501';end if;
 if s.status<>'in_progress' or private.in_pilot(auth.uid(),s.class_id) is not true then return null;end if;
 select attempt_id into attempt from public.pilot_events where session_id=s.id and user_id=auth.uid() and event_type='checkout_opened';if found then return attempt;end if;
 attempt:=gen_random_uuid();insert into public.pilot_events(attempt_id,session_id,user_id,event_type,student_count,exception_count,device_category) values(attempt,s.id,auth.uid(),'checkout_opened',(select count(*) from public.session_student_records where session_id=s.id),0,p_device);return attempt;
end $$;
create function public.record_pilot_error(p_attempt uuid,p_error uuid) returns void language plpgsql security definer set search_path='' as $$declare e public.pilot_events;begin
 if private.current_role() is distinct from 'teacher' then raise exception 'Forbidden' using errcode='42501';end if;
 select * into e from public.pilot_events where attempt_id=p_attempt and user_id=auth.uid() and event_type='checkout_opened';
 if not found or private.can_edit_session(e.session_id) is not true or p_error is null then raise exception 'Forbidden' using errcode='42501';end if;
 insert into public.pilot_events(attempt_id,session_id,user_id,event_type,student_count,exception_count,device_category,error_key) values(e.attempt_id,e.session_id,e.user_id,'save_error',e.student_count,0,e.device_category,p_error) on conflict do nothing;
end $$;
create function public.operations_configuration() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;return (select to_jsonb(r)-'id' from private.operations_rules r);end $$;
create function public.configure_operations(p_teacher_hours int,p_session_admin int,p_owner_hours int,p_task_admin int,p_high int,p_horizon int) returns void language plpgsql security definer set search_path='' as $$begin
 if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;
 update private.operations_rules set session_teacher_hours=p_teacher_hours,session_admin_hours=p_session_admin,task_owner_hours=p_owner_hours,task_admin_hours=p_task_admin,high_hours=p_high,horizon_days=p_horizon;
 perform private.audit('thresholds_configured','operations','00000000-0000-0000-0000-000000000003',jsonb_build_object('session_hours',p_teacher_hours,'task_hours',p_owner_hours));end $$;
create function private.run_operations(p_now timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$declare rules private.operations_rules;s public.class_sessions;t public.tasks;tpl public.class_schedule_templates;before_count int;g jsonb;conflicts int:=0;generated int:=0;localday date:=(p_now at time zone 'Asia/Bangkok')::date;begin
 perform pg_advisory_xact_lock(7343002);select * into rules from private.operations_rules;select count(*) into before_count from public.notifications;
 for tpl in select * from public.class_schedule_templates where active and (not (select pilot_mode from public.pilot_config) or private.in_pilot(teacher_id,class_id)) order by id loop
  g:=private.generate_schedule(tpl.id,localday,localday+rules.horizon_days);generated:=generated+(g->>'generated')::int;conflicts:=conflicts+jsonb_array_length(g->'conflicts');
  if jsonb_array_length(g->'conflicts')>0 then perform private.notice_admins('schedule_conflict','Lịch lặp có conflict','schedule',tpl.id,'schedule-conflict:'||tpl.id||':'||localday);end if;
 end loop;
 for s in select * from public.class_sessions where status in ('scheduled','in_progress') and ends_at<p_now and (not (select pilot_mode from public.pilot_config) or private.in_pilot(teacher_id,class_id)) loop
  if s.ends_at<=p_now-make_interval(hours=>rules.session_teacher_hours) and exists(select 1 from public.profiles p join public.teacher_class_assignments a on a.teacher_id=p.id where p.id=s.teacher_id and p.active and p.role='teacher' and a.class_id=s.class_id) then perform private.notice(s.teacher_id,'checkout_due','Buổi học chưa hoàn tất','Mở buổi học để checkout.','/teacher/sessions/'||s.id,'session',s.id,'checkout2:'||s.id);end if;
  if s.ends_at<=p_now-make_interval(hours=>rules.session_admin_hours) then perform private.notice_admins('checkout_overdue','Có buổi học quá hạn checkout','session',s.id,'checkout12:'||s.id);end if;
 end loop;
 for t in select * from public.tasks where status not in ('done','cancelled') loop
  if private.task_owner_valid(t.owner_id,t.student_id,t.type) is not true then perform private.notice_admins('unassigned','Công việc chưa có owner hợp lệ','task',t.id,'unassigned:'||t.id);continue;end if;
  if t.due_at<=p_now-make_interval(hours=>rules.task_owner_hours) then perform private.notice(t.owner_id,'task_due','Công việc quá hạn','Mở công việc để xử lý.','/tasks/'||t.id,'task',t.id,'task24:'||t.id);end if;
  if t.due_at<=p_now-make_interval(hours=>rules.task_admin_hours) then perform private.notice_admins('task_overdue','Công việc quá hạn cần quản lý','task',t.id,'task48:'||t.id);end if;
  if t.priority in ('high','urgent') and t.status='open' and t.created_at<=p_now-make_interval(hours=>rules.high_hours) then perform private.notice(t.owner_id,'task_high','Việc ưu tiên cao chưa xử lý','Mở công việc để xử lý.','/tasks/'||t.id,'task',t.id,'high:'||t.id,true);end if;
 end loop;
 return jsonb_build_object('generated',generated,'conflicts',conflicts,'notifications',(select count(*)-before_count from public.notifications));
end $$;
create function public.run_daily_operations() returns jsonb language plpgsql security definer set search_path='' as $$begin if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;return private.run_operations(now());end $$;
create function public.run_scheduled_operations() returns jsonb language sql security definer set search_path='' as $$select private.run_operations(now())$$;
create function public.pilot_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;
 return (select jsonb_build_object('sessions',count(*),'median_seconds',percentile_cont(0.5) within group(order by duration_seconds),'p90_seconds',percentile_cont(0.9) within group(order by duration_seconds),'average_exceptions',avg(exception_count),'save_errors',(select count(*) from public.pilot_events where event_type='save_error' and created_at>=now()-interval '7 days')) from public.pilot_events where event_type='checkout_completed' and created_at>=now()-interval '7 days');
end $$;
create function public.operations_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;
 result:=jsonb_build_object('as_of',now(),'corrections',(select count(*) from public.session_corrections where status='pending'),'critical_unread',(select count(*) from public.notifications where user_id=auth.uid() and critical and read_at is null and resolved_at is null),'pilot',public.pilot_metrics(),
 'sessions',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'title',s.lesson_title,'ends_at',s.ends_at)),'[]') from (select * from public.class_sessions where (starts_at at time zone 'Asia/Bangkok')::date=(now() at time zone 'Asia/Bangkok')::date or (status in ('scheduled','in_progress') and ends_at<now()) order by starts_at limit 100) s));return result;
end $$;
do $$declare name regprocedure;begin
 for name in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('save_schedule','generate_schedule','session_exception','mark_notification','configure_pilot','open_pilot_checkout','record_pilot_error','operations_configuration','configure_operations','run_daily_operations','pilot_metrics','operations_summary') loop execute format('revoke all on function %s from public',name);execute format('grant execute on function %s to authenticated',name);end loop;end $$;
revoke all on function public.run_scheduled_operations() from public,authenticated,anon;
grant execute on function public.run_scheduled_operations() to service_role;
revoke all on function private.schedule_lock(),private.schedule_conflict(uuid,uuid,timestamptz,timestamptz,uuid),private.generate_schedule(uuid,date,date),private.run_operations(timestamptz) from public;
commit;
