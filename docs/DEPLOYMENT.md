# Deployment — Phase 3 staging / production pilot

## Current evidence and boundaries

Owner-facing execution guide: [STAGING_STEP_BY_STEP_VI.md](STAGING_STEP_BY_STEP_VI.md). PR#3 readiness was merged at main20f73a62fc43cca0766b0a5f218d3575f7dcebd1. Minimal staged provisioning uses `scripts/seed-staging.mjs` with explicit staging project allowlist and three distinct protected passwords; old demo seed scripts are now local-only. Never place provisioning passwords/permission flags in the web runtime. The new guide/tools are delivered on a separate execution-plan PR until reviewed.

Local Auth/PostgREST/Storage, fresh migrations and upgrade from Phase2 are tested. No hosted Supabase project, deployment platform account, HTTPS domain or cloud backup binding has been supplied/verified. This document prepares deployment; it does not claim cloud deployment or live scheduler.

Use a separate **staging Supabase project** with synthetic data. Production is another project with real staff provisioned explicitly. Do not run demo seed in production. Preserve project refs and migration history; never reset a project with real data.

## Required secure settings

Keep separate hosting environments, Supabase projects and operator records for local, staging and production. No staging deployment may receive production bindings. `supabase/config.toml` is **local CLI configuration** (loopback Auth URL and disabled local Storage); do not copy those Auth/Storage settings into a hosted project. Hosted settings are configured explicitly below; `db push` applies database migrations, not hosted Auth URL or backup configuration.

- `NEXT_PUBLIC_SUPABASE_URL`: staging HTTPS project URL, then production URL in a separate environment.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: corresponding public/anon key. Rebuild after changing NEXT_PUBLIC values.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only runtime secret, never NEXT_PUBLIC or client bundle. Web use remains validated Storage upload/cleanup; dedicated operations runner calls only `run_scheduled_operations`. Never use this key for user business queries or auth authorization.
- Supabase migration access: project-ref, CLI login/link and database owner access managed through secure deployment tooling. Use credential bindings or libpq service files, not literals in commands/chat or repository.
- Hosting account/project and HTTPS app domain; Auth site URL and redirect allowlist must match exact HTTPS domain. Disable public signup; provision Auth users and active `profiles` with explicit role/assignment. MFA for admin and password/rate-limit settings need operations review.
- `GAMI_SEED_PASSWORD` and `GAMI_ALLOW_DEMO_SEED=yes` only in a dedicated local/staging demo provisioning job; not production web runtime.
- PILOT_MODE is **database config**, changed in `/admin/operations`; no conflicting environment flag. Select valid teacher/class pairs before enabling pilot mode.

Hosted preflight metadata: `GAMI_DEPLOY_ENVIRONMENT=staging` (or `production`), `GAMI_APP_URL` equal to the exact HTTPS app origin, and `SUPABASE_PROJECT_REF` equal to that environment's project ref. These three names are deployment checks, not new business flags. Keep `GAMI_SEED_PASSWORD` unset and `GAMI_ALLOW_DEMO_SEED=no` in web/runner runtime. Provision synthetic accounts in a separate, explicitly authorized staging job.

From the hosting environment with secure bindings already injected:

```bash
node scripts/check-deployment.mjs
npm ci
npm run build
npm start -- --hostname 127.0.0.1
```

Preflight prints only status/error categories and binding names, never values. It rejects HTTP/loopback/non-origin URLs, wrong standard Supabase project URL, JWT role/ref/expiry mixups, public secret bindings, seed credentials and conflicting Vercel environment classification. Legacy JWT claims are metadata checks, **not signature verification**. Modern publishable/secret keys are opaque: their project cannot be established offline; confirm project membership in secure provider settings and authenticated staging smoke tests. Custom Supabase domains require a separately reviewed matching check; this preparation uses the standard project-ref.supabase.co origin.

No deployment is authorized by preflight PASS alone. Build does not need Docker or reachable Supabase; CI builds before starting services. Actual web functionality still needs valid runtime bindings. NEXT_PUBLIC values are baked into client artifacts: build staging and production separately, never promote a staging public-key bundle into production unchanged.

