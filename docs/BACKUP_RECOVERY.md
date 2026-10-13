# Backup and recovery

## Status

**Cloud backup/PITR/object backup has not been configured or verified.** Local synthetic `pg_dump` → `pg_restore` and restored RLS can be exercised by `bash scripts/test-recovery.sh`. That validates application data/schema recovery in PostgreSQL17; it does not validate Supabase managed restoration, real Auth credentials, Storage file backup or an offsite disaster recovery plan.

## Proposed objectives for Gami

Start with verified daily database + private object backups: target RPO ≤24h, RTO ≤4h during a supported recovery window. If operations need smaller loss, enable a supported paid PITR plan and target database RPO15min; Storage still requires matching object version/copy strategy. These are targets, not measured guarantees. Measure actual restore time and loss window during staging rehearsal before agreeing an SLA.

## Strategy

- Confirm Supabase plan's managed backup retention/frequency/PITR capabilities in the dashboard; record project refs and recovery owner. Prefer provider-managed restore for full Auth/database contracts.
- Make a recovery point before each migration; keep immutable SQL migration history and deployment SHA. Never edit applied files or run reset on live data.
- Supabase database backups contain Storage metadata, **not actual uploaded objects**. Copy private bucket objects to encrypted private offsite storage with object inventory/checksums, retention and versions. No public bucket, signed URLs in backup manifests or credentials in repository. Database/object inventories must correspond to the same recovery point; account for orphan uploads separately.
- Keep secrets (database owner, Auth/service keys, encryption/backup access) in a managed secret store with restricted operator access and rotation. Do not dump `.env`, process environment or credentials into backup logs.
- Scope retention/access for children's data and private teacher notes. Test backup reads by the recovery owner; prevent ordinary staff access. Preserve append-only audit and correction chains.

## Restoration procedure

1. Declare recovery window; stop writes and scheduler. Record last good app SHA, database recovery point and Storage inventory. Keep affected project intact for diagnosis; restore to a **separate project** first.
2. Use Supabase's documented managed restore for that plan/project. Restore Auth/user UUID relationships before application profiles/assignments; do not recreate accounts with different UUIDs and expect ownership to match.
3. For controlled self-managed/staging PostgreSQL restoration, use secure libpq service binding (example names, no literal credential):

```bash
pg_dump --dbname=service=gami-staging --format=custom --file=/secure/backups/gami.dump
pg_restore --dbname=service=gami-restore --no-owner --single-transaction --exit-on-error /secure/backups/gami.dump
```

Managed Supabase system-schema ownership/extensions/roles need provider-specific restore procedures; do not blindly apply a local full dump into a managed production project. Keep the restricted libpq service file outside Git, mode0600, and preserve TLS verification. Operator must verify grants, definer owners, RLS and private-schema exposure after restore.

4. Restore private Storage objects and reconcile paths/checksums/size/MIME with `session_attachments` and `storage.objects`. Never make buckets public to troubleshoot. Restore bucket policies and test authorized proxy downloads; confirm CSKH/media and wrong-class teachers are denied.
5. Check migration history and apply only reviewed missing migrations. Verify hashes/row counts of completed sessions, rosters, original notes, events, attachments and amendments/audit chain. Do not bypass history guards to patch data.
6. Deploy a schema-compatible app SHA, configure Auth HTTPS URLs and server-only bindings, run staging smoke checks and private sample uploads/downloads. Re-enable scheduler once idempotency and thresholds are verified; replay jobs safely.
7. Review measured RPO/RTO and remaining gaps with operator, then switch production endpoint under change control. Keep old project/backup until retention and incident review permit disposal.

## Recovery rehearsal checklist

- [ ] Database managed backup exists and owner can access restore path.
- [ ] Private object inventory/copies/checksums exist at matching time.
- [ ] Restore to isolated project succeeds; Auth UUIDs/roles and profiles match.
- [ ] Original completed roster/records/notes remain unchanged; approved amendments read correctly.
- [ ] RLS negative tests, audit immutability, notice IDOR and inactive account denial pass.
- [ ] Private image/video download works with no-store proxy; unauthorized/public access fails.
- [ ] Scheduler retry creates no duplicates; pilot metrics are preserved without fabricating samples.
- [ ] Actual elapsed recovery and loss window recorded; objectives assessed.

Only the local synthetic database portion has been exercised by repository tests. Cloud/operator checklist remains open until real bindings and staging project are provided.

## Hosted staging rehearsal — concrete execution record

Assign a named **restore owner** with provider/backup permissions and a deputy; Gami coordinator decides whether to resume service, deployment operator changes endpoints. No actual person or backup destination has been supplied yet. Record owner/deputy, project refs, private backup destination identifier, plan/retention, release SHA, UTC recovery point and Asia/Bangkok operator times in the private staging acceptance record. Do not record credential values or PII in Git.

1. In isolated staging, create synthetic teacher/admin/CSKH/media accounts, a15-pupil completed session with notes and image/video, an approved and a rejected correction, tasks and inbox/audit/telemetry. Record restricted baseline counts and stable hashes for original records, effective amendments, object bytes and Auth UUID/profile/assignment relationships. Avoid a dump into repository paths or CI artifacts.
2. Take an actual managed database backup/recovery point, or an operator-controlled encrypted pg_dump using secure libpq binding. Confirm file integrity/restore access, capture the UTC recovery point and backup completion time. Independently copy private Storage objects to encrypted offsite storage, with path/size/MIME/checksum inventory at the matching recovery point. Prove unauthorized users cannot read the backup or object inventory.
3. Add a small synthetic post-backup record to measure expected loss, then declare a simulated outage and start the RTO clock. Pause scheduler/writes; do not delete the original staging project. Restore to a separate reviewed recovery project using the provider-supported Auth/system-schema procedure, then restore private object bytes. A SQL dump alone cannot recover Storage bytes or guarantee managed Auth behavior.
4. Verify supported restoration preserves Auth UUIDs and password/login behavior; profile roles/active/class/CSKH assignment must still match. Use the restored project's newly issued public/server credentials securely; do not reuse a different project service key. Rebuild app with recovery public URL/key and exact recovery HTTPS/Auth URLs.
5. Compare baseline counts/hashes for completed roster/records/notes/events/attachment metadata plus corrections/audit/telemetry. Verify selected original and approved effective values; rejected value must not take effect. Match restored file checksums and actual private playback. Confirm the post-backup sentinel is lost/preserved as expected for the selected recovery point; report actual loss window, never infer it from the plan name.
6. Run real login, existing-session suspension, private attachment and contact/correction/inbox negative authorization checks on the restored deployment. Confirm private bucket, no-store responses, privileged grants and private-schema API exclusion. Run scheduler twice/manual retry; verify no duplicate sessions/tasks/notices and success alert delivery.
7. Stop the RTO clock only when the coordinator can log in, read recovered history/files and complete the smoke flow. Record measured duration, actual recovered UTC point/loss window, PASS/FAIL for each check and unresolved gaps. Assess RPO≤24h/RTO≤4h targets; provider PITR15min is a separate tested target, not a promise.
8. Operator/coordinator approves rehearsal results and a compatible rollback/forward-fix artifact; only then reconnect a pilot endpoint and resume scheduler. Keep the original project and encrypted backups under the agreed retention policy. Rehearsal results remain NOT RUN until an operator actually executes them.

Reference [STAGING_CHECKLIST.md](STAGING_CHECKLIST.md) and [PILOT_RUNBOOK.md](PILOT_RUNBOOK.md). This is an executable operator procedure, not a claim that cloud backup or restore has already happened.
