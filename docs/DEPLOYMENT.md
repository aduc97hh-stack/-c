# Deployment — Phase 3 staging / production pilot

## Current evidence and boundaries

Local Auth/PostgREST/Storage, fresh migrations and upgrade from Phase2 are tested. No hosted Supabase project, deployment platform account, HTTPS domain or cloud backup binding has been supplied/verified. This document prepares deployment; it does not claim cloud deployment or live scheduler.

Use a separate **staging Supabase project** with synthetic data. Production is another project with real staff provisioned explicitly. Do not run demo seed in production. Preserve project refs and migration history; never reset a project with real data.

## Required secure settings

- `NEXT_PUBLIC_SUPABASE_URL`: staging HTTPS project URL, then production URL in a separate environment.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: corresponding public/anon key. Rebuild after changing NEXT_PUBLIC values.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only runtime secret, never NEXT_PUBLIC or client bundle. Web use remains validated Storage upload/cleanup; dedicated operations runner calls only `run_scheduled_operations`. Never use this key for user business queries or auth authorization.
- Supabase migration access: project-ref, CLI login/link and database owner access managed through secure deployment tooling. Use credential bindings or libpq service files, not literals in commands/chat or repository.
- Hosting account/project and HTTPS app domain; Auth site URL and redirect allowlist must match exact HTTPS domain. Disable public signup; provision Auth users and active `profiles` with explicit role/assignment. MFA for admin and password/rate-limit settings need operations review.
- `GAMI_SEED_PASSWORD` and `GAMI_ALLOW_DEMO_SEED=yes` only in a dedicated local/staging demo provisioning job; not production web runtime.
- PILOT_MODE is **database config**, changed in `/admin/operations`; no conflicting environment flag. Select valid teacher/class pairs before enabling pilot mode.

## Migrations and deployment order

1. Capture verified backup/restore point and private Storage object backup per BACKUP_RECOVERY.md.
2. Review `001–011` and compare target history (`supabase migration list`). Existing `001–007` are immutable. `008–011` introduce operations, amendments, audit/notifications/telemetry and hardening.
3. `supabase link --project-ref <staging-ref>` using secure CLI binding, `supabase db push --dry-run`, then reviewed `supabase db push`. Never print the connection URI/token. Existing completed rows stay untouched; amendments project effective data.
4. Verify private schema is not API-exposed; RLS enabled, authenticated SELECT-only for new tables, mutations through RPC, scheduled function EXEC only service_role. Effective view exposes only scoped academic fields; correction values/reasons stay teacher owner/admin.
5. Verify `session-attachments` is private and Storage SELECT scoped; no authenticated insert/update to bypass byte validation. Upload body limit ≥41 MiB and adequate memory/stream timeout on host. MP4 viewer streams full file; range/large-file CDN/transcoding is outside this scope.
6. Deploy Node22+ web runtime (24 tested), `npm ci`, `npm run build`, `npm start`. Use a Node-capable host with server actions and streaming; this is not a static export. Example supported approach: container/VM behind HTTPS reverse proxy with 41MiB body limit; validate chosen managed-host limits before selection.
7. Test `/api/health` (Auth/REST/Storage reachability), anonymous protected routes, six-role auth/RLS, private upload/download, schedule conflict, correction, audit and telemetry on staging with synthetic fixtures. Do not run this repository's local-only E2E directly against production.
8. Configure operational scheduler, then 1–2 pilot pairs for one week. Confirm manual iPhone Add to Home Screen and real checkout measurement. Remove demo fixtures from production by provisioning a clean production project, not deleting histories ad hoc.

## Deterministic scheduler

Admin can run the same engine through **Chạy vận hành ngay**. Automatic execution requires a real scheduler; it is not enabled by saving repository code.

Preferred managed Supabase with pg_cron enabled (database owner, reviewed SQL):

```sql
select cron.schedule('gami-operations', '*/10 * * * *',
  $$select private.run_operations(now());$$);
```

Check `cron.job_run_details` for success/failure, alert on failures/no successful run for >30min. Central thresholds are editable by admin; defaults session2h/12h, task24h/48h, high4h, horizon14days. Advisory locks and unique recipient+dedupe keys allow concurrent/manual retries. When PILOT_MODE is ON, new recurrence/escalation is scoped to selected valid pairs; Phase2 checkout remains available elsewhere, correction requests restricted to pilot teachers/classes. Tasks outside pilot class do not receive pilot escalation.

Alternative private runner (Node22+, secure service binding, never browser):

```bash
node scripts/run-operations.mjs
```

Schedule every10min using hosting scheduler. Output contains only event tag/time/counts or sanitized error code; never token, notes, contacts or signed URL. Do not expose runner as a public unauthenticated HTTP endpoint.

## Observability and rollback

- `/api/health` returns limited service reachability status, no credentials; it is not proof of RLS/business correctness.
- Admin audit, correction status, owner exceptions, critical unread and pilot save error count support triage. Logs use operation/code categories, no request payloads or bearer URLs. Configure platform error log access/retention and alerts; no external monitoring vendor is configured here.
- If pilot issues arise: set PILOT_MODE ON with only validated pairs or remove a failing pair; preserve completed history/audit. Pause scheduler when needed. Restore previous app artifact only if compatible with deployed additive schema; Phase2 app would ignore amendments, so do not serve Phase2 after corrections have been approved. Prefer a forward fix or freeze writes while restoring a validated backup into a separate project.
- Never down-migrate/drop new tables or overwrite completed rows to “undo” an approval. Request a new audited correction to reverse a mistaken amendment. Review stale old/new values before approval; approvals are transactional and replay-safe.
