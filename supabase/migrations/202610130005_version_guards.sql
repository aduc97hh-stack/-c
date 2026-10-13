begin;
create or replace function public.save_session_checkout(p_session uuid,p_version int,p_data jsonb,p_complete boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.class_sessions;r public.session_student_records;item jsonb;n int;rules private.teaching_rules;missing_count int;prefix text;begin
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
create or replace function public.update_task(p_task uuid,p_version int,p_status public.task_status,p_result text default null,p_follow_up timestamptz default null,p_owner uuid default null) returns int language plpgsql security definer set search_path='' as $$
declare t public.tasks;role public.app_role;begin
 role:=private.current_role();select * into t from public.tasks where id=p_task for update;
 if not found or (role='admin' or (role in ('teacher','cskh') and t.owner_id=auth.uid() and private.can_student(t.student_id))) is not true then raise exception 'Forbidden' using errcode='42501';end if;
 if t.status='done' and p_status='done' then return t.version;end if;
 if p_version is null or t.version<>p_version then raise exception 'Task changed' using errcode='40001';end if;
 if t.status in ('done','cancelled') or (p_status='cancelled' and role<>'admin') then raise exception 'Invalid transition';end if;
 if p_status='done' and length(trim(coalesce(p_result,'')))=0 then raise exception 'Result required';end if;
 if p_follow_up is not null and p_follow_up<=now() then raise exception 'Follow-up must be in future';end if;
 if p_owner is not null then
 if role<>'admin' or not exists(select 1 from public.profiles p where p.id=p_owner and p.active and ((t.type='teacher_review' and p.role='teacher' and exists(select 1 from public.teacher_class_assignments a join public.class_sessions s on s.class_id=a.class_id where s.id=t.source_session_id and a.teacher_id=p.id)) or (t.type<>'teacher_review' and p.role='cskh' and exists(select 1 from public.cskh_student_assignments a where a.cskh_id=p.id and a.student_id=t.student_id)))) then raise exception 'Invalid owner' using errcode='42501';end if;
 end if;
 update public.tasks set status=p_status,result=p_result,follow_up_at=p_follow_up,due_at=coalesce(p_follow_up,due_at),owner_id=coalesce(p_owner,owner_id),completed_at=case when p_status='done' then now() else null end,version=version+1,updated_by=auth.uid(),updated_at=now() where id=t.id returning version into t.version;
 perform private.emit_event(t.student_id,t.source_session_id,'task_updated','Công việc chuyển sang: '||p_status,'task:'||t.id||':'||t.version,t.id);return t.version;
end $$;
commit;
