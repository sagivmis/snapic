# Backup and disaster recovery runbook

Snapic stores wedding photos in **Supabase Postgres + Storage**. Loss of this data is unacceptable for live events.

## What to back up

| Asset | Location | Priority |
|-------|----------|----------|
| Gallery photos | Supabase Storage bucket `events` | Critical |
| Face embeddings + metadata | Postgres `gallery_photos`, `match_runs` | High |
| User accounts | Supabase Auth + `profiles` | Medium |
| Studio/org billing | Postgres `organizations` | Medium |

## Supabase platform backups

1. Confirm your Supabase project plan includes **daily backups** and note retention (Dashboard → Settings → Database → Backups).
2. Enable **Point-in-Time Recovery (PITR)** before first paid wedding if available on your plan.
3. Document the project ref and region in your password manager.

## Recovery procedures

### Single deleted event (operator error)

- Super admin can delete events from the dashboard — there is **no soft delete** today.
- Recovery: restore from Supabase backup/PITR to a staging project, export `gallery_photos` + storage objects, re-import manually.

### Full database corruption

1. Open Supabase support / dashboard restore flow.
2. Restore to a **new** project; update `SUPABASE_URL` and keys in Render/Vercel.
3. Run smoke test ([`SMOKE_TEST.md`](SMOKE_TEST.md)).

### Storage bucket incident

1. Check Supabase Storage dashboard for bucket policies and object counts.
2. Restore from backup snapshot if objects are missing.

## RPO / RTO targets (recommended)

- **RPO** (max data loss): 24 hours on launch; 1 hour after PITR enabled
- **RTO** (time to restore service): 4 hours for first wedding season

## Pre-wedding checklist

- [ ] Verify Supabase backup status in dashboard
- [ ] Export test event album ZIP from manage page
- [ ] Confirm Sentry alerts fire on API errors

## Contacts

- Supabase support: via dashboard
- Render (API): dashboard + status.render.com
- Vercel (frontend): dashboard + vercel-status.com
