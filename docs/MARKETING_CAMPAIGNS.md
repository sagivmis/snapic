# Snapic marketing campaigns (Israel launch)

Operational playbook for acquiring wedding photographers in Israel. All URLs should include UTM parameters so attribution is captured automatically (`frontend/src/lib/attribution.ts`).

## UTM convention

| Param | Example | Notes |
|-------|---------|-------|
| `utm_source` | `instagram`, `facebook`, `whatsapp`, `expo` | Channel |
| `utm_medium` | `dm`, `cpc`, `group`, `booth` | Tactic |
| `utm_campaign` | `founding_pilot`, `launch30`, `season_2026` | Campaign id |
| `promo` | `LAUNCH30` | Stored for studio signup |
| `plan` | `annual` | Pre-selects plan on signup |
| `ref` | affiliate code | Couple affiliate program |

Example tracked URL:

```
https://snapic.me/for-photographers?utm_source=instagram&utm_medium=dm&utm_campaign=founding_pilot
https://snapic.me/launch?promo=LAUNCH30&utm_source=facebook&utm_medium=cpc&utm_campaign=launch30
```

## Campaign A — Founding photographer pilot

**Goal:** 3–5 free/discounted weddings in exchange for testimonials and case studies.

**Audience:** Independent photographers you know personally or via warm intro.

**Offer:** First client gallery free (or heavily discounted); you collect quote + permission to use studio name.

**Landing:** `/for-photographers?utm_source=direct&utm_medium=dm&utm_campaign=founding_pilot`

**Steps:**
1. Shortlist 20 photographers (Instagram portfolio, 15–40 weddings/year).
2. DM template (Hebrew): problem → demo link → pilot offer → 15-min call.
3. Onboard manually; screenshot guest flow for social proof block.
4. Ask for WhatsApp-ready quote within 48h of first live event.

**Success metric:** 3 live events + 3 usable testimonials.

## Campaign B — Launch discount

**Goal:** Convert cold traffic with time-bound offer.

**Landing:** `/launch?promo=LAUNCH30&utm_campaign=launch30`

**Offer:** 30% off first season (promo code `LAUNCH30`, expires end of Aug 2026 — see `frontend/src/lib/marketing.ts`).

**Steps:**
1. Pin `/launch` in Instagram bio during promo window.
2. Retarget site visitors with same URL + `utm_source=facebook&utm_medium=cpc`.
3. Track `launch_page_viewed` and `launch_cta_clicked` (enable `?debug=1` locally).

**Success metric:** Signup requests with `promo=LAUNCH30` in session attribution.

## Campaign C — Wedding season Meta ads

**Goal:** Scale photographer signups April–October.

**Audience:** IL, 25–45, interests: wedding photography, bridal, event photography.

**Creative:** Before/after — “guests scrolling 400 photos” vs “guest uploads selfie, finds all photos.”

**Landing:** `/for-photographers?utm_source=facebook&utm_medium=cpc&utm_campaign=season_2026`

**Budget start:** ₪50–100/day test; kill ads with CPC > ₪8 and no signup clicks in 7 days.

**Success metric:** Cost per studio signup request (when CRM/analytics wired).

## Campaign D — Bridal expo booth

**Goal:** Dual funnel — couples request gallery, photographers see studio demo.

**Setup:** iPad on `/demo` (guest) + QR to `/for-photographers?utm_source=expo&utm_medium=booth`.

**Collateral:** A5 flyer with both QR codes; Hebrew headline focused on guest delight.

**Staff script:** “Scan to find yourself in demo photos” → hand photographer card with studio QR.

**Success metric:** Scans per hour; follow-up email within 24h.

## Campaign E — Photographer Facebook / WhatsApp groups

**Goal:** Organic reach in IL photographer communities.

**Rules:** No spam — share genuine demo + ask for feedback on guest UX.

**Post structure:** Short story → link to `/demo` → soft CTA to `/for-photographers?utm_source=facebook&utm_medium=group`.

**Success metric:** Click-throughs with `utm_medium=group`.

## Campaign F — Couple affiliate (month 2+)

**Goal:** Couples refer photographers after their wedding.

**Mechanism:** `/r/:code` redirect + admin affiliate dashboard (already built).

**Payout:** After 5 approved referrals, ₪100 per additional approved signup (configurable via env).

**Couple message template:** Share photographer-facing link with `?ref=CODE`.

## Funnel metrics to watch

| Stage | Event / signal |
|-------|----------------|
| Visit | `landing_page_viewed`, `for_photographers_page_viewed`, `launch_page_viewed` |
| Intent | `landing_chooser_clicked`, `for_photographers_plan_clicked` |
| Convert | Studio signup form submit, request-access submit |
| Activate | First client gallery live |
| Delight | Guest searches per event |

Enable debug logging: append `?debug=1` once — events log to console until cleared from localStorage.

## Content checklist before spend

- [ ] Replace placeholder testimonials with real quotes (`en.json` / `he.json` → `landing.socialProof`, `forPhotographers.social`)
- [ ] Swap generated PWA/OG icons for final brand assets (`frontend/public/`, run `scripts/generate_pwa_icons.py` after updating colors)
- [ ] Lawyer-reviewed legal pages live
- [ ] Billing + promo code redemption wired (launch page footnote references this)
- [x] Custom domain + `sitemap.xml` / `robots.txt` URLs updated to `snapic.me`
