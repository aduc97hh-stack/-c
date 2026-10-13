set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select public.create_class_session('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','2020-01-01 01:00+00','2020-01-01 02:00+00','Upgrade historical fixture') as sid \gset
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
select public.start_class_session(:'sid');
reset role;
insert into public.session_attachments(session_id,uploaded_by,storage_path,mime_type,size_bytes) values(:'sid','10000000-0000-0000-0000-000000000002',:'sid'||'/51000000-0000-0000-0000-000000000009.png','image/png',100);
set role authenticated;
select public.save_session_checkout(:'sid',1,(select jsonb_build_object('lesson_content','upgrade-marker','homework_assigned','upgrade-homework','records',jsonb_agg(jsonb_build_object('student_id',student_id,'attendance','present','homework_status','done','old_lesson_status','passed','quick_score',null,'needs_attention',false,'attention_reasons','[]'::jsonb,'teacher_note','upgrade-private-note'))) from public.session_student_records where session_id=:'sid'),true);
reset role;
create schema upgrade_test;
create table upgrade_test.snapshots(entity text primary key,digest text);
insert into upgrade_test.snapshots values
 ('sessions',(select md5(jsonb_agg(to_jsonb(s) order by s.id)::text) from public.class_sessions s)),
 ('records',(select md5(jsonb_agg(to_jsonb(r) order by r.id)::text) from public.session_student_records r)),
 ('notes',(select md5(jsonb_agg(to_jsonb(n) order by n.record_id)::text) from public.record_notes n)),
 ('attachments',(select md5(jsonb_agg(to_jsonb(a) order by a.id)::text) from public.session_attachments a)),
 ('events',(select md5(jsonb_agg(to_jsonb(e) order by e.id)::text) from public.student_events e));
