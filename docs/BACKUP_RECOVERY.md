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
