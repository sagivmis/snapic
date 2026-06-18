# Snapic production smoke test

Use this checklist before a real wedding. Run against **production** (Vercel + Render + Supabase) with a fresh test event.

## 1. Couple signup & approval

- [ ] Submit **Request your wedding gallery** with a real test email
- [ ] Super admin sees request under **Pending**
- [ ] Approve with **Create new event** — edit slug/title preview looks correct
- [ ] Couple receives **Supabase invite** email
- [ ] Couple receives **Snapic welcome** email (if `RESEND_API_KEY` is set)
- [ ] Admin dashboard shows no error if welcome email failed

## 2. Couple onboarding

- [ ] Invite link lands on `/e/{slug}/setup`
- [ ] Complete **Branding** → lands on checklist (Go live step)
- [ ] **Upload images** opens Album tab; upload 10–20 photos
- [ ] **Back to setup checklist** returns to setup with updated photo count
- [ ] **Index faces** completes; checklist shows indexed
- [ ] **Set event to Active** works; optional album-ready / live emails sent
- [ ] **Finish setup** lands on **You're live** page with guest link + QR
- [ ] Copy link and download printable QR card

## 3. Guest experience (phone)

- [ ] Open guest URL `/e/{slug}` on mobile (not logged in as admin)
- [ ] Upload selfie → search runs with progress bar
- [ ] Matches appear; lightbox opens full photo
- [ ] **Download my photos** ZIP works
- [ ] Search history icon shows past searches
- [ ] Slow/offline banners behave sensibly (optional: throttle network in DevTools)

## 4. Rate limiting

- [ ] After many searches (~20/hour), guest sees friendly **try again in an hour** message
- [ ] No crash or blank screen on 429

## 5. Partner / co-admin (optional)

- [ ] Invite partner from setup or manage Settings
- [ ] Partner receives invite and can upload photos

## 6. Super admin ops

- [ ] Admin dashboard loads; attention strip accurate
- [ ] Index faces from events table works for unindexed albums
- [ ] Super admin role is **not** downgraded when invited to an event

## 7. Edge cases

- [ ] **Draft** event: guest page 404 for non-admins
- [ ] **Archived** event: guest sees “event ended”
- [ ] Empty album: guest sees “Photos coming soon”
- [ ] Zero-match search: tips shown, no false “no matches during search”

---

**Sign-off:** Date ______  Event slug ______  Tester ______
