begin;
-- Identity-only lookup bound to the historical roster, never current class/active.
create function public.session_roster(p_session uuid) returns table(id uuid,full_name text,student_code text)
language plpgsql stable security definer set search_path='' as $$begin
 if private.can_session(p_session) is not true then raise exception 'Forbidden' using errcode='42501';end if;
 return query select s.id,s.full_name,s.student_code from public.session_student_records r join public.students s on s.id=r.student_id where r.session_id=p_session order by s.student_code;
end $$;
revoke all on function public.session_roster(uuid) from public;
grant execute on function public.session_roster(uuid) to authenticated;

create function private.task_owner_valid(p_owner uuid,p_student uuid,p_type public.task_type) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_owner and p.active and
 ((p_type='teacher_review' and p.role='teacher' and exists(select 1 from public.students s join public.teacher_class_assignments a on a.class_id=s.class_id where s.id=p_student and a.teacher_id=p_owner)) or
 (p_type<>'teacher_review' and p.role='cskh' and (select count(*) from public.cskh_student_assignments a join public.profiles cp on cp.id=a.cskh_id where a.student_id=p_student and cp.active and cp.role='cskh')=1 and exists(select 1 from public.cskh_student_assignments a where a.student_id=p_student and a.cskh_id=p_owner))))
$$;
revoke all on function private.task_owner_valid(uuid,uuid,public.task_type) from public;
grant execute on function private.task_owner_valid(uuid,uuid,public.task_type) to authenticated;
drop policy tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using(private.current_role()='admin' or (owner_id=auth.uid() and private.current_role() in ('teacher','cskh') and private.task_owner_valid(owner_id,student_id,type)));

-- Serializing all child mutations on the parent closes upload/completion races.
create function private.guard_session_history() returns trigger language plpgsql security definer set search_path='' as $$
declare sid uuid; st public.session_status;begin
 if TG_TABLE_NAME='class_sessions' then
  if OLD.status='completed' and (TG_OP='DELETE' or NEW is distinct from OLD) then raise exception 'Completed session immutable' using errcode='55000';end if;
 else
  if TG_TABLE_NAME='record_notes' then
   select session_id into sid from public.session_student_records where id=case when TG_OP='DELETE' then OLD.record_id else NEW.record_id end;
  else sid:=case when TG_OP='DELETE' then OLD.session_id else NEW.session_id end;end if;
  select status into st from public.class_sessions where id=sid for update;
  if st='completed' then raise exception 'Completed session immutable' using errcode='55000';end if;
  if TG_TABLE_NAME='session_student_records' then
   if TG_OP='INSERT' and st<>'scheduled' then raise exception 'Roster already frozen' using errcode='55000';end if;
   if TG_OP='DELETE' and st<>'scheduled' then raise exception 'Roster already frozen' using errcode='55000';end if;
   if TG_OP='UPDATE' and (NEW.session_id<>OLD.session_id or NEW.student_id<>OLD.student_id or NEW.id<>OLD.id) then raise exception 'Roster identity immutable' using errcode='55000';end if;
  elsif TG_OP='UPDATE' then
   if TG_TABLE_NAME='record_notes' then
    if NEW.record_id<>OLD.record_id then raise exception 'Record identity immutable' using errcode='55000';end if;
   elsif NEW.session_id<>OLD.session_id then raise exception 'Session identity immutable' using errcode='55000';end if;
  end if;
 end if;
 if TG_OP='DELETE' then return OLD;end if;return NEW;
