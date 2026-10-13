create function pg_temp.same(entity text,actual text) returns void language plpgsql as $$begin if actual is distinct from (select digest from upgrade_test.snapshots where snapshots.entity=same.entity) then raise exception 'Upgrade changed Phase2 %',entity;end if;end$$;
select pg_temp.same('sessions',(select md5(jsonb_agg(to_jsonb(s)-'template_id'-'exception_reason' order by s.id)::text) from public.class_sessions s));
select pg_temp.same('records',(select md5(jsonb_agg(to_jsonb(r) order by r.id)::text) from public.session_student_records r));
select pg_temp.same('notes',(select md5(jsonb_agg(to_jsonb(n) order by n.record_id)::text) from public.record_notes n));
select pg_temp.same('attachments',(select md5(jsonb_agg(to_jsonb(a) order by a.id)::text) from public.session_attachments a));
select pg_temp.same('events',(select md5(jsonb_agg(to_jsonb(e) order by e.id)::text) from public.student_events e));
select 'Existing Phase1/2 records/notes/events/attachments upgrade preserved PASS' result;
