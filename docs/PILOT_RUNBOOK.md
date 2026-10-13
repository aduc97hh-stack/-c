# Gami one-week pilot runbook

**Plan only: hosted pilot and real Safari checks have NOT RUN.** Start only after STAGING_CHECKLIST is signed off. Scope:1–2 teachers,1–2 classes, approximately15–30 pupils/class, one week. No new Phase4 workflow. Use synthetic pupils for staging/device rehearsal; real data requires the coordinator's approved environment and privacy handling.

## People and day0 prerequisites

Name a Gami coordinator/admin,1–2 teachers, CSKH owner for each selected pupil, deployment operator and restore owner/deputy. Record their names and escalation contact in the private operator record, not student/parent credentials in Git. Confirm active accounts/assignments, valid single CSKH ownership, scheduled classes and private upload permissions. Open `/admin/operations`, add selected teacher/class pairs, then enable PILOT_MODE. Inspect the displayed pairs before running operations.

Confirm HTTPS, hosted Auth/Storage negative tests, scheduler success/alerts, backup/restore rehearsal, health checks and the iPhone checklist below. Teacher should know where to report an issue and who can approve corrections. Do not launch on local demo credentials or use automated synthetic timings as real speed evidence.

## Teacher onboarding —10 minutes

| Minute | Practice |
| --- | --- |
| 0–2 | Login with assigned account; see only own classes; log out once and back in |
| 2–3 | Safari Share → Add to Home Screen; open standalone; find Hôm nay |
| 3–6 | Start a synthetic class; default everyone present/homework done/old lesson passed; edit only exceptions; add lesson/homework, watch Draft đã lưu |
| 6–7 | Review pupil/exception totals, finish and confirm; explain completed originals cannot be edited |
| 7–8 | Send a correction with specific old/new value and reason; teacher cannot approve |
| 8–9 | Open inbox; review assigned action; practice lost-network/retry without closing the form |
| 9–10 | Report a synthetic issue, identify admin contact and stop/escalation procedure |

## Daily checkout and correction

Teacher opens Hôm nay→correct session→Bắt đầu lớp. The roster is captured at start; later transfers/inactivation do not change it. Mark exceptions, use private notes only where appropriate, add lesson content/BTVN, and upload supported image/video only when needed. Wait for uploads and draft save before confirming completion. Check pupil/exception totals before final confirmation.

On network/save error, keep the page open: unsaved edits remain in memory. Reconnect and press Thử lại, confirm server draft saved, then finish. Do not clear browser data, refresh or close an unsaved form; refresh can recover only the last server draft. PWA does not offer full offline storage. Avoid repeated tapping while a request is pending.

For completed data mistakes, open the session's Yêu cầu chỉnh sửa, choose student/field, new value and a concrete reason. Submit once. Admin opens pending corrections, compares old/new/source and approves or rejects with reason. Check effective Student360/Pulse and relevant task reconciliation; preserve the original record, attachment metadata and historical events. If an approval was wrong, submit a new correction; never edit originals or delete audit.

## Admin morning/end-of-day routine

- Check `/api/health`, scheduler last success and alert delivery; no successful run >30min requires operator investigation.
- Check today's/uncompleted sessions, critical unread, pending corrections and invalid/unassigned owners; correct assignments, do not assign an inactive/ambiguous owner to hide an exception.
- Review oldest pending requests, overdue task priority and notifications. Sessions >2h remind teacher and >12h escalate admin; default tasks24h/48h, high-priority4h. Changes to thresholds need coordinator review and audit.
- Check schedule conflicts and date-specific cancellation/substitute; never change started/completed history to reschedule.
- Record real pilot completed samples, median/P90, average exceptions and save-error count from `/admin/operations` (rolling7days). Empty samples mean no measurement. Preserve slow sessions: timing starts at server first-open and includes idle/network/refresh. Error events are best effort; counts are not a complete error-rate denominator.

## One-week cadence and reporting

Day0: synthetic rehearsal and real iPhone approval. Days1–2: coordinator present for each selected teacher, inspect every exception and completion. Days3–6: daily admin routine, short teacher feedback on taps/keyboard/network/upload friction. Day7: review actual sample count/median/P90/save errors, unresolved corrections/owner exceptions and teacher feedback. Target median<90s; report failures and P90 honestly. Do not broaden rollout until security, restore and UX blockers are resolved and coordinator approves.

Report bugs to the coordinator's agreed private support channel: time in Asia/Bangkok, device/iOS, route/session identifier, operation, sanitized message and whether draft saved. No password/token, PH phone, full pupil list, teacher note or signed URL; redact screenshots. Coordinator records severity, owner, reproduction and resolution. This runbook sends no external messages automatically.

## Stop and recovery

Security/privacy leak, wrong roster/ownership, corrupted completion, failed restore or repeated lost edits → stop pilot and notify the named coordinator/operator immediately. Pause Cron; confirm no future runs and account for an in-flight transaction. Keep PILOT_MODE **ON** and remove all pilot pairs to stop new pilot recurrence/escalation/correction scope. **OFF is broader rollout, not an emergency stop.** Baseline Phase2 checkout still exists; to freeze affected access, admin suspends affected accounts and host/operator restricts writes/access as appropriate. Do not delete histories/users to hide an incident.

Preserve completed records, audit, backups and sanitized incident evidence. Server proxy rechecks authorization; already-issued signed capabilities can last until their short TTL. Use a schema-compatible last-good artifact/forward fix or restore into an isolated project per BACKUP_RECOVERY. Never roll back to Phase2 ignoring approved amendments. Re-enable only after coordinator/operator verifies fix, RLS, actual recovered data and scheduler retries.

## Real Safari/iPhone acceptance — NOT RUN

Record tester, device, iOS/Safari version, actual HTTPS build SHA, network and date for each check. Automated Chromium evidence does not mark these boxes PASS.

- [ ] Login/logout, wrong credentials and suspended account; correct class/role scope.
- [ ] Safari Share→Add to Home Screen; correct icon/name; standalone launches, restores login and routes by role.
- [ ] Checkout15 and25 pupils (and30 if selected class needs it): no horizontal overflow, legible names, usable ≥44px targets, reasonable number of taps.
- [ ] Focus score/note/homework with real keyboard; footer does not cover fields; scroll, save and complete while keyboard has been used.
- [ ] Real JPEG/PNG/WEBP upload within10 MiB; rejected oversize/wrong bytes; authorized private viewing, CSKH/media/wrong-class denied.
- [ ] Real valid MP4 including a near40 MiB upload through the selected host; playback and private/no-store responses; reject oversized/invalid video.
- [ ] Switch Wi-Fi/mobile network, airplane mode during draft/upload and reconnect/retry; draft input remains; no duplicate completion/task/notice. Refresh only after server draft save.
- [ ] Inbox read/unread and correct links; foreign notification not accessible.
- [ ] Correction request, admin approval/rejection and effective Student360/task reconciliation; teacher cannot approve.
- [ ] Safe-area portrait/landscape, app resume after background/lock and session expiry; no public/private-data cache.
- [ ] Coordinator records actual timing/sample count, UX issues and PASS/FAIL/NOT RUN; all blockers resolved before real pilot.