end $$;
revoke all on function private.guard_session_history() from public;
create trigger session_history_guard before update or delete on public.class_sessions for each row execute function private.guard_session_history();
create trigger roster_history_guard before insert or update or delete on public.session_student_records for each row execute function private.guard_session_history();
create trigger notes_history_guard before insert or update or delete on public.record_notes for each row execute function private.guard_session_history();
create trigger attachments_history_guard before insert or update or delete on public.session_attachments for each row execute function private.guard_session_history();
create or replace function private.emit_task(p_record public.session_student_records,p_session public.class_sessions,p_type public.task_type,p_priority public.task_priority) returns void language plpgsql security definer set search_path='' as $$
declare owner uuid;task_id uuid; hours int;begin
 -- Serializes a student's rule evaluation across simultaneous sessions.
 perform 1 from public.students where id=p_record.student_id for update;
 select due_hours into hours from private.teaching_rules;
 if p_type='teacher_review' then owner:=p_session.teacher_id;
 else select case when count(*)=1 then (array_agg(a.cskh_id))[1] else null end into owner from public.cskh_student_assignments a join public.profiles p on p.id=a.cskh_id where a.student_id=p_record.student_id and p.active and p.role='cskh';end if;
 if private.task_owner_valid(owner,p_record.student_id,p_type) is not true then owner:=null;end if;
 insert into public.tasks(student_id,source_session_id,source_record_id,type,owner_id,priority,title,description,due_at,created_by,updated_by)
 values(p_record.student_id,p_session.id,p_record.id,p_type,owner,p_priority,
 case p_type when 'homework_followup' then 'Nhắc BTVN' when 'absence_followup' then 'Hỏi thăm vắng không phép' when 'low_score_followup' then 'Theo dõi điểm thấp' when 'teacher_review' then 'Kiểm tra lại bài' else 'Học sinh cần lưu ý' end,
 'Từ buổi học: '||p_session.lesson_title,now()+make_interval(hours=>hours),auth.uid(),auth.uid())
 on conflict(student_id,type) where status not in ('done','cancelled') do update set owner_id=case when private.task_owner_valid(public.tasks.owner_id,public.tasks.student_id,public.tasks.type) then public.tasks.owner_id else excluded.owner_id end,updated_by=auth.uid(),priority=case when excluded.priority='high' and public.tasks.priority='normal' then 'high'::public.task_priority else public.tasks.priority end,updated_at=now(),version=public.tasks.version+1 returning id into task_id;
 perform private.emit_event(p_record.student_id,p_session.id,'task_created','Công việc: '||p_type,p_session.id||':'||p_record.student_id||':task:'||p_type,task_id);
end $$;
create or replace function public.update_task(p_task uuid,p_version int,p_status public.task_status,p_result text default null,p_follow_up timestamptz default null,p_owner uuid default null) returns int language plpgsql security definer set search_path='' as $$
declare t public.tasks;role public.app_role;begin
 role:=private.current_role();select * into t from public.tasks where id=p_task for update;
 if not found or (role='admin' or (role in ('teacher','cskh') and t.owner_id=auth.uid() and private.task_owner_valid(t.owner_id,t.student_id,t.type))) is not true then raise exception 'Forbidden' using errcode='42501';end if;
 if t.status='done' and p_status='done' then return t.version;end if;
 if p_version is null or t.version<>p_version then raise exception 'Task changed' using errcode='40001';end if;
 if t.status in ('done','cancelled') or (p_status='cancelled' and role<>'admin') then raise exception 'Invalid transition';end if;
 if p_status='done' and length(trim(coalesce(p_result,'')))=0 then raise exception 'Result required';end if;
 if p_follow_up is not null and p_follow_up<=now() then raise exception 'Follow-up must be in future';end if;
 if p_owner is not null then
 if role<>'admin' or private.task_owner_valid(p_owner,t.student_id,t.type) is not true then raise exception 'Invalid owner' using errcode='42501';end if;
 end if;
 update public.tasks set status=p_status,result=p_result,follow_up_at=p_follow_up,due_at=coalesce(p_follow_up,due_at),owner_id=coalesce(p_owner,owner_id),completed_at=case when p_status='done' then now() else null end,version=version+1,updated_by=auth.uid(),updated_at=now() where id=t.id returning version into t.version;
 perform private.emit_event(t.student_id,t.source_session_id,'task_updated','Công việc chuyển sang: '||p_status,'task:'||t.id||':'||t.version,t.id);return t.version;
