# Hosted staging acceptance record

Status: **READY TO CONFIGURE STAGING**, not deployed or approved for real pilot. Phase3 is merged at `b864dba5684fdb04c816539c8fd440447892552f`. This branch adds no business module or migration. Keep separate staging/production project records; never paste secret values in this file.

| Item | Prepared repository evidence | Hosted status / required evidence |
| --- | --- | --- |
| Supabase | 001–011 fresh/Phase2 upgrade tested, RLS/private schema | NOT RUN: project ref/region/plan and authorized operator |
| Hosting HTTPS | Next build/start, body/stream/proxy requirements | NOT RUN: provider, project, HTTPS origin, certificate/renewal and40 MiB upload proof |
| Env separation | Example names + metadata-only preflight | NOT RUN: separate scopes and provider-confirmed key/project match |
| Auth URLs | Exact origin/redirect guidance, no caller next redirect | NOT RUN: Site URL, allowlist, signup disabled and real role/assignment accounts |
| Service key | Server-only Storage/runner; no private key in client build | NOT RUN: secure server bindings/access/rotation owner |
| Migrations | No change to historical001–011; current-main has no pending SQL | NOT RUN: CLI version/history/backup point/dry-run and authorized apply |
| Storage | Private bucket/RLS,10 MiB images/40 MiB MP4 | NOT RUN: private object upload/proxy access and negative authorization tests |
| Scheduler | pg_cron every10min, private function, retry/dedupe | NOT RUN: job ID, last success, alert recipient and replay proof |
| Backup | DB + separate encrypted private-object inventory | NOT RUN: plan/retention/location, actual recovery point and operator access |
| Restore rehearsal | Local synthetic restore+RLS | NOT RUN: isolated hosted restore, Auth UUIDs, object hashes, measured RPO/RTO |
| Health/logging | Minimal200/503 no-store, sanitized app logs | NOT RUN: endpoint, failure alert and redacted platform logs |
| Rollback | Preserve history, pause cron, compatible artifact/forward fix | NOT RUN: last-good staging SHA and practiced stop/recovery |
| Real iPhone | Chromium/mobile/PWA automated tests | NOT RUN: named tester, iOS/device, Safari/A2HS checklist and date |

## Operator handoff

Fill only non-secret fields: release SHA, staging project ref, HTTPS origin, region/provider, hosting project, migration operator, restore owner + deputy, Gami pilot coordinator, alert recipient, backup retention and private backup destination identifier. Assign actual people before launch; no ownership is assumed here.

Bindings supplied securely to hosting: public Supabase URL/key, server service key, `GAMI_DEPLOY_ENVIRONMENT=staging`, `GAMI_APP_URL`, `SUPABASE_PROJECT_REF`. Migration/backup operator gets separately scoped provider/CLI/database credentials. Do not put seed password into the web runtime. Never provide credentials in chat, PR, this record or screenshots.

1. Provision isolated staging and secure bindings; run preflight and record only status/error categories.
2. Review backup availability, migration history and dry-run; apply only missing reviewed SQL with explicit deployment authority.
3. Configure hosted Auth/private Storage, deploy a staging-specific build behind HTTPS and complete DEPLOYMENT smoke checks.
4. Register Cron and observe successful repeated/manual run with no duplicates and a working failure alert.
5. Complete BACKUP_RECOVERY hosted rehearsal with real objects/Auth and measured timings.
6. Complete PILOT_RUNBOOK iPhone checklist and10-minute teacher onboarding with synthetic rehearsal before any real data.
7. Coordinator signs off remaining blockers, actual data handling and1-week pilot. Any unresolved security/restore/authorization/upload blocker means **NO PILOT**.

Evidence must name tester/operator/date/environment and PASS/FAIL/NOT RUN. Store redacted results, never tokens, PH contact details, teacher private notes or signed URLs. Repository/local PASS does not fill hosted status automatically.
