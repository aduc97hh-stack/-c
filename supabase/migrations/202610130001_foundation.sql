begin;
create type public.app_role as enum ('admin','teacher','cskh','media');
create type public.media_permission as enum ('yes','no','pending');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (length(trim(full_name)) between 1 and 120),
 role public.app_role not null,
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.classes (
 id uuid primary key default gen_random_uuid(), name text not null unique check (length(trim(name)) between 1 and 120),
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.students (
 id uuid primary key default gen_random_uuid(), student_code text not null unique check (length(trim(student_code)) between 1 and 40),
 full_name text not null check (length(trim(full_name)) between 1 and 120), date_of_birth date check (date_of_birth >= date '1900-01-01' and date_of_birth <= current_date),
 class_id uuid references public.classes(id) on delete restrict,
 media_permission public.media_permission not null default 'pending', active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Contact fields are isolated: RLS limits rows, not columns.
create table public.student_contacts (
 student_id uuid primary key references public.students(id) on delete cascade,
 parent_name text not null check (length(trim(parent_name)) between 1 and 120),
 parent_phone text not null check (length(parent_phone) between 6 and 24),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.teacher_class_assignments (
 teacher_id uuid not null references public.profiles(id) on delete cascade,
 class_id uuid not null references public.classes(id) on delete cascade,
 created_at timestamptz not null default now(), primary key (teacher_id,class_id)
);
create table public.cskh_student_assignments (
 cskh_id uuid not null references public.profiles(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 created_at timestamptz not null default now(), primary key (cskh_id,student_id)
);
create index students_class_idx on public.students(class_id);
create index teacher_assignment_class_idx on public.teacher_class_assignments(class_id);
create index cskh_assignment_student_idx on public.cskh_student_assignments(student_id);
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger classes_updated before update on public.classes for each row execute function public.touch_updated_at();
create trigger students_updated before update on public.students for each row execute function public.touch_updated_at();
create trigger contacts_updated before update on public.student_contacts for each row execute function public.touch_updated_at();
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create function private.current_role() returns public.app_role language sql stable security definer set search_path = '' as $$
 select role from public.profiles where id = (select auth.uid()) and active
$$;
revoke all on function private.current_role() from public;
grant execute on function private.current_role() to authenticated;
create function private.validate_assignment() returns trigger language plpgsql set search_path = '' as $$
begin
 if TG_TABLE_NAME = 'teacher_class_assignments' then
  if not exists(select 1 from public.profiles where id = new.teacher_id and role = 'teacher') then raise exception 'Teacher role required'; end if;
 else
  if not exists(select 1 from public.profiles where id = new.cskh_id and role = 'cskh') then raise exception 'CSKH role required'; end if;
 end if;
 return new;
end $$;
create trigger teacher_role before insert or update on public.teacher_class_assignments for each row execute function private.validate_assignment();
create trigger cskh_role before insert or update on public.cskh_student_assignments for each row execute function private.validate_assignment();
-- Prevent changing an assigned staff member to an incompatible role.
create function private.validate_profile_role() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.role <> old.role and (
 (new.role <> 'teacher' and exists(select 1 from public.teacher_class_assignments where teacher_id = new.id)) or
 (new.role <> 'cskh' and exists(select 1 from public.cskh_student_assignments where cskh_id = new.id))) then
 raise exception 'Remove assignments before changing role'; end if;
 return new;
end $$;
create trigger profile_role before update on public.profiles for each row execute function private.validate_profile_role();
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_contacts enable row level security;
alter table public.teacher_class_assignments enable row level security;
alter table public.cskh_student_assignments enable row level security;
revoke all on public.profiles,public.classes,public.students,public.student_contacts,public.teacher_class_assignments,public.cskh_student_assignments from anon,authenticated;
grant select,insert,update,delete on public.profiles,public.classes,public.students,public.student_contacts,public.teacher_class_assignments,public.cskh_student_assignments to authenticated;
grant all on public.profiles,public.classes,public.students,public.student_contacts,public.teacher_class_assignments,public.cskh_student_assignments to service_role;
create policy profiles_admin on public.profiles for all to authenticated using ((select private.current_role())='admin') with check ((select private.current_role())='admin');
create policy profiles_self on public.profiles for select to authenticated using (id=(select auth.uid()) and active);
create policy classes_admin on public.classes for all to authenticated using ((select private.current_role())='admin') with check ((select private.current_role())='admin');
create policy classes_teacher on public.classes for select to authenticated using ((select private.current_role())='teacher' and exists(select 1 from public.teacher_class_assignments a where a.class_id=classes.id and a.teacher_id=(select auth.uid())));
create policy students_admin on public.students for all to authenticated using ((select private.current_role())='admin') with check ((select private.current_role())='admin');
create policy students_teacher on public.students for select to authenticated using ((select private.current_role())='teacher' and exists(select 1 from public.teacher_class_assignments a where a.class_id=students.class_id and a.teacher_id=(select auth.uid())));
create policy students_cskh on public.students for select to authenticated using ((select private.current_role())='cskh' and exists(select 1 from public.cskh_student_assignments a where a.student_id=students.id and a.cskh_id=(select auth.uid())));
create policy contacts_admin on public.student_contacts for all to authenticated using ((select private.current_role())='admin') with check ((select private.current_role())='admin');
create policy contacts_cskh on public.student_contacts for select to authenticated using ((select private.current_role())='cskh' and exists(select 1 from public.cskh_student_assignments a where a.student_id=student_contacts.student_id and a.cskh_id=(select auth.uid())));
create policy teacher_assignments_admin on public.teacher_class_assignments for all to authenticated using ((select private.current_role())='admin') with check ((select private.current_role())='admin');
create policy teacher_assignments_self on public.teacher_class_assignments for select to authenticated using ((select private.current_role())='teacher' and teacher_id=(select auth.uid()));
create policy cskh_assignments_admin on public.cskh_student_assignments for all to authenticated using ((select private.current_role())='admin') with check ((select private.current_role())='admin');
create policy cskh_assignments_self on public.cskh_student_assignments for select to authenticated using ((select private.current_role())='cskh' and cskh_id=(select auth.uid()));
commit;
