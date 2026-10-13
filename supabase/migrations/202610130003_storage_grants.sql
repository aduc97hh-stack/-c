begin;
-- Standard Storage API role grants; RLS remains the authorization boundary.
grant usage on schema storage to anon,authenticated,service_role;
grant select on storage.buckets to anon,authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
grant all on all tables in schema storage to service_role;
grant usage,select on all sequences in schema storage to service_role;
commit;
