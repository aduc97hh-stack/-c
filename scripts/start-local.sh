#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
chmod 644 scripts/local/bootstrap.sql
node scripts/setup-local.mjs
docker compose --env-file .local/stack.env -f scripts/local/compose.yml up -d --wait
docker compose --env-file .local/stack.env -f scripts/local/compose.yml up -d --wait --force-recreate gateway
node scripts/local-ready.mjs
node scripts/migrate-local.mjs
npm run seed -- --if-empty
node --env-file=.env.local scripts/seed-teaching.mjs