## Migrations and deployment order

1. Capture verified backup/restore point and private Storage object backup per BACKUP_RECOVERY.md.
2. Review `001–011` and compare target history (`supabase migration list`). Existing `001–007` are immutable. `008–011` introduce operations, amendments, audit/notifications/telemetry and hardening.
3. `supabase link --project-ref <staging-ref>` using secure CLI binding, `supabase db push --dry-run`, then reviewed `supabase db push`. Never print the connection URI/token. Existing completed rows stay untouched; amendments project effective data.
4. Verify private schema is not API-exposed; RLS enabled, authenticated SELECT-only for new tables, mutations through RPC, scheduled function EXEC only service_role. Effective view exposes only scoped academic fields; correction values/reasons stay teacher owner/admin.
5. Verify `session-attachments` is private and Storage SELECT scoped; no authenticated insert/update to bypass byte validation. Upload body limit ≥41 MiB and adequate memory/stream timeout on host. MP4 viewer streams full file; range/large-file CDN/transcoding is outside this scope.
6. Deploy Node22+ web runtime (24 tested), `npm ci`, `npm run build`, `npm start`. Use a Node-capable host with server actions and streaming; this is not a static export. Example supported approach: container/VM behind HTTPS reverse proxy with 41MiB body limit; validate chosen managed-host limits before selection.
7. Test `/api/health` (Auth/REST/Storage reachability), anonymous protected routes, six-role auth/RLS, private upload/download, schedule conflict, correction, audit and telemetry on staging with synthetic fixtures. Do not run this repository's local-only E2E directly against production.
8. Configure operational scheduler, then 1–2 pilot pairs for one week. Confirm manual iPhone Add to Home Screen and real checkout measurement. Remove demo fixtures from production by provisioning a clean production project, not deleting histories ad hoc.

For an existing current-main database at Phase3, 001–011 are already applied and this staging-readiness branch adds **no migration**. Verify history and checksums, expect a no-op dry run, and do not reapply historical SQL manually. For a new hosted project, apply 001→011 in filename order; 002 creates the private attachment bucket, 003 grants Storage access under RLS, 007 changes legacy cache metadata to no-store, and 011 restricts privileged operations writes. Policy/function replacement and the cache metadata update are intentional; there is no DROP/TRUNCATE of business tables. Review any pre-existing bucket/policy conflict before pushing.

CLI staging preparation (placeholders are project identifiers, never credentials):

```bash
supabase link --project-ref <verified-staging-ref>
supabase migration list
supabase db push --dry-run
```

Pin the organization's reviewed Supabase CLI version in deployment tooling. Read the dry-run list before an authorized push; store only sanitized migration filenames/status with release SHA. Do not use migration repair to mark unexecuted SQL as applied. CLI login/database access must use secure bindings or interactive provider authentication; no password argument in shared shell history/logs.

## Hosting choice and HTTPS

**Default: a Node24 VM/container host behind an HTTPS reverse proxy**, with ≥41 MiB request body support, sufficient upload memory and request timeouts, streaming downloads and private server secrets. The repository uses standard Next build/start; no localhost/cloud domain is hardcoded in application routing. Bind Node to loopback, expose only HTTPS through the proxy, preserve the original Host and trusted X-Forwarded-Proto, and reject direct upstream access. Do not add wildcard Server Action allowed origins to work around proxy errors. Test login redirects stay on the exact HTTPS origin and upload Origin checks pass.

For nginx, set `client_max_body_size 41m` and forwarding Host/protocol headers in the reviewed HTTPS vhost. Use real certificate issuance/renewal, no TLS verification bypass. Redact query strings, cookies, authorization and bodies from proxy/platform logs; restrict access and retention. Upload smoke must exercise a valid near-limit image/video, not just a tiny fixture.

