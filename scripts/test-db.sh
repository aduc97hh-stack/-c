#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="gami-rls-${RANDOM}-$$"
# No published ports. Trust authentication is scoped to this disposable container.
docker run --rm -d --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
ready=false
for attempt in {1..30}; do
 if docker exec "$container" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then ready=true; break; fi
 sleep 1
done
if [ "$ready" != true ]; then docker logs "$container"; exit 1; fi
for file in tests/db-bootstrap.sql supabase/migrations/*.sql tests/db-fixture.sql tests/rls.sql tests/teaching.sql; do
 docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres < "$file"
done
