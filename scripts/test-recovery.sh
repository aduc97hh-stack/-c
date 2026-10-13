#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="gami-recovery-${RANDOM}-$$"
backup_dir=$(mktemp -d /tmp/gami-recovery.XXXXXX)
trap 'docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf "$backup_dir"' EXIT
umask 077
docker run --rm -d --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
ready=false
for attempt in {1..30}; do
 if docker exec "$container" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then ready=true; break; fi
 sleep 1
done
[ "$ready" = true ]
for file in tests/db-bootstrap.sql supabase/migrations/*.sql tests/db-fixture.sql tests/upgrade-fixture.sql; do
 docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres < "$file" >/dev/null
done
docker exec "$container" pg_dump -U postgres -Fc postgres > "$backup_dir/fixture.dump"
docker exec "$container" createdb -U postgres gami_restored
docker exec -i "$container" pg_restore -U postgres -d gami_restored --no-owner --single-transaction --exit-on-error < "$backup_dir/fixture.dump"
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d gami_restored <<'SQL'
do $$begin
 if (select count(*) from public.class_sessions where status='completed' and lesson_content='upgrade-marker')<>1 or (select count(*) from public.session_student_records)<>5 or (select count(*) from public.session_attachments)<>1 then raise exception 'Restore incomplete';end if;
 if not exists(select 1 from pg_policies where tablename='notifications') or not exists(select 1 from storage.buckets where id='session-attachments' and not public) then raise exception 'Restore policies/storage contract missing';end if;
end $$;
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
do $$begin if (select count(*) from public.class_sessions)<>0 or (select count(*) from public.record_notes)<>0 then raise exception 'Restored RLS lost isolation';end if;end $$;
select 'Local synthetic pg_dump/pg_restore + RLS recovery PASS' result;
SQL
