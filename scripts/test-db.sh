#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="gami-rls-${RANDOM}-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
start_database() {
 docker run --rm -d --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
 local ready=false
 for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
 done
 if [ "$ready" != true ]; then docker logs "$container"; exit 1; fi
}
apply_sql() { docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres < "$1"; }
start_database
for file in tests/db-bootstrap.sql supabase/migrations/*.sql tests/db-fixture.sql tests/rls.sql tests/teaching.sql tests/operations.sql; do apply_sql "$file"; done
# Second isolated cluster: apply 001-007, create completed Phase2 history, then upgrade.
docker rm -f "$container" >/dev/null
container="gami-upgrade-${RANDOM}-$$"
start_database
apply_sql tests/db-bootstrap.sql
for file in supabase/migrations/20261013000{1,2,3,4,5,6,7}_*.sql; do apply_sql "$file"; done
apply_sql tests/db-fixture.sql
apply_sql tests/upgrade-fixture.sql
for file in supabase/migrations/2026101300{08,09,10,11}_*.sql; do apply_sql "$file"; done
apply_sql tests/upgrade-verify.sql
