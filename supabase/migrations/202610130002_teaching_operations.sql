begin;
create type public.session_status as enum ('scheduled','in_progress','completed','cancelled');
create type public.attendance_status as enum ('present','absent_excused','absent_unexcused');
create type public.homework_status as enum ('done','partial','missing','not_applicable');
create type public.old_lesson_status as enum ('passed','needs_review','not_checked');
create type public.task_type as enum ('homework_followup','absence_followup','low_score_followup','teacher_review','general_attention');
create type public.task_status as enum ('open','in_progress','waiting_parent','waiting_teacher','done','cancelled');
create type public.task_priority as enum ('normal','high','urgent');
create table private.teaching_rules(id boolean primary key default true check(id), window_days int not null default 7, repeat_count int not null default 2, low_score numeric not null default 5, due_hours int not null default 24);
insert into private.teaching_rules(id) values(true);
create table public.class_sessions(
 id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes on delete restrict,
 teacher_id uuid not null references public.profiles on delete restrict,
 starts_at timestamptz not null, ends_at timestamptz not null, lesson_title text not null check(length(trim(lesson_title)) between 1 and 200),
 lesson_content text not null default '' check(length(lesson_content)<=5000), homework_assigned text not null default '' check(length(homework_assigned)<=2000),
 status public.session_status not null default 'scheduled', version int not null default 0,
 completed_at timestamptz, completed_by uuid references public.profiles on delete restrict,
 created_by uuid not null references public.profiles on delete restrict, updated_by uuid references public.profiles on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '6 hours'),check((status='completed')=(completed_at is not null and completed_by is not null)),unique(class_id,starts_at)
);
create index sessions_teacher_time on public.class_sessions(teacher_id,starts_at);
create index sessions_class_time on public.class_sessions(class_id,starts_at);
create table public.session_student_records(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.class_sessions on delete restrict, student_id uuid not null references public.students on delete restrict,
 attendance public.attendance_status not null default 'present',homework_status public.homework_status not null default 'done',old_lesson_status public.old_lesson_status not null default 'passed',
 quick_score numeric check(quick_score between 0 and 10), needs_attention boolean not null default false,
 attention_reasons text[] not null default '{}', check(attention_reasons <@ array['homework','old_lesson','low_score','focus','other']::text[]),check(needs_attention or cardinality(attention_reasons)=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(session_id,student_id)
);
create index records_student on public.session_student_records(student_id,session_id);
create table public.record_notes(record_id uuid primary key references public.session_student_records on delete cascade,teacher_note text not null check(length(teacher_note)<=2000));
create table public.tasks(
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students on delete restrict,
 source_session_id uuid references public.class_sessions on delete restrict,source_record_id uuid references public.session_student_records on delete restrict,
 type public.task_type not null,owner_id uuid references public.profiles on delete restrict,backup_owner_id uuid references public.profiles on delete restrict,
 priority public.task_priority not null default 'normal',status public.task_status not null default 'open',title text not null,description text not null default '',
 due_at timestamptz not null,completed_at timestamptz,result text check(length(result)<=2000),follow_up_at timestamptz,
 version int not null default 0,created_by uuid not null references public.profiles on delete restrict,updated_by uuid references public.profiles on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check((status='done')=(completed_at is not null))
);
create unique index tasks_one_active_type on public.tasks(student_id,type) where status not in ('done','cancelled');
create index tasks_owner_deadline on public.tasks(owner_id,status,due_at);
create index tasks_source on public.tasks(source_session_id);
create table public.student_events(
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students on delete restrict,session_id uuid references public.class_sessions on delete restrict,task_id uuid references public.tasks on delete restrict,
 event_type text not null check(event_type in ('attendance','homework_missing','low_score','needs_attention','teacher_note','session_completed','task_created','task_updated')),
 summary text not null, idempotency_key text not null unique,created_by uuid not null references public.profiles on delete restrict,created_at timestamptz not null default now()
);
create index events_student_time on public.student_events(student_id,created_at desc);
create table public.session_attachments(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.class_sessions on delete restrict,student_id uuid references public.students on delete restrict,
 uploaded_by uuid not null references public.profiles on delete restrict,storage_path text not null unique,mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','video/mp4')),
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=41943040),created_at timestamptz not null default now()
);
create index attachments_session on public.session_attachments(session_id);
create function private.can_class(p_class uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select private.current_role())='admin' or ((select private.current_role())='teacher' and exists(select 1 from public.teacher_class_assignments where teacher_id=auth.uid() and class_id=p_class))
$$;
create function private.can_student(p_student uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.students s where s.id=p_student and (private.can_class(s.class_id) or ((select private.current_role())='cskh' and exists(select 1 from public.cskh_student_assignments a where a.student_id=s.id and a.cskh_id=auth.uid()))))
$$;
create function private.can_session(p_session uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_sessions where id=p_session and private.can_class(class_id))
$$;
create function private.can_edit_session(p_session uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_sessions where id=p_session and status in ('scheduled','in_progress') and (private.current_role()='admin' or (private.current_role()='teacher' and teacher_id=auth.uid() and private.can_class(class_id))))
$$;
revoke all on function private.can_class(uuid),private.can_student(uuid),private.can_session(uuid),private.can_edit_session(uuid) from public;
grant execute on function private.can_class(uuid),private.can_student(uuid),private.can_session(uuid),private.can_edit_session(uuid) to authenticated;
do $$ declare t text; begin
 foreach t in array array['class_sessions','session_student_records','record_notes','tasks','student_events','session_attachments'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create policy sessions_read on public.class_sessions for select to authenticated using(private.can_class(class_id) or (private.current_role()='cskh' and exists(select 1 from public.session_student_records r where r.session_id=id and private.can_student(r.student_id))));
-- CSKH gets academic core only; private notes and attachments stay teacher/admin only.
create function private.completed_session(p_session uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.class_sessions where id=p_session and status='completed') $$;
revoke all on function private.completed_session(uuid) from public;
grant execute on function private.completed_session(uuid) to authenticated;
create policy records_read on public.session_student_records for select to authenticated using(private.can_session(session_id) or (private.current_role()='cskh' and private.can_student(student_id) and private.completed_session(session_id)));
create policy notes_read on public.record_notes for select to authenticated using(exists(select 1 from public.session_student_records r where r.id=record_id and private.can_session(r.session_id)));
create policy events_read on public.student_events for select to authenticated using(private.can_student(student_id));
create policy attachments_read on public.session_attachments for select to authenticated using(private.can_session(session_id));
create policy tasks_read on public.tasks for select to authenticated using(private.current_role()='admin' or (owner_id=auth.uid() and private.can_student(student_id) and private.current_role() in ('teacher','cskh')));
create function public.create_class_session(p_class uuid,p_teacher uuid,p_start timestamptz,p_end timestamptz,p_title text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin
 if private.current_role() is distinct from 'admin' then raise exception 'Forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.classes where id=p_class and active) or not exists(select 1 from public.teacher_class_assignments a join public.profiles p on p.id=a.teacher_id where a.teacher_id=p_teacher and a.class_id=p_class and p.active and p.role='teacher') then raise exception 'Invalid assignment';end if;
 insert into public.class_sessions(class_id,teacher_id,starts_at,ends_at,lesson_title,created_by,updated_by) values(p_class,p_teacher,p_start,p_end,p_title,auth.uid(),auth.uid()) returning id into result;return result;
end $$;
create function public.start_class_session(p_session uuid) returns int language plpgsql security definer set search_path='' as $$
declare s public.class_sessions;begin
 select * into s from public.class_sessions where id=p_session for update;
 if not found or not private.can_edit_session(p_session) then raise exception 'Forbidden or session locked' using errcode='42501';end if;
 if s.status='scheduled' then
 insert into public.session_student_records(session_id,student_id) select s.id,id from public.students where class_id=s.class_id and active;
 if not exists(select 1 from public.session_student_records where session_id=s.id) then raise exception 'Empty roster';end if;
 update public.class_sessions set status='in_progress',version=version+1,updated_by=auth.uid(),updated_at=now() where id=s.id returning version into s.version;
 end if;return s.version;
end $$;
create function private.emit_event(p_student uuid,p_session uuid,p_type text,p_summary text,p_key text,p_task uuid default null) returns void language sql security definer set search_path='' as $$
 insert into public.student_events(student_id,session_id,event_type,summary,idempotency_key,created_by,task_id) values(p_student,p_session,p_type,p_summary,p_key,auth.uid(),p_task) on conflict(idempotency_key) do nothing
$$;
create function private.emit_task(p_record public.session_student_records,p_session public.class_sessions,p_type public.task_type,p_priority public.task_priority) returns void language plpgsql security definer set search_path='' as $$
declare owner uuid;task_id uuid; hours int;begin
 -- Serializes a student's rule evaluation across simultaneous sessions.
 perform 1 from public.students where id=p_record.student_id for update;
 select due_hours into hours from private.teaching_rules;
 if p_type='teacher_review' then owner:=p_session.teacher_id;
 else select case when count(*)=1 then (array_agg(a.cskh_id))[1] else null end into owner from public.cskh_student_assignments a join public.profiles p on p.id=a.cskh_id where a.student_id=p_record.student_id and p.active and p.role='cskh';end if;
 insert into public.tasks(student_id,source_session_id,source_record_id,type,owner_id,priority,title,description,due_at,created_by,updated_by)
 values(p_record.student_id,p_session.id,p_record.id,p_type,owner,p_priority,
 case p_type when 'homework_followup' then 'Nhắc BTVN' when 'absence_followup' then 'Hỏi thăm vắng không phép' when 'low_score_followup' then 'Theo dõi điểm thấp' when 'teacher_review' then 'Kiểm tra lại bài' else 'Học sinh cần lưu ý' end,
 'Từ buổi học: '||p_session.lesson_title,now()+make_interval(hours=>hours),auth.uid(),auth.uid())
 on conflict(student_id,type) where status not in ('done','cancelled') do update set priority=case when excluded.priority='high' and public.tasks.priority='normal' then 'high'::public.task_priority else public.tasks.priority end,updated_at=now(),version=public.tasks.version+1 returning id into task_id;
 perform private.emit_event(p_record.student_id,p_session.id,'task_created','Công việc: '||p_type,p_session.id||':'||p_record.student_id||':task:'||p_type,task_id);
end $$;
create function public.save_session_checkout(p_session uuid,p_version int,p_data jsonb,p_complete boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.class_sessions;r public.session_student_records;item jsonb;n int;rules private.teaching_rules;missing_count int;prefix text;begin
 select * into s from public.class_sessions where id=p_session for update;
 if not found or (private.current_role()='admin' or (private.current_role()='teacher' and s.teacher_id=auth.uid() and private.can_class(s.class_id))) is not true then raise exception 'Forbidden' using errcode='42501';end if;
 if s.status='completed' and p_complete then return jsonb_build_object('version',s.version,'completed',true,'replayed',true);end if;
 if s.status<>'in_progress' then raise exception 'Session not editable';end if;
 if s.version<>p_version then raise exception 'Draft changed in another tab' using errcode='40001';end if;
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
 select count(*) into missing_count from public.session_student_records rr join public.class_sessions ss on ss.id=rr.session_id where rr.student_id=r.student_id and rr.homework_status='missing' and ss.status='completed' and ss.starts_at between s.starts_at-make_interval(days=>rules.window_days) and s.starts_at;
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
create function public.update_task(p_task uuid,p_version int,p_status public.task_status,p_result text default null,p_follow_up timestamptz default null,p_owner uuid default null) returns int language plpgsql security definer set search_path='' as $$
declare t public.tasks;role public.app_role;begin
 role:=private.current_role();select * into t from public.tasks where id=p_task for update;
 if not found or (role='admin' or (role in ('teacher','cskh') and t.owner_id=auth.uid() and private.can_student(t.student_id))) is not true then raise exception 'Forbidden' using errcode='42501';end if;
 if t.status='done' and p_status='done' then return t.version;end if;
 if t.version<>p_version then raise exception 'Task changed' using errcode='40001';end if;
 if t.status in ('done','cancelled') or (p_status='cancelled' and role<>'admin') then raise exception 'Invalid transition';end if;
 if p_status='done' and length(trim(coalesce(p_result,'')))=0 then raise exception 'Result required';end if;
 if p_follow_up is not null and p_follow_up<=now() then raise exception 'Follow-up must be in future';end if;
 if p_owner is not null then
 if role<>'admin' or not exists(select 1 from public.profiles p where p.id=p_owner and p.active and ((t.type='teacher_review' and p.role='teacher' and exists(select 1 from public.teacher_class_assignments a join public.class_sessions s on s.class_id=a.class_id where s.id=t.source_session_id and a.teacher_id=p.id)) or (t.type<>'teacher_review' and p.role='cskh' and exists(select 1 from public.cskh_student_assignments a where a.cskh_id=p.id and a.student_id=t.student_id)))) then raise exception 'Invalid owner' using errcode='42501';end if;
 end if;
 update public.tasks set status=p_status,result=p_result,follow_up_at=p_follow_up,due_at=coalesce(p_follow_up,due_at),owner_id=coalesce(p_owner,owner_id),completed_at=case when p_status='done' then now() else null end,version=version+1,updated_by=auth.uid(),updated_at=now() where id=t.id returning version into t.version;
 perform private.emit_event(t.student_id,t.source_session_id,'task_updated','Công việc chuyển sang: '||p_status,'task:'||t.id||':'||t.version,t.id);return t.version;
end $$;
create function public.student_context(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not private.can_student(p_student) then raise exception 'Forbidden' using errcode='42501';end if;
 select jsonb_build_object('class_name',c.name,'teachers',(select jsonb_agg(p.full_name) from public.teacher_class_assignments a join public.profiles p on p.id=a.teacher_id where a.class_id=s.class_id and p.active),'cskh',(select jsonb_agg(p.full_name) from public.cskh_student_assignments a join public.profiles p on p.id=a.cskh_id where a.student_id=s.id and p.active)) into result from public.students s left join public.classes c on c.id=s.class_id where s.id=p_student;return result;
end $$;
create function public.student_pulse(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rules private.teaching_rules;missing int;low int;issues int;overdue int;high int;open_tasks int;reasons text[]:='{}';color text:='green';begin
 if not private.can_student(p_student) then raise exception 'Forbidden' using errcode='42501';end if;
 select * into rules from private.teaching_rules;
 select count(*) filter(where r.homework_status='missing'),count(*) filter(where r.quick_score<rules.low_score),count(*) filter(where r.needs_attention or r.attendance<>'present' or r.homework_status='missing' or r.quick_score<rules.low_score) into missing,low,issues from public.session_student_records r join public.class_sessions s on s.id=r.session_id where r.student_id=p_student and s.status='completed' and s.starts_at>=now()-make_interval(days=>rules.window_days);
 select count(*),count(*) filter(where due_at<now()),count(*) filter(where priority in ('high','urgent')) into open_tasks,overdue,high from public.tasks where student_id=p_student and status not in ('done','cancelled');
 if missing>=rules.repeat_count then reasons:=array_append(reasons,missing||' lần thiếu BTVN trong '||rules.window_days||' ngày');color:='red';end if;
 if low>=rules.repeat_count then reasons:=array_append(reasons,low||' lần điểm thấp');color:='red';end if;
 if overdue>0 then reasons:=array_append(reasons,overdue||' task quá hạn');color:='red';end if;
 if high>0 then reasons:=array_append(reasons,high||' task ưu tiên cao');color:='red';end if;
 if issues>0 then reasons:=array_append(reasons,issues||' buổi có lưu ý gần đây');if color='green' then color:='yellow';end if;end if;
 if open_tasks>0 then reasons:=array_append(reasons,open_tasks||' công việc đang mở');if color='green' then color:='yellow';end if;end if;
 return jsonb_build_object('color',color,'reasons',reasons);
end $$;
-- Metadata registration is bound to an already uploaded private object.
create function public.register_session_attachment(p_session uuid,p_path text,p_mime text,p_size bigint,p_student uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin
 if not private.can_edit_session(p_session) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_path !~ ('^'||p_session::text||'/[0-9a-f-]{36}\.(jpg|png|webp|mp4)$') then raise exception 'Invalid path';end if;
 if p_student is not null and not exists(select 1 from public.session_student_records where session_id=p_session and student_id=p_student) then raise exception 'Invalid student';end if;
 if not exists(select 1 from storage.objects where bucket_id='session-attachments' and name=p_path and user_metadata->>'uploaded_by'=auth.uid()::text and (metadata->>'size')::bigint=p_size and metadata->>'mimetype'=p_mime) then raise exception 'Object metadata mismatch';end if;
 insert into public.session_attachments(session_id,student_id,uploaded_by,storage_path,mime_type,size_bytes) values(p_session,p_student,auth.uid(),p_path,p_mime,p_size) returning id into result;return result;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('session-attachments','session-attachments',false,41943040,array['image/jpeg','image/png','image/webp','video/mp4']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy teaching_storage_read on storage.objects for select to authenticated using(bucket_id='session-attachments' and exists(select 1 from public.session_attachments a where a.storage_path=name and private.can_session(a.session_id)));
revoke all on function private.emit_event(uuid,uuid,text,text,text,uuid),private.emit_task(public.session_student_records,public.class_sessions,public.task_type,public.task_priority) from public;
revoke all on function public.create_class_session(uuid,uuid,timestamptz,timestamptz,text),public.start_class_session(uuid),public.save_session_checkout(uuid,int,jsonb,boolean),public.update_task(uuid,int,public.task_status,text,timestamptz,uuid),public.student_context(uuid),public.student_pulse(uuid),public.register_session_attachment(uuid,text,text,bigint,uuid) from public;
grant execute on function public.create_class_session(uuid,uuid,timestamptz,timestamptz,text),public.start_class_session(uuid),public.save_session_checkout(uuid,int,jsonb,boolean),public.update_task(uuid,int,public.task_status,text,timestamptz,uuid),public.student_context(uuid),public.student_pulse(uuid),public.register_session_attachment(uuid,text,text,bigint,uuid) to authenticated;

create function public.class_directory() returns table(id uuid,name text) language sql stable security definer set search_path='' as $$
 select c.id,c.name from public.classes c where private.can_class(c.id) or (private.current_role()='cskh' and exists(select 1 from public.students s join public.cskh_student_assignments a on a.student_id=s.id where s.class_id=c.id and a.cskh_id=auth.uid())) order by c.name
$$;
create function public.command_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 'unassigned',(select count(*) from public.tasks t where status not in ('done','cancelled') and (owner_id is null or not exists(select 1 from public.profiles p where p.id=t.owner_id and p.active) or (t.type<>'teacher_review' and not exists(select 1 from public.cskh_student_assignments a where a.cskh_id=t.owner_id and a.student_id=t.student_id)))));
 return result;
end $$;
revoke all on function public.class_directory(),public.command_summary() from public;
grant execute on function public.class_directory(),public.command_summary() to authenticated;
commit;
