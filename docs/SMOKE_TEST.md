# Snapic production smoke test

Use this checklist before a real wedding. Run against **production** (Vercel + Render + Supabase) with a fresh test event.

## 1. Couple signup & approval

- [ ] Submit **Request your wedding gallery** with a real test email
- [ ] Super admin sees request under **Pending**
- [ ] Approve with **Create new event** — edit slug/title preview looks correct
- [ ] Slug field shows loader while checking; **Approve** disabled until slug is available
- [ ] Taken slug shows red outline + error icon; suggestion link works
- [ ] Approve with a taken slug is blocked (no silent `-2` suffix)
- [ ] **Reject** — success toast at top of dashboard; request moves to **Rejected** tab
- [ ] **Reject** notification email *(optional pre-launch — skip if no custom domain yet)*
- [ ] Couple receives **Supabase invite** email (approve path)
- [ ] Couple receives **Snapic welcome** email *(optional pre-launch — skip if no custom domain yet)*
- [ ] Admin dashboard shows warning if welcome/rejection email failed (when Resend is configured)
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
- [ ] **New photos nudge:** after a search, add more photos as admin — guest sees “new photos since your last search” banner
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
- [ ] **Live activity** badge shows **Live**; new signup appears in feed without refresh *(requires migration `009_admin_realtime.sql` on Supabase)*

## 8. Edge cases

- [ ] **Draft** event: guest page 404 for non-admins
- [ ] **Archived** event: guest sees “event ended”
- [ ] **Empty album:** guest sees “Photos coming soon”
- [ ] **Active but unindexed:** guest sees “Gallery almost ready” with Check again
- [ ] **Large mobile batch:** “Preparing N photos from your library…” appears after iOS picker returns
- [ ] Zero-match search: tips shown, no false “no matches during search”

---

## 9. Monitoring (optional)

- [ ] `SENTRY_DSN` set on Render; `VITE_SENTRY_DSN` on Vercel — test errors appear in Sentry project
- [ ] Admin dashboard → **Send Sentry test events** — backend + frontend messages in Sentry within ~1 min
- [ ] `/api/health` returns 200

---

## 10. Transactional email *(run after custom domain + Resend are configured)*

Resend cannot send from Gmail. Before go-live, verify a domain in [Resend](https://resend.com/domains) and set on Render:

- `RESEND_API_KEY`
- `SNAPIC_FROM_EMAIL` — e.g. `Snapic <hello@yourdomain.com>`

Then re-run:

- [ ] **Approve** signup — couple receives Snapic welcome email (in addition to Supabase invite)
- [ ] **Reject** signup — couple receives rejection notification
- [ ] **Set event to Active** — optional album-ready / live emails reach event admins
- [ ] Admin toast confirms email sent (not the “could not be sent” warning)
- [ ] Render logs show no Resend errors

**Pre-domain validation:** Without a verified domain, skip this section. Supabase invites still work; Snapic-branded emails via Resend will not reach arbitrary addresses (sandbox only delivers to your Resend account email).

---

**Sign-off:** Date ______  Event slug ______  Tester ______
