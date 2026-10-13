# Phase 3 final gate — 2026-10-14 (Asia/Bangkok)

## Recovery and scope

Continued the existing uncommitted Phase 3 workspace on `feature/phase-3-production-pilot`; no workspace reset or deletion of existing changes/data. Phase 2 PR #1 is merged at main `4258c31afb8cd43ec1fbaf495b3efb4932270714`. Phase 3 is delivered for review in a separate PR, without merge or Phase 4 work.

Recurring schedules, corrections, audit, notifications/escalation, PWA, network retry, technical pilot metrics/config, admin operations and deployment/recovery documentation are implemented. Hosted rollout and human pilot validation remain incomplete.

## Issues fixed during implementation and review

- Schedule replacement preserves the old range through X−1 and explicit one-off exceptions; expired/replaced ranges reject stale replacement. Different templates colliding at the same class/start report conflict instead of silently succeeding.
- Manual schedule creation/generation now checks selected teacher/class pairs while PILOT_MODE is enabled, matching automatic scheduler scope.
- Effective academic data applies approved amendments while private correction values/reasons/notes remain scoped. Completed originals stay immutable; new operations table writes are revoked from service_role as well as ordinary staff.
- Admin forms retain input on transport errors and prevent pending double submit. Replacement version is derived from the selected template. The correction queue defaults to oldest pending requests so reviewed requests cannot hide pending work.
- Checkout confirmation includes old-lesson exceptions consistently with server telemetry. Offline draft/error retry remains in memory, with server drafts as the durable source of truth.
- E2E assertions identify the exact correction/notification rather than ambiguous repeated titles. Chromium installability runs in a temporary normal profile because incognito disables installation; no installability errors are filtered out.

## Verification

| Area | Current evidence |
| --- | --- |
| Recurrence | Exact weekly count, UTC+7 19:00 → UTC 12:00, duplicate and concurrent retry, cancellation preservation, replacement, collision, valid/invalid substitute and stale version rejection |
| Corrections | Teacher cannot approve; old/new/reason/requestor/reviewer persisted; approval/rejection replay; rejection leaves effective note unchanged; original record unchanged; approved academic projection and Student360/Pulse/task reconciliation |
| History | Migrations 001–007 unchanged; fresh 001–011 installation plus separate 001–007 Phase 2 data fixture upgraded through 008–011; original session/record/note/event/attachment hashes preserved |
| Concurrency | Schedule advisory locks; concurrent generation/review retries; concurrent checkout in one/two sessions; actual attachment/completion parent-lock barrier regression |
| Privacy/RLS | CSKH private correction/helper denied; media academic/telemetry denied; foreign inbox reads/mark denied; inactive account fails closed; staff audit mutation and privileged new-table writes denied; inherited contact/attachment isolation tests pass |
| Mobile/PWA | Chromium viewport 320/390/430px, 25-pupil roster, reduced viewport/focused-input footer behavior, buttons ≥44px, 15-pupil offline/retry completion; manifest/icons/service worker/no caches; Chromium normal-profile installability errors empty |
| Analytics | Server first-open/completion timing, duplicate error key suppression, actual median/P90/counts; no student names, contact data, grades, notes or signed URLs in telemetry |
| Recovery | Synthetic PostgreSQL pg_dump/pg_restore preserves completed history, private bucket metadata and restored RLS; actual Storage bytes/managed Auth/cloud recovery not covered |

## Quality run

Fresh lockfile dependency installation, rerun after workspace recovery; earlier interrupted runs are not accepted as proof.

| Gate | Result |
| --- | --- |
| npm ci | PASS — 355 packages installed from lockfile |
| lint | PASS |
| typecheck | PASS |
| unit | PASS — 14/14, no skipped tests |
| DB/RLS | PASS — fresh matrix and Phase 2 data upgrade |
| recovery | PASS — isolated synthetic database restore |
| production build | PASS |
| E2E | PASS — 19/19, real local Auth/Storage, no skipped tests |
| npm audit / production audit | PASS — 0 vulnerabilities |
| secret/artifact scan | PASS — Git source manifest; no real env, credential, dependency/cache/temp/database artifact; private credentials absent from client build |
| git diff --check | PASS |

CI repeats these gates from a fresh checkout with its own synthetic Auth/Storage stack. Its actual status belongs to the PR checks; this document does not predict that result.

## Pilot recommendation

**NOT READY FOR PILOT on hosted infrastructure yet.** Local implementation and quality gates pass, but there is no verified hosted staging project/HTTPS deployment, scheduled job, cloud database/private-object backup or managed restore rehearsal. Real Safari Add to Home Screen and one week with 1–2 Gami teachers/classes are still required. Automated synthetic timings do not prove the real median <90 seconds.

Provide real project/hosting access and secure runtime bindings through environment settings or deployment secret storage, not chat: Supabase HTTPS URL/public key, server service key, migration access, hosting HTTPS/Auth URLs, scheduler, backup plan/object destination/operator. See DEPLOYMENT.md and BACKUP_RECOVERY.md for the concrete rollout and recovery checklist.
