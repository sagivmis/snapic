# Snapic production smoke test

Use this checklist before a real wedding. Run against **production** (Vercel + Render + Supabase) with a fresh test event.

## 1. Couple signup & approval

- [ ] Submit **Request your wedding gallery** with a real test email
- [ ] Super admin sees request under **Pending**
- [ ] Approve with **Create new event** — edit slug/title preview looks correct
- [ ] Slug field shows loader while checking; **Approve** disabled until slug is available
- [ ] Taken slug shows red outline + error icon; suggestion link works
- [ ] Approve with a taken slug is blocked (no silent `-2` suffix)
- [ ] **Reject** sends notification email; success toast shown; request moves to **Rejected** tab
- [ ] Couple receives **Supabase invite** email (approve path)
- [ ] Couple receives **Snapic welcome** email (if `RESEND_API_KEY` is set)
- [ ] Admin dashboard shows warning if welcome email failed
- [ ] **Audit log** shows signup approve/reject entries

## 2. Admin create event

- [ ] Expand **Create event** — slug debounce + loader while checking
- [ ] Taken slug blocks **Create event** button with inline error
- [ ] Available slug enables button; event creates successfully

## 3. Couple onboarding

- [ ] Invite link lands on `/e/{slug}/setup`
- [ ] Complete **Branding** → lands on checklist (Go live step)
- [ ] **Upload images** opens Album tab; upload 10–20 photos (or 100+ for scale test)
- [ ] **Mobile (iPhone):** Add ~20–30 photos per batch; tap **Add photos** again while first batch uploads
- [ ] **Desktop:** Drag a folder onto the drop zone (or **Add folder**) — 100+ photos queue within seconds
- [ ] Upload progress shows combined total when multiple batches are queued
- [ ] Duplicate picks in the same session are skipped (already in album or queue)
- [ ] **Album status banner** shows Uploading → Indexing → Ready after upload (auto-index)
- [ ] **Retry failed** re-indexes only failed photos when banner shows failures
- [ ] **Back to setup checklist** returns to setup with updated photo count
- [ ] **Index faces** shows streaming progress; completes for large albums
- [ ] Manage page loads quickly (skeleton shell → batch photo previews)
- [ ] **Set event to Active** only after faces indexed; optional album-ready / live emails sent
- [ ] **Finish setup** lands on **You're live** page with guest link + QR
- [ ] Copy link and download printable QR card

## 4. Guest experience (phone)

- [ ] Open guest URL `/e/{slug}` on mobile (not logged in as admin)
- [ ] **Before indexing completes:** guest sees **Gallery almost ready** (not a broken search)
- [ ] After indexing + active: upload selfie → search runs with progress bar
- [ ] Matches appear; lightbox opens full photo
- [ ] **Download my photos** ZIP works
- [ ] Search history icon shows past searches
- [ ] Slow/offline banners behave sensibly (optional: throttle network in DevTools)

## 5. Rate limiting & errors

- [ ] After many searches (~20/hour), guest sees friendly **try again in an hour** message
- [ ] No crash or blank screen on 429
- [ ] Search during incomplete indexing shows friendly message (503), not a generic error

## 6. Partner / co-admin (optional)

- [ ] Invite partner from setup or manage Settings
- [ ] Partner receives invite and can upload photos

## 7. Super admin ops

- [ ] Admin dashboard loads; attention strip accurate
- [ ] Index faces from events table works for unindexed albums (with progress)
- [ ] Super admin role is **not** downgraded when invited to an event
- [ ] Audit log lists recent admin actions

## 8. Edge cases

- [ ] **Draft** event: guest page 404 for non-admins
- [ ] **Archived** event: guest sees “event ended”
- [ ] **Empty album:** guest sees “Photos coming soon”
- [ ] **Active but unindexed:** guest sees “Gallery almost ready” with Check again
- [ ] **Large mobile batch:** “Preparing N photos from your library…” appears after iOS picker returns
- [ ] Zero-match search: tips shown, no false “no matches during search”

---

**Sign-off:** Date ______  Event slug ______  Tester ______
