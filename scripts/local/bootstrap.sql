-- Only the local test stack: Supabase-managed roles/contracts for plain PostgreSQL.
\getenv pgpassword POSTGRES_PASSWORD
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator noinherit login password :'pgpassword';
grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin noinherit login password :'pgpassword';
create schema auth authorization supabase_auth_admin;
alter role supabase_auth_admin set search_path=auth,public;
grant usage on schema auth to anon,authenticated,service_role;
