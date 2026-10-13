begin;

-- Hosted Supabase hardening: unauthenticated callers must never execute
-- SECURITY DEFINER RPCs exposed through the public schema.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', r.signature);
  end loop;
end
$$;

-- This view should obey the querying user's RLS context.
alter view public.effective_session_records set (security_invoker = true);

commit;
