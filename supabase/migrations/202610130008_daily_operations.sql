begin;
create table public.class_schedule_templates(
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.classes on delete restrict,teacher_id uuid not null references public.profiles on delete restrict,
 starts_on date not null,ends_on date not null,active boolean not null default true,version int not null default 0,
 created_by uuid not null references public.profiles,created_at timestamptz not null default now(),check(ends_on>=starts_on and ends_on<=starts_on+366)
);
create table public.schedule_rules(template_id uuid not null references public.class_schedule_templates on delete restrict,weekday int not null check(weekday between 0 and 6),starts_local time not null,ends_local time not null,primary key(template_id,weekday),check(ends_local>starts_local and ends_local-starts_local<=interval '6 hours'));
alter table public.class_sessions add column template_id uuid references public.class_schedule_templates on delete restrict;
alter table public.class_sessions add column exception_reason text not null default '' check(length(exception_reason)<=300);
create table public.session_corrections(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.class_sessions on delete restrict,record_id uuid references public.session_student_records on delete restrict,
 field_name text not null check(field_name in ('attendance','homework_status','old_lesson_status','quick_score','needs_attention','teacher_note','lesson_content','homework_assigned')),
 old_value text not null,new_value text not null check(length(new_value)<=5000),reason text not null check(length(trim(reason)) between 5 and 1000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 requested_by uuid not null references public.profiles,reviewed_by uuid references public.profiles,review_note text check(length(review_note)<=1000),created_at timestamptz not null default now(),reviewed_at timestamptz,
 check((status='pending')=(reviewed_at is null and reviewed_by is null)),
 check((field_name in ('lesson_content','homework_assigned'))=(record_id is null))
);
create unique index correction_one_pending on public.session_corrections(session_id,coalesce(record_id,'00000000-0000-0000-0000-000000000000'::uuid),field_name) where status='pending';
create index corrections_review on public.session_corrections(status,created_at);
create index corrections_effective on public.session_corrections(record_id,field_name,reviewed_at desc) where status='approved';
create table public.audit_events(id bigint generated always as identity primary key,actor_id uuid references public.profiles on delete restrict,action text not null,entity_type text not null,entity_id uuid not null,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create index audit_time on public.audit_events(created_at desc,id desc);
create index audit_entity on public.audit_events(entity_type,entity_id);
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete restrict,type text not null,title text not null,message text not null,link text not null check(link like '/%' and link not like '//%'),entity_type text not null,entity_id uuid not null,critical boolean not null default false,dedupe_key text not null,read_at timestamptz,resolved_at timestamptz,created_at timestamptz not null default now(),unique(user_id,dedupe_key));
create index notifications_inbox on public.notifications(user_id,created_at desc) where resolved_at is null;
create table public.pilot_config(id boolean primary key default true check(id),pilot_mode boolean not null default false);
insert into public.pilot_config(id) values(true);
create table public.pilot_assignments(teacher_id uuid not null references public.profiles on delete restrict,class_id uuid not null references public.classes on delete restrict,primary key(teacher_id,class_id));
create table public.pilot_events(
 id uuid primary key default gen_random_uuid(),attempt_id uuid not null,session_id uuid not null references public.class_sessions on delete restrict,user_id uuid not null references public.profiles on delete restrict,
 event_type text not null check(event_type in ('checkout_opened','checkout_completed','save_error')),duration_seconds numeric check(duration_seconds>=0),student_count int not null check(student_count>=0),exception_count int not null check(exception_count>=0),device_category text not null check(device_category in ('mobile','tablet','desktop')),error_key uuid,created_at timestamptz not null default now()
);
create unique index pilot_once on public.pilot_events(session_id,user_id,event_type) where event_type<>'save_error';
create unique index pilot_error_once on public.pilot_events(attempt_id,error_key) where event_type='save_error';
create index pilot_metrics_time on public.pilot_events(event_type,created_at);
create table private.operations_rules(id boolean primary key default true check(id),session_teacher_hours int not null default 2,session_admin_hours int not null default 12,task_owner_hours int not null default 24,task_admin_hours int not null default 48,high_hours int not null default 4,horizon_days int not null default 14,
 check(session_teacher_hours>=1 and session_admin_hours>=session_teacher_hours and session_admin_hours<=168),check(task_owner_hours>=1 and task_admin_hours>=task_owner_hours and task_admin_hours<=168),check(high_hours between 1 and 48),check(horizon_days between 1 and 28));
insert into private.operations_rules(id) values(true);
do $$declare t text;begin foreach t in array array['class_schedule_templates','schedule_rules','session_corrections','audit_events','notifications','pilot_config','pilot_assignments','pilot_events'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
create policy templates_read on public.class_schedule_templates for select to authenticated using(private.can_class(class_id));
create policy rules_read on public.schedule_rules for select to authenticated using(exists(select 1 from public.class_schedule_templates t where t.id=template_id));
create policy corrections_read on public.session_corrections for select to authenticated using(private.current_role()='admin' or (private.current_role()='teacher' and requested_by=auth.uid() and private.can_session(session_id)));
create policy audit_read on public.audit_events for select to authenticated using(private.current_role()='admin');
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid() and private.current_role() is not null);
create policy config_read on public.pilot_config for select to authenticated using(private.current_role() in ('teacher','admin'));
create policy pilot_scope_read on public.pilot_assignments for select to authenticated using(private.current_role()='admin' or (private.current_role()='teacher' and teacher_id=auth.uid()));
create policy metrics_read on public.pilot_events for select to authenticated using(private.current_role()='admin' or (private.current_role()='teacher' and user_id=auth.uid() and private.can_session(session_id)));
create function private.audit(p_action text,p_type text,p_id uuid,p_metadata jsonb default '{}') returns void language sql security definer set search_path='' as $$insert into public.audit_events(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),p_action,p_type,p_id,p_metadata)$$;
create function private.immutable_operation() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Immutable audit/telemetry/review history' using errcode='55000';end $$;
create trigger audit_immutable before update or delete on public.audit_events for each row execute function private.immutable_operation();
create trigger pilot_immutable before update or delete on public.pilot_events for each row execute function private.immutable_operation();
create function private.correction_guard() returns trigger language plpgsql set search_path='' as $$begin
 if TG_OP='DELETE' or OLD.status<>'pending' or NEW.session_id<>OLD.session_id or NEW.record_id is distinct from OLD.record_id or NEW.field_name<>OLD.field_name or NEW.old_value<>OLD.old_value or NEW.new_value<>OLD.new_value or NEW.reason<>OLD.reason or NEW.requested_by<>OLD.requested_by then raise exception 'Immutable correction history' using errcode='55000';end if;return NEW;
