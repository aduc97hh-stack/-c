begin;
create function private.corrected_value(p_session uuid,p_record uuid,p_field text,p_original text) returns text language plpgsql stable security definer set search_path='' as $$begin
 if private.can_session(p_session) is not true and (p_field in ('teacher_note','lesson_content','homework_assigned') or not exists(select 1 from public.session_student_records r where r.id=p_record and r.session_id=p_session and private.can_student(r.student_id) and private.completed_session(p_session))) then raise exception 'Forbidden' using errcode='42501';end if;
 return coalesce((select c.new_value from public.session_corrections c where c.session_id=p_session and c.record_id is not distinct from p_record and c.field_name=p_field and c.status='approved' order by c.reviewed_at desc,c.id desc limit 1),p_original);
end $$;
-- Explicit column projection: no correction reason or private notes in academic view.
create view public.effective_session_records with(security_barrier=true) as
 select r.id,r.session_id,r.student_id,
 private.corrected_value(r.session_id,r.id,'attendance',r.attendance::text)::public.attendance_status attendance,
 private.corrected_value(r.session_id,r.id,'homework_status',r.homework_status::text)::public.homework_status homework_status,
 private.corrected_value(r.session_id,r.id,'old_lesson_status',r.old_lesson_status::text)::public.old_lesson_status old_lesson_status,
 nullif(private.corrected_value(r.session_id,r.id,'quick_score',coalesce(r.quick_score::text,'')),'')::numeric quick_score,
 private.corrected_value(r.session_id,r.id,'needs_attention',r.needs_attention::text)::boolean needs_attention,
 case when private.corrected_value(r.session_id,r.id,'needs_attention',r.needs_attention::text)::boolean then case when cardinality(r.attention_reasons)>0 then r.attention_reasons else array['other']::text[] end else '{}'::text[] end attention_reasons,
 r.created_at,r.updated_at
 from public.session_student_records r where private.can_session(r.session_id) or (private.current_role() in ('teacher','cskh') and private.can_student(r.student_id) and private.completed_session(r.session_id));
