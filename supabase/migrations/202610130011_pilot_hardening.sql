begin;
create or replace function public.save_schedule(p_class uuid,p_teacher uuid,p_from date,p_until date,p_weekdays int[],p_start time,p_end time,p_replace uuid default null,p_version int default null) returns uuid language plpgsql security definer set search_path='' as $$declare old public.class_schedule_templates;result uuid;day int;begin
 if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;
 perform private.schedule_lock();
 if p_from<(now() at time zone 'Asia/Bangkok')::date or cardinality(p_weekdays) not between 1 and 7 or p_weekdays is null or (select count(distinct d) from unnest(p_weekdays) d)<>cardinality(p_weekdays) or not exists(select 1 from public.teacher_class_assignments a join public.profiles p on p.id=a.teacher_id join public.classes c on c.id=a.class_id where a.class_id=p_class and a.teacher_id=p_teacher and p.active and p.role='teacher' and c.active) then raise exception 'Invalid schedule';end if;
 if (select pilot_mode from public.pilot_config) and private.in_pilot(p_teacher,p_class) is not true then raise exception 'Class outside pilot' using errcode='42501';end if;
 if p_replace is not null then
  select * into old from public.class_schedule_templates where id=p_replace for update;
  if not found or not old.active or p_from>old.ends_on or old.class_id<>p_class or p_version is null or old.version<>p_version then raise exception 'Schedule stale' using errcode='40001';end if;
  update public.class_schedule_templates set active=p_from>starts_on,ends_on=case when p_from>starts_on then least(ends_on,p_from-1) else ends_on end,version=version+1 where id=old.id;
  update public.class_sessions set status='cancelled',updated_by=auth.uid(),updated_at=now() where template_id=old.id and status='scheduled' and exception_reason='' and starts_at>=(p_from::timestamp at time zone 'Asia/Bangkok');
 end if;
 insert into public.class_schedule_templates(class_id,teacher_id,starts_on,ends_on,created_by) values(p_class,p_teacher,p_from,p_until,auth.uid()) returning id into result;
 foreach day in array p_weekdays loop insert into public.schedule_rules(template_id,weekday,starts_local,ends_local) values(result,day,p_start,p_end);end loop;
 perform private.audit('schedule_saved','schedule',result,jsonb_build_object('class_id',p_class,'teacher_id',p_teacher,'from',p_from,'replaces',p_replace));return result;
