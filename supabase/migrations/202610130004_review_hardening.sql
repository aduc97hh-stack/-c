begin;
-- Current teachers can read completed academic history after a class transfer;
-- private notes remain restricted to the originating session's class.
drop policy records_read on public.session_student_records;
create policy records_read on public.session_student_records for select to authenticated using(private.can_session(session_id) or (private.current_role() in ('teacher','cskh') and private.can_student(student_id) and private.completed_session(session_id)));
create function public.teaching_configuration() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if private.current_role() is null or private.current_role()='media' then raise exception 'Forbidden' using errcode='42501';end if;
 return (select to_jsonb(r)-'id' from private.teaching_rules r);
end $$;
revoke all on function public.teaching_configuration() from public;
grant execute on function public.teaching_configuration() to authenticated;
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
 'unassigned',(select count(*) from public.tasks t where status not in ('done','cancelled') and (owner_id is null or not exists(select 1 from public.profiles p where p.id=t.owner_id and p.active) or (t.type='teacher_review' and not exists(select 1 from public.students st join public.teacher_class_assignments ta on ta.class_id=st.class_id where st.id=t.student_id and ta.teacher_id=t.owner_id)) or (t.type<>'teacher_review' and not exists(select 1 from public.cskh_student_assignments a where a.cskh_id=t.owner_id and a.student_id=t.student_id)))));
 return result;
end $$;
commit;