end $$;
create or replace function public.register_session_attachment(p_session uuid,p_path text,p_mime text,p_size bigint,p_student uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; st public.session_status;begin
 select status into st from public.class_sessions where id=p_session for update;
 if st is distinct from 'in_progress' or private.can_edit_session(p_session) is not true then raise exception 'Forbidden' using errcode='42501';end if;
 if p_path !~ ('^'||p_session::text||'/[0-9a-f-]{36}\.(jpg|png|webp|mp4)$') then raise exception 'Invalid path';end if;
 if p_student is not null and not exists(select 1 from public.session_student_records where session_id=p_session and student_id=p_student) then raise exception 'Invalid student';end if;
 if not exists(select 1 from storage.objects where bucket_id='session-attachments' and name=p_path and user_metadata->>'uploaded_by'=auth.uid()::text and (metadata->>'size')::bigint=p_size and metadata->>'mimetype'=p_mime) then raise exception 'Object metadata mismatch';end if;
 insert into public.session_attachments(session_id,student_id,uploaded_by,storage_path,mime_type,size_bytes) values(p_session,p_student,auth.uid(),p_path,p_mime,p_size) returning id into result;return result;
end $$;
create or replace function public.command_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;
 with rules as(select * from private.teaching_rules), r as(
 select rr.student_id,count(*) filter(where rr.homework_status='missing') missing,count(*) filter(where rr.quick_score<rules.low_score) low,count(*) filter(where rr.needs_attention or rr.attendance<>'present' or rr.homework_status='missing' or rr.quick_score<rules.low_score) issues
 from public.session_student_records rr join public.class_sessions ss on ss.id=rr.session_id cross join rules where ss.status='completed' and ss.starts_at>=now()-make_interval(days=>rules.window_days) group by rr.student_id),
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
-- Student 360 can read academic timestamps after transfer without private access.
create function public.student_session_history(p_student uuid) returns table(id uuid,status public.session_status,starts_at timestamptz)
language plpgsql stable security definer set search_path='' as $$begin
 if private.can_student(p_student) is not true then raise exception 'Forbidden' using errcode='42501';end if;
 return query select s.id,s.status,s.starts_at from public.class_sessions s join public.session_student_records r on r.session_id=s.id where r.student_id=p_student and s.status='completed' order by r.created_at desc limit 200;
end $$;
revoke all on function public.student_session_history(uuid) from public;
grant execute on function public.student_session_history(uuid) to authenticated;
create or replace function public.save_session_checkout(p_session uuid,p_version int,p_data jsonb,p_complete boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.class_sessions;r public.session_student_records;item jsonb;n int;rules private.teaching_rules;missing_count int;prefix text;anchor timestamptz;begin
 select * into s from public.class_sessions where id=p_session for update;
 if not found or (private.current_role()='admin' or (private.current_role()='teacher' and s.teacher_id=auth.uid() and private.can_class(s.class_id))) is not true then raise exception 'Forbidden' using errcode='42501';end if;
 if p_complete is null then raise exception 'Completion flag required';end if;
 if s.status='completed' and p_complete then return jsonb_build_object('version',s.version,'completed',true,'replayed',true);end if;
 if s.status<>'in_progress' then raise exception 'Session not editable';end if;
 if p_version is null or s.version<>p_version then raise exception 'Draft changed in another tab' using errcode='40001';end if;
 if jsonb_typeof(p_data->'records') is distinct from 'array' then raise exception 'Invalid records';end if;
 select count(*) into n from public.session_student_records where session_id=s.id;
 if jsonb_array_length(p_data->'records')<>n or (select count(distinct x->>'student_id') from jsonb_array_elements(p_data->'records') x)<>n then raise exception 'Incomplete or duplicate roster';end if;
 -- Lock roster students in a stable order to avoid cross-session rule deadlocks.
 perform 1 from public.students where id in(select student_id from public.session_student_records where session_id=s.id) order by id for update;
 for item in select * from jsonb_array_elements(p_data->'records') loop
 update public.session_student_records set attendance=(item->>'attendance')::public.attendance_status,homework_status=(item->>'homework_status')::public.homework_status,old_lesson_status=(item->>'old_lesson_status')::public.old_lesson_status,
 quick_score=nullif(item->>'quick_score','')::numeric,needs_attention=(item->>'needs_attention')::boolean,attention_reasons=array(select jsonb_array_elements_text(item->'attention_reasons')),updated_at=now()
 where session_id=s.id and student_id=(item->>'student_id')::uuid returning * into r;
 if not found then raise exception 'Student outside roster';end if;
 insert into public.record_notes(record_id,teacher_note) values(r.id,coalesce(item->>'teacher_note','')) on conflict(record_id) do update set teacher_note=excluded.teacher_note;
 end loop;
 update public.class_sessions set lesson_content=coalesce(p_data->>'lesson_content',''),homework_assigned=coalesce(p_data->>'homework_assigned',''),version=version+1,updated_at=now(),updated_by=auth.uid() where id=s.id returning * into s;
 if p_complete then
 select * into rules from private.teaching_rules;
 update public.class_sessions set status='completed',completed_at=now(),completed_by=auth.uid() where id=s.id;
 for r in select * from public.session_student_records where session_id=s.id order by student_id loop
 prefix:=s.id||':'||r.student_id||':';
 perform private.emit_event(r.student_id,s.id,'attendance',case r.attendance when 'present' then 'Có mặt' when 'absent_excused' then 'Vắng có phép' else 'Vắng không phép' end,prefix||'attendance');
 perform private.emit_event(r.student_id,s.id,'session_completed','Hoàn thành: '||s.lesson_title,prefix||'completed');
 if r.homework_status='missing' then
 perform private.emit_event(r.student_id,s.id,'homework_missing','Thiếu BTVN',prefix||'homework');
 -- Evaluate against the newest completed lesson, independent of completion order.
 select max(cs.starts_at) into anchor from public.session_student_records cr join public.class_sessions cs on cs.id=cr.session_id where cr.student_id=r.student_id and cs.status='completed';
 select count(*) into missing_count from public.session_student_records rr join public.class_sessions ss on ss.id=rr.session_id where rr.student_id=r.student_id and rr.homework_status='missing' and ss.status='completed' and ss.starts_at between anchor-make_interval(days=>rules.window_days) and anchor;
 perform private.emit_task(r,s,'homework_followup',case when missing_count>=rules.repeat_count then 'high'::public.task_priority else 'normal'::public.task_priority end);
 end if;
 if r.attendance='absent_unexcused' then perform private.emit_task(r,s,'absence_followup','normal');end if;
 if r.quick_score<rules.low_score then
 perform private.emit_event(r.student_id,s.id,'low_score','Điểm nhanh: '||r.quick_score,prefix||'score');
 perform private.emit_task(r,s,'low_score_followup','normal');perform private.emit_task(r,s,'teacher_review','normal');
 end if;
 if r.old_lesson_status='needs_review' then perform private.emit_task(r,s,'teacher_review','normal');end if;
 if r.needs_attention then perform private.emit_event(r.student_id,s.id,'needs_attention','Cần lưu ý: '||array_to_string(r.attention_reasons,', '),prefix||'attention');perform private.emit_task(r,s,'general_attention','normal');end if;
 if exists(select 1 from public.record_notes where record_id=r.id and teacher_note<>'') then perform private.emit_event(r.student_id,s.id,'teacher_note','Giáo viên có ghi chú riêng',prefix||'note');end if;
 end loop;
 end if;
 return jsonb_build_object('version',s.version,'completed',p_complete,'replayed',false);
end $$;

commit;
