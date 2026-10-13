# Phase 3 — Production Pilot & Daily Operations

Phase2 PR#1 was merged after exact head f353d20 and GitHub Quality success, squash main4258c31. Phase3 is isolated on feature/phase-3-production-pilot; PR delivery must not merge Phase3.

## Data and workflows

Migrations008–011 only; 001–007 untouched. Templates + relational weekly rules generate future sessions in UTC+7 (max56-day window, automatic horizon14days). Same class/teacher overlap is checked under a shared advisory lock; unique class+start protects retries. Replacement at X keeps prior schedule through X−1, cancels only scheduled future rows and preserves explicit one-off exceptions. Started/completed rosters never change. Admin can skip or substitute an assigned active teacher for one scheduled session; reason/version required.

Teacher requests a field correction against completed snapshot, with current effective old value, new value and reason. Admin approves/rejects transactionally; reviewed requests immutable/replay-safe. **No original completed row is overwritten**. Scoped effective view projects approved amendments for academic core; private notes/content use separate authorized RPC. Student360, Pulse and repeat rules read effective records. Reconciliation preserves active tasks still justified by other recent records, cancels erroneous active tasks with audit, leaves terminal tasks unchanged and creates needed new follow-up. Historical original events remain, with an appended approved-correction event; they are history, not current academic totals.

Audit triggers cover session status/complete, tasks/assignment/status and profile role/active changes; correction request/review and schedule/config changes have safe audit. Ordinary users cannot append/change/delete audit or telemetry. New operations table writes are also revoked from service_role; dedicated scheduled RPC has only required EXEC grant. Database owner remains trusted maintenance boundary.

Recipient-scoped inbox supports read/unread/resolved and relative internal links. Messages omit student names/notes/contact data. Dedupe by recipient + entity/level; completion/terminal task/review resolves relevant notifications. Admin operates central thresholds and manual run; private deterministic engine supports scheduled execution (see DEPLOYMENT). No external/native push or Zalo.

## Pilot measurement and rollout

PILOT_MODE and teacher/class pairs are database config. When enabled, new correction/recurrence/escalation scope is limited to valid pairs; baseline Phase2 checkout continues for other classes. Pilot telemetry only records selected teacher pairs. First checkout_opened is server timed and reused after refresh. Completion inserts exactly one paired event via database trigger; duration includes idle, network wait and refresh, with no removal of slow sessions. Admin completion without a matching teacher open has no teacher timing sample.

Technical fields: session/user/attempt IDs, duration, student/exception counts, device category and time. No names, grades, parent data or note contents. Save-error events are client-observed technical failures keyed for retry dedupe; offline failure keys live only in memory and flush on reconnect. They are best-effort instrumentation, not proof of every network error. Reports show actual completed samples only; no samples means null median/P90. Local automated data is synthetic, never proof of a real teacher median<90s.

Select1–2 teachers/classes, stage for1week, measure median/P90 and error rate, review actual mobile speed and operator exceptions. Correct UX blockers within Phase3 before broad rollout. Real staff provision/Auth URLs, staging deployment, cloud backup/recovery and real iPhone pilot remain prerequisites; this repository does not fabricate them.

## PWA and network

Manifest name GAMI OS/short GAMI, standalone,192/512PNG icons, Apple metadata, viewport-fit/safe-area. Network-only service worker caches nothing, including auth, student data and signed files. Install via Safari Share → Add to Home Screen over HTTPS. Standalone starts at / and server redirects by actual role; navigation retains guarded routes. No native app or full offline-first store.

Checkout keeps unsaved form in React memory, online state via external network subscription, explicit retry and server draft source of truth. No PII persisted to localStorage/IndexedDB/cache. Sticky controls become static while input is focused on mobile; uploads block completion. Admin forms show errors, retain input and prevent pending double submit.

## Operations/observability

/admin/operations, /admin/schedules, /admin/corrections, /admin/audit, /notifications. Pilot metrics median/P90/count/avg exceptions/save errors, pending corrections/critical unread and actionable session links. Baseline CommandCenter still shows task priority/overdue/invalid owner and Pulse. Health endpoint checks service reachability; logs contain only operation/code/count/time, not secret/PII/bearer URL.

BACKUP_RECOVERY and DEPLOYMENT describe verified local evidence, explicit cloud gaps, scheduler setup and safe forward-fix/restore. No live backup, hosted deployment or real-device validation is claimed.

## Testing and limitations

Unit recurrence/state/threshold/key/duration, fresh PostgreSQL/RLS/correction/replay/escalation matrix and separate upgrade fixture hashes. Local Auth/Storage/browser workflow covers recurring generation/dedupe, checkout, correction approval, Student360/task reconciliation, audit/inbox, escalation, PWA and metrics. Synthetic pg_dump/restore verifies persisted history and RLS. Hardware Safari, hosted storage/cron, object backup and human speed need staging rehearsal.

Tables/indexes are bounded by actual UI queries (50 corrections/audit page,100 templates/inbox/session list). Correction fields supported: attendance/homework/old lesson/score/attention/note/lesson content/new homework; no roster membership or completed timestamp edits. Recurrence within same local day, no enterprise calendar. MP4 serving remains full stream; no transcoding/CDN/range delivery module. No Phase4, AI, tuition/payment, Zalo, chatbot or marketing Media Hub.
