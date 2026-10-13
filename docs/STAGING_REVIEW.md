# Staging readiness review — 2026-10-14 (Asia/Bangkok)

Phase3 PR#2 head `0dea0a06f1bbcd741cf7ac76239bc99fb1a267ba` was OPEN/MERGEABLE with both Quality checks SUCCESS, then squash merged under explicit user authorization. Main became `b864dba5684fdb04c816539c8fd440447892552f`; staging work continued from a clean pull on `chore/staging-readiness`.

## Changes and boundaries

Docs/runbooks, environment example, a metadata-only deployment preflight with regression tests, and CI proof that build precedes local services. No application business source or SQL migration changed. All001–011 are byte-identical to merged main. No hosted deployment, secret invention, Phase4 or new public scheduler endpoint.

Deployment guidance now distinguishes local CLI Auth/Storage settings from hosted settings, staging-specific public bundles from production, and Next upload configuration from provider limits. Standard Node24 hosting behind HTTPS must support41 MiB bodies for the existing40 MiB video contract; Vercel's Functions body limit is a blocker for full upload acceptance until resolved through an equivalent suitable host.

## Security review

| Concern | Evidence / remaining boundary |
| --- | --- |
| Env/service leakage | Preflight rejects public server keys/secret bindings and seed credentials in web runtime; source/artifact scan and private-key scan of client build pass |
| Config mixups | HTTPS origins, standard project URL/ref, legacy JWT role/ref/expiry and Vercel Preview/Production classification checked; modern opaque keys need provider confirmation and real smoke, not offline trust |
| Redirect abuse | Password login uses validated role routes, no caller next URL; hosted Site URL/redirect allowlist must be exact and proxy preserve Host/protocol |
| Scheduler auth | Preferred pg_cron executes private function as trusted operator; no HTTP auth secret/public endpoint; alternate runner uses server-only key on restricted scheduled RPC |
| Storage | Existing private bucket/RLS/proxy and valid-byte10/40 MiB limits unchanged; real hosted near-limit upload/public/foreign-access checks still NOT RUN |
| Debug/health | Only existing health/upload API routes; minimal health200/503 private/no-store, no credentials/PII; endpoint is reachability only |
| Logging | Existing operation/code-only app logs; preflight prints names/categories only; hosted proxy/platform redaction and retention still need operator verification |
| Backup/stop | Named restore owner/deputy and actual DB/Auth/private-object rehearsal required; pause cron and keep PILOT_MODE ON without pairs, do not use OFF as stop |

## Quality evidence from this branch

| Gate | Result |
| --- | --- |
| npm ci | PASS —355 lockfile packages |
| lint / typecheck | PASS |
| unit | PASS —20/20, including6 deployment preflight tests, no skipped |
| DB/RLS | PASS —fresh001–011 and Phase2-data upgrade |
| Current-main migration replay | PASS —11 already applied, no pending SQL; snapshots of14 history/operations tables unchanged |
| Synthetic recovery | PASS —pg_dump/restore with private bucket metadata and restored RLS |
| Build without services/bindings | PASS —app Docker containers stopped, public/server Supabase bindings empty; login200, health503 with minimal no-store body |
| Configured production build | PASS |
| E2E | PASS —19/19 real local Auth/Storage/browser tests, no skipped |
| npm audit | PASS —0 vulnerabilities |
| Secret/artifact + private client-build scan | PASS |
| git diff --check | PASS |

An initial fixture typing error was corrected without changing compiler rules. E2E port preflight found prior locally launched web processes; only those processes were stopped and the full suite was rerun. No failed/interrupted run is counted as PASS. CI reruns gates from a fresh checkout; actual final CI status is recorded in PR checks rather than predicted here.

## Recommendation

**READY TO CONFIGURE STAGING**, not ready for hosted pilot approval. Provider/project/HTTPS bindings, real migration dry run, Auth/Storage smoke, scheduler/alert, encrypted DB/private-object backup, hosted restore and real Safari acceptance remain NOT RUN. Required non-secret operator metadata and secure bindings are enumerated in STAGING_CHECKLIST.md and DEPLOYMENT.md; one-week procedure is in PILOT_RUNBOOK.md. The staging PR must remain unmerged pending review.