**Vercel:** standard Next build/SSR/routes are compatible, with separate Preview/staging and Production variable scopes and Node24 selected. However, [Vercel Functions request body limits](https://vercel.com/docs/functions/limitations#request-body-size) are substantially below the current 40 MiB MP4 contract. Next's 41mb setting does not raise the platform limit. Full staging upload acceptance on Vercel is blocked until the current route's actual limits are verified or a reviewed equivalent host supports it. Do not shrink accepted uploads or invent direct browser Storage writes to claim readiness. No vercel.json/public cron endpoint or deployment has been added.

## Hosted Auth and Storage acceptance

- Auth Site URL = exact staging HTTPS origin. Allow only exact approved redirect URLs; no localhost, arbitrary preview wildcard or production origin in staging. Current password login redirects to server-selected role paths and accepts no caller-supplied next URL. Any future OAuth/reset URL requires a new review; it is not implemented here.
- Disable public signup, provision the actual Auth UUID→profile role/active/class/CSKH assignments, and verify account suspension with an existing session. Managed Auth SMTP/confirmation settings are provider configuration, not copied from local test settings.
- Confirm Storage bucket `session-attachments`: `public=false`, max41943040 bytes, MIME JPEG/PNG/WEBP/MP4; image app limit10 MiB, video40 MiB. Only validated server upload/cleanup uses privileged key. Caller JWT/RLS controls metadata and signed download, and the proxy returns private/no-store. Ordinary SDK writes must remain denied; CSKH/media/wrong-class teacher cannot download. A server-held signed capability lasts up to60s; it is never returned as a public cached link.
- API exposes `public` only; `private` helper schema stays unexposed. Service scheduled RPC EXEC remains restricted, and direct new operations table writes remain denied even with service role.
- Smoke `/api/health`: 200 `{status:ok}` when Auth/REST/Storage reachable, 503 `{status:unavailable}` on dependency failure, always private/no-store. This public minimal endpoint has no debug payload, secrets or PII; apply host rate limits and alerting. It proves reachability, not all business authorization.

Record provider-specific results and blockers in [STAGING_CHECKLIST.md](STAGING_CHECKLIST.md). Run the actual iPhone/pilot procedure in [PILOT_RUNBOOK.md](PILOT_RUNBOOK.md).

## Deterministic scheduler

Admin can run the same engine through **Chạy vận hành ngay**. Automatic execution requires a real scheduler; it is not enabled by saving repository code.

Preferred managed Supabase with pg_cron enabled (database owner, reviewed SQL):

```sql
select cron.schedule('gami-operations', '*/10 * * * *',
  $$select private.run_operations(now());$$);
```

Check `cron.job_run_details` for success/failure, alert on failures/no successful run for >30min. Central thresholds are editable by admin; defaults session2h/12h, task24h/48h, high4h, horizon14days. Advisory locks and unique recipient+dedupe keys allow concurrent/manual retries. When PILOT_MODE is ON, new recurrence/escalation is scoped to selected valid pairs; Phase2 checkout remains available elsewhere, correction requests restricted to pilot teachers/classes. Tasks outside pilot class do not receive pilot escalation.

Enable Supabase Cron/pg_cron through the provider before scheduling; the SQL is a setup plan, not proof a job exists. DB-owner execution avoids an HTTP endpoint and external auth secret: limit SQL/job management to trusted operators, revoke ordinary users' ability to edit cron jobs. Check for an existing job of the same name before registration. Failure is retried by the next10-minute run; transactional rollback, advisory locks and unique keys make replay safe. Operator may invoke the admin runner once, then verify no duplicate session/notice. Record actual last-success time and alert delivery before pilot. Pause with `cron.unschedule('gami-operations')`, verify no future runs and account for any in-flight run.

Alternative private runner uses that project's service key from a server-only secret store and calls the EXEC-restricted RPC over HTTPS. It needs no new public endpoint or shared public cron token. Restrict runner access, log only count/code/time, rotate/rebind on incident and retry with bounded backoff; the normal10-minute schedule is sufficient for staging. Select pg_cron unless that project's plan cannot support it.

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