revoke all on public.effective_session_records from public,anon,authenticated;
grant select on public.effective_session_records to authenticated;
create function public.session_effective_content(p_session uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare s public.class_sessions;begin
 if private.can_session(p_session) is not true then raise exception 'Forbidden' using errcode='42501';end if;
 select * into s from public.class_sessions where id=p_session;
 return jsonb_build_object('lesson_content',private.corrected_value(s.id,null,'lesson_content',s.lesson_content),'homework_assigned',private.corrected_value(s.id,null,'homework_assigned',s.homework_assigned),
 'notes',(select coalesce(jsonb_agg(jsonb_build_object('record_id',r.id,'teacher_note',private.corrected_value(s.id,r.id,'teacher_note',coalesce(n.teacher_note,'')))),'[]') from public.session_student_records r left join public.record_notes n on n.record_id=r.id where r.session_id=s.id));
end $$;
create function private.current_correction_value(p_session uuid,p_record uuid,p_field text) returns text language plpgsql stable security definer set search_path='' as $$declare r public.session_student_records;s public.class_sessions;original text;begin
 select * into s from public.class_sessions where id=p_session;
 if p_record is not null then select * into r from public.session_student_records where id=p_record and session_id=p_session;if not found then raise exception 'Record outside session';end if;end if;
 original:=case p_field when 'attendance' then r.attendance::text when 'homework_status' then r.homework_status::text when 'old_lesson_status' then r.old_lesson_status::text when 'quick_score' then coalesce(r.quick_score::text,'') when 'needs_attention' then r.needs_attention::text when 'teacher_note' then coalesce((select teacher_note from public.record_notes where record_id=p_record),'') when 'lesson_content' then s.lesson_content when 'homework_assigned' then s.homework_assigned else null end;
 if original is null then raise exception 'Unsupported correction field';end if;
 return private.corrected_value(p_session,p_record,p_field,original);
end $$;
create function public.request_correction(p_session uuid,p_record uuid,p_field text,p_value text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$declare s public.class_sessions;old text;result uuid;grade numeric;begin
 select * into s from public.class_sessions where id=p_session for update;
 if not found or s.status<>'completed' or (private.current_role()='admin' or (private.current_role()='teacher' and s.teacher_id=auth.uid() and private.can_class(s.class_id))) is not true then raise exception 'Forbidden' using errcode='42501';end if;
 if private.current_role()='teacher' and (select pilot_mode from public.pilot_config) and private.in_pilot(auth.uid(),s.class_id) is not true then raise exception 'Class outside pilot';end if;
 if (p_field in ('lesson_content','homework_assigned')) is distinct from (p_record is null) then raise exception 'Invalid field target';end if;
 old:=private.current_correction_value(p_session,p_record,p_field);
 if p_value is null or old=p_value then raise exception 'Value must change';end if;
 case p_field
 when 'attendance' then perform p_value::public.attendance_status;
 when 'homework_status' then perform p_value::public.homework_status;
 when 'old_lesson_status' then perform p_value::public.old_lesson_status;
 when 'quick_score' then if p_value<>'' then grade:=p_value::numeric;if grade<0 or grade>10 or grade='NaN'::numeric then raise exception 'Invalid grade';end if;end if;
 when 'needs_attention' then if p_value not in ('true','false') then raise exception 'Invalid flag';end if;
 when 'teacher_note' then if length(p_value)>2000 then raise exception 'Note too long';end if;
 when 'homework_assigned' then if length(p_value)>2000 then raise exception 'Homework too long';end if;
 when 'lesson_content' then if length(p_value)>5000 then raise exception 'Lesson too long';end if;
 else raise exception 'Unsupported field';end case;
 insert into public.session_corrections(session_id,record_id,field_name,old_value,new_value,reason,requested_by) values(p_session,p_record,p_field,old,p_value,p_reason,auth.uid()) returning id into result;
 perform private.notice_admins('correction','Có yêu cầu chỉnh sửa buổi học','correction',result,'correction:'||result);
 return result;
end $$;
create function private.reconcile_student(p_student uuid,p_origin uuid) returns void language plpgsql security definer set search_path='' as $$
declare rules private.teaching_rules;kind public.task_type;candidate public.session_student_records;ss public.class_sessions;anchor timestamptz;missing int;needs boolean;t public.tasks;begin
 perform 1 from public.students where id=p_student for update;
 select * into rules from private.teaching_rules;
 select max(s.starts_at) into anchor from public.session_student_records r join public.class_sessions s on s.id=r.session_id where r.student_id=p_student and s.status='completed';
 for kind in select unnest(enum_range(null::public.task_type)) loop
  select e.* into candidate from public.effective_session_records e join public.class_sessions s on s.id=e.session_id where e.student_id=p_student and s.status='completed' and s.starts_at between anchor-make_interval(days=>rules.window_days) and anchor and
   case kind when 'homework_followup' then e.homework_status='missing' when 'absence_followup' then e.attendance='absent_unexcused' when 'low_score_followup' then e.quick_score<rules.low_score when 'teacher_review' then e.quick_score<rules.low_score or e.old_lesson_status='needs_review' else e.needs_attention end order by s.starts_at desc,e.id limit 1;
  needs:=found;
  if needs then
   select * into ss from public.class_sessions where id=candidate.session_id;
   select count(*) into missing from public.effective_session_records e join public.class_sessions s on s.id=e.session_id where e.student_id=p_student and e.homework_status='missing' and s.status='completed' and s.starts_at between anchor-make_interval(days=>rules.window_days) and anchor;
   perform private.emit_task(candidate,ss,kind,case when kind='homework_followup' and missing>=rules.repeat_count then 'high'::public.task_priority else 'normal'::public.task_priority end);
   if kind='homework_followup' then update public.tasks set priority=case when missing>=rules.repeat_count then 'high'::public.task_priority else 'normal'::public.task_priority end where student_id=p_student and type=kind and status not in ('done','cancelled') and priority<>'urgent';end if;
  else
   for t in select * from public.tasks where student_id=p_student and type=kind and source_record_id is not null and status not in ('done','cancelled') for update loop
    update public.tasks set status='cancelled',result='Reconciled after approved correction',version=version+1,updated_by=auth.uid(),updated_at=now() where id=t.id;
    perform private.emit_event(p_student,p_origin,'task_updated','Công việc được đối chiếu sau chỉnh sửa','correction-task:'||t.id||':'||(t.version+1),t.id);
   end loop;
  end if;
 end loop;
end $$;
create function public.review_correction(p_id uuid,p_approve boolean,p_note text default '') returns void language plpgsql security definer set search_path='' as $$declare c public.session_corrections;r public.session_student_records;begin
 if private.current_role() is distinct from 'admin' or p_approve is null then raise exception 'Forbidden' using errcode='42501';end if;
 select * into c from public.session_corrections where id=p_id;
 if not found then raise exception 'Unknown correction';end if;
 perform 1 from public.class_sessions where id=c.session_id for update;
 if c.record_id is not null then select * into r from public.session_student_records where id=c.record_id;perform 1 from public.students where id=r.student_id for update;end if;
 select * into c from public.session_corrections where id=p_id for update;
 if c.status=(case when p_approve then 'approved' else 'rejected' end) then return;end if;
 if c.status<>'pending' then raise exception 'Already reviewed';end if;
 if p_approve and private.current_correction_value(c.session_id,c.record_id,c.field_name)<>c.old_value then raise exception 'Correction stale' using errcode='40001';end if;
 if not p_approve and length(trim(coalesce(p_note,'')))<5 then raise exception 'Rejection reason required';end if;
 update public.session_corrections set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note=p_note where id=p_id;
 if p_approve and c.record_id is not null then
  if c.field_name<>'teacher_note' then perform private.reconcile_student(r.student_id,c.session_id);end if;
  perform private.emit_event(r.student_id,c.session_id,'task_updated','Đã duyệt chỉnh sửa dữ liệu buổi học','correction:'||c.id);
 end if;
 update public.notifications set resolved_at=now() where entity_type='correction' and entity_id=c.id;
 perform private.notice(c.requested_by,'correction_result','Yêu cầu chỉnh sửa đã được xử lý',case when p_approve then 'Đã phê duyệt.' else 'Đã từ chối. Mở buổi học để xem.' end,'/teacher/sessions/'||c.session_id,'correction',c.id,'reviewed:'||c.id);
end $$;
-- Existing completion rules must also read amendments for repeat thresholds.
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
 select count(*) into missing_count from public.effective_session_records rr join public.class_sessions ss on ss.id=rr.session_id where rr.student_id=r.student_id and rr.homework_status='missing' and ss.status='completed' and ss.starts_at between anchor-make_interval(days=>rules.window_days) and anchor;
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
create or replace function public.student_pulse(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rules private.teaching_rules;missing int;low int;issues int;overdue int;high int;open_tasks int;reasons text[]:='{}';color text:='green';begin
 if not private.can_student(p_student) then raise exception 'Forbidden' using errcode='42501';end if;
 select * into rules from private.teaching_rules;
 select count(*) filter(where r.homework_status='missing'),count(*) filter(where r.quick_score<rules.low_score),count(*) filter(where r.needs_attention or r.attendance<>'present' or r.homework_status='missing' or r.quick_score<rules.low_score) into missing,low,issues from public.effective_session_records r join public.class_sessions s on s.id=r.session_id where r.student_id=p_student and s.status='completed' and s.starts_at>=now()-make_interval(days=>rules.window_days);
 select count(*),count(*) filter(where due_at<now()),count(*) filter(where priority in ('high','urgent')) into open_tasks,overdue,high from public.tasks where student_id=p_student and status not in ('done','cancelled');
 if missing>=rules.repeat_count then reasons:=array_append(reasons,missing||' lần thiếu BTVN trong '||rules.window_days||' ngày');color:='red';end if;
 if low>=rules.repeat_count then reasons:=array_append(reasons,low||' lần điểm thấp');color:='red';end if;
 if overdue>0 then reasons:=array_append(reasons,overdue||' task quá hạn');color:='red';end if;
 if high>0 then reasons:=array_append(reasons,high||' task ưu tiên cao');color:='red';end if;
 if issues>0 then reasons:=array_append(reasons,issues||' buổi có lưu ý gần đây');if color='green' then color:='yellow';end if;end if;
 if open_tasks>0 then reasons:=array_append(reasons,open_tasks||' công việc đang mở');if color='green' then color:='yellow';end if;end if;
 return jsonb_build_object('color',color,'reasons',reasons);
end $$;
revoke all on function private.corrected_value(uuid,uuid,text,text),private.current_correction_value(uuid,uuid,text),private.reconcile_student(uuid,uuid) from public;
revoke all on function public.session_effective_content(uuid),public.request_correction(uuid,uuid,text,text,text),public.review_correction(uuid,boolean,text) from public;
grant execute on function private.corrected_value(uuid,uuid,text,text) to authenticated;
grant execute on function public.session_effective_content(uuid),public.request_correction(uuid,uuid,text,text,text),public.review_correction(uuid,boolean,text) to authenticated;
commit;