end $$;
create or replace function private.run_operations(p_now timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$declare rules private.operations_rules;s public.class_sessions;t public.tasks;tpl public.class_schedule_templates;before_count int;g jsonb;conflicts int:=0;generated int:=0;localday date:=(p_now at time zone 'Asia/Bangkok')::date;begin
 perform pg_advisory_xact_lock(7343002);select * into rules from private.operations_rules;select count(*) into before_count from public.notifications;
 for tpl in select * from public.class_schedule_templates where active and (not (select pilot_mode from public.pilot_config) or private.in_pilot(teacher_id,class_id)) order by id loop
  g:=private.generate_schedule(tpl.id,localday,localday+rules.horizon_days);generated:=generated+(g->>'generated')::int;conflicts:=conflicts+jsonb_array_length(g->'conflicts');
  if jsonb_array_length(g->'conflicts')>0 then perform private.notice_admins('schedule_conflict','Lịch lặp có conflict','schedule',tpl.id,'schedule-conflict:'||tpl.id||':'||localday);end if;
 end loop;
 for s in select * from public.class_sessions where status in ('scheduled','in_progress') and ends_at<p_now and (not (select pilot_mode from public.pilot_config) or private.in_pilot(teacher_id,class_id)) loop
  if s.ends_at<=p_now-make_interval(hours=>rules.session_teacher_hours) and exists(select 1 from public.profiles p join public.teacher_class_assignments a on a.teacher_id=p.id where p.id=s.teacher_id and p.active and p.role='teacher' and a.class_id=s.class_id) then perform private.notice(s.teacher_id,'checkout_due','Buổi học chưa hoàn tất','Mở buổi học để checkout.','/teacher/sessions/'||s.id,'session',s.id,'checkout2:'||s.id);end if;
  if s.ends_at<=p_now-make_interval(hours=>rules.session_admin_hours) then perform private.notice_admins('checkout_overdue','Có buổi học quá hạn checkout','session',s.id,'checkout12:'||s.id);end if;
 end loop;
 for t in select * from public.tasks where status not in ('done','cancelled') and (not (select pilot_mode from public.pilot_config) or exists(select 1 from public.students st join public.pilot_assignments a on a.class_id=st.class_id where st.id=tasks.student_id and private.in_pilot(a.teacher_id,a.class_id))) loop
  if private.task_owner_valid(t.owner_id,t.student_id,t.type) is not true then perform private.notice_admins('unassigned','Công việc chưa có owner hợp lệ','task',t.id,'unassigned:'||t.id);continue;end if;
  if t.due_at<=p_now-make_interval(hours=>rules.task_owner_hours) then perform private.notice(t.owner_id,'task_due','Công việc quá hạn','Mở công việc để xử lý.','/tasks/'||t.id,'task',t.id,'task24:'||t.id);end if;
  if t.due_at<=p_now-make_interval(hours=>rules.task_admin_hours) then perform private.notice_admins('task_overdue','Công việc quá hạn cần quản lý','task',t.id,'task48:'||t.id);end if;
  if t.priority in ('high','urgent') and t.status='open' and t.created_at<=p_now-make_interval(hours=>rules.high_hours) then perform private.notice(t.owner_id,'task_high','Việc ưu tiên cao chưa xử lý','Mở công việc để xử lý.','/tasks/'||t.id,'task',t.id,'high:'||t.id,true);end if;
 end loop;
 return jsonb_build_object('generated',generated,'conflicts',conflicts,'notifications',(select count(*)-before_count from public.notifications));
end $$;
create or replace function public.command_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;
 with rules as(select * from private.teaching_rules), r as(
 select rr.student_id,count(*) filter(where rr.homework_status='missing') missing,count(*) filter(where rr.quick_score<rules.low_score) low,count(*) filter(where rr.needs_attention or rr.attendance<>'present' or rr.homework_status='missing' or rr.quick_score<rules.low_score) issues
 from public.effective_session_records rr join public.class_sessions ss on ss.id=rr.session_id cross join rules where ss.status='completed' and ss.starts_at>=now()-make_interval(days=>rules.window_days) group by rr.student_id),
 t as(select student_id,count(*) total,count(*) filter(where due_at<now()) overdue,count(*) filter(where priority in ('high','urgent')) high from public.tasks where status not in ('done','cancelled') group by student_id),
 colors as(select case when coalesce(r.missing,0)>=rules.repeat_count or coalesce(r.low,0)>=rules.repeat_count or coalesce(t.overdue,0)>0 or coalesce(t.high,0)>0 then 'red' when coalesce(r.issues,0)>0 or coalesce(t.total,0)>0 then 'yellow' else 'green' end color from public.students s left join r on r.student_id=s.id left join t on t.student_id=s.id cross join rules where s.active)
 select jsonb_build_object('green',count(*) filter(where color='green'),'yellow',count(*) filter(where color='yellow'),'red',count(*) filter(where color='red')) into result from colors;
 result:=result||jsonb_build_object('sessions',(select count(*) from public.class_sessions where (starts_at at time zone 'Asia/Bangkok')::date=(now() at time zone 'Asia/Bangkok')::date),
 'completed',(select count(*) from public.class_sessions where status='completed' and (starts_at at time zone 'Asia/Bangkok')::date=(now() at time zone 'Asia/Bangkok')::date),
 'pending',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.lesson_title,'teacher',p.full_name)), '[]') from public.class_sessions s join public.profiles p on p.id=s.teacher_id where s.status in ('scheduled','in_progress') and s.ends_at<now()),
 'open',(select count(*) from public.tasks where status not in ('done','cancelled')),
 'overdue',(select count(*) from public.tasks where status not in ('done','cancelled') and due_at<now()),
 'high',(select count(*) from public.tasks where status not in ('done','cancelled') and priority in ('high','urgent')),
 'unassigned',(select count(*) from public.tasks t where status not in ('done','cancelled') and private.task_owner_valid(t.owner_id,t.student_id,t.type) is not true));
 return result;
end $$;
revoke insert,update,delete,truncate on public.class_schedule_templates,public.schedule_rules,public.session_corrections,public.audit_events,public.notifications,public.pilot_config,public.pilot_assignments,public.pilot_events from service_role;
commit;
