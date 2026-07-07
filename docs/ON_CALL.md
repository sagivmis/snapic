# Wedding-day on-call runbook

Use this when a **live wedding** has guest matching issues.

## Severity levels

| Level | Example | Response |
|-------|---------|----------|
| P0 | No guests can search; API 5xx | Immediate — all hands |
| P1 | Slow matches (>60s) or partial failures | Within 15 minutes |
| P2 | Single guest can't upload selfie | Coach guest; check portrait tips |

## First 5 minutes

1. **Confirm scope** — one guest, one event, or platform-wide?
2. **Check health** — `GET /api/health` should return `status: ok` and `checks.database: ok`.
3. **Check Sentry** — spike in errors on match stream endpoint?
4. **Get event slug** from the couple/photographer.

## Common fixes

### "Album not ready" / 503 on search

- Photos still indexing. Admin/studio: open manage page, wait for **Indexing → Ready**.
- Retry failed photos via album banner.

### Rate limit (429)

- Guest exceeded 20 searches/hour per event. Wait or adjust `SNAPIC_MATCH_RATE_LIMIT_PER_HOUR` on Render (temporary).

### Poor venue WiFi

- Ask guest to switch to mobile data.
- App shows offline/slow banners — confirm they see them.

### Render API restart

- InsightFace model reloads on cold start (~30–60s). Retry after 1 minute.

## Escalation

- Email: hello@snapic.me
- Privacy/data issues: privacy@snapic.me

## Post-incident

- Note event slug, time, guest count, error messages in admin audit / internal doc.
- If P0, schedule load test before next Saturday wedding.

## Saturday night note

Israeli peak wedding time. Keep laptop charged and Supabase/Render dashboards bookmarked.