end $$;
create trigger correction_immutable before update or delete on public.session_corrections for each row execute function private.correction_guard();
create function private.notice(p_user uuid,p_type text,p_title text,p_message text,p_link text,p_entity text,p_id uuid,p_key text,p_critical boolean default false) returns void language sql security definer set search_path='' as $$
 insert into public.notifications(user_id,type,title,message,link,entity_type,entity_id,dedupe_key,critical) select p_user,p_type,p_title,p_message,p_link,p_entity,p_id,p_key,p_critical where exists(select 1 from public.profiles where id=p_user and active) on conflict(user_id,dedupe_key) do nothing
$$;
create function private.notice_admins(p_type text,p_title text,p_entity text,p_id uuid,p_key text) returns void language plpgsql security definer set search_path='' as $$declare p record;begin
 for p in select id from public.profiles where active and role='admin' loop perform private.notice(p.id,p_type,p_title,'Mở để xem và xử lý.','/admin/operations',p_entity,p_id,p_key,true);end loop;end $$;
create function private.in_pilot(p_teacher uuid,p_class uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.pilot_assignments a join public.teacher_class_assignments t using(teacher_id,class_id) join public.profiles p on p.id=a.teacher_id where a.teacher_id=p_teacher and a.class_id=p_class and p.active and p.role='teacher')$$;
create function private.operation_audit_trigger() returns trigger language plpgsql security definer set search_path='' as $$declare entity uuid; meta jsonb;begin
 if TG_TABLE_NAME='profiles' then
  if TG_OP='UPDATE' and OLD.role=NEW.role and OLD.active=NEW.active then return NEW;end if;
  entity:=NEW.id;meta:=jsonb_build_object('role',NEW.role,'active',NEW.active);
 elsif TG_TABLE_NAME='tasks' then entity:=NEW.id;meta:=jsonb_build_object('status',NEW.status,'owner_id',NEW.owner_id,'version',NEW.version);
  if TG_OP='INSERT' or OLD.owner_id is distinct from NEW.owner_id then if private.task_owner_valid(NEW.owner_id,NEW.student_id,NEW.type) then perform private.notice(NEW.owner_id,'task_assigned','Bạn có công việc mới','Mở công việc để xử lý.','/tasks/'||NEW.id,'task',NEW.id,'assigned:'||NEW.id||':'||NEW.owner_id);end if;end if;
  if NEW.status in ('done','cancelled') then update public.notifications set resolved_at=now() where entity_type='task' and entity_id=NEW.id and resolved_at is null;end if;
 elsif TG_TABLE_NAME='class_sessions' then entity:=NEW.id;meta:=jsonb_build_object('status',NEW.status,'teacher_id',NEW.teacher_id);
  if NEW.status in ('completed','cancelled') then update public.notifications set resolved_at=now() where entity_type='session' and entity_id=NEW.id and resolved_at is null;end if;
  if TG_OP='UPDATE' and NEW.status='completed' and OLD.status<>'completed' then
   insert into public.pilot_events(attempt_id,session_id,user_id,event_type,duration_seconds,student_count,exception_count,device_category)
   select e.attempt_id,e.session_id,e.user_id,'checkout_completed',extract(epoch from clock_timestamp()-e.created_at),
   (select count(*) from public.session_student_records where session_id=NEW.id),
   (select count(*) from public.session_student_records where session_id=NEW.id and (attendance<>'present' or homework_status='missing' or old_lesson_status='needs_review' or needs_attention or quick_score<(select low_score from private.teaching_rules))),e.device_category
   from public.pilot_events e where e.session_id=NEW.id and e.user_id=auth.uid() and e.event_type='checkout_opened' on conflict do nothing;
  end if;
 else entity:=NEW.id;meta:=jsonb_build_object('status',NEW.status);
 end if;
 perform private.audit(TG_TABLE_NAME||':'||lower(TG_OP),TG_TABLE_NAME,entity,meta);return NEW;
end $$;
create trigger profiles_audit after insert or update on public.profiles for each row execute function private.operation_audit_trigger();
create trigger tasks_audit after insert or update on public.tasks for each row execute function private.operation_audit_trigger();
create trigger sessions_audit after insert or update on public.class_sessions for each row execute function private.operation_audit_trigger();
create trigger corrections_audit after insert or update on public.session_corrections for each row execute function private.operation_audit_trigger();
revoke all on function private.audit(text,text,uuid,jsonb),private.immutable_operation(),private.correction_guard(),private.notice(uuid,text,text,text,text,text,uuid,text,boolean),private.notice_admins(text,text,text,uuid,text),private.in_pilot(uuid,uuid),private.operation_audit_trigger() from public;
commit;
