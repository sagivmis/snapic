# Snapic production smoke test

Use this checklist before a real wedding. Run against **production** (Vercel + Render + Supabase) with a fresh test event.

**Prerequisites for studio / photographer flows:** Supabase migrations `010`–`013` applied (`closed` status, `organizations`, `photographer` role, billing fields). Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) is optional — skip billing steps until configured.

---

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

---

## 2. Photographer studio enrollment & first client upload

Run with a **fresh test Google account** (not super admin, not an existing couple). Use a second browser or incognito for guest checks.

### 2A. Studio enrollment

- [x] Open `/for-photographers` — page loads; **Start your studio** links to `/studio/signup`
- [x] `/studio/signup` (signed out) shows **Continue with Google**
- [x] Sign in with Google → returns to `/studio/signup`
- [ ] Submit **Studio name** (+ optional slug) → lands on `/studio` dashboard
- [ ] `profiles.global_role` is `photographer` (Supabase) or login redirects to `/studio`
- [ ] Studio sidebar shows: Dashboard, Clients, Settings, Billing, Team
- [ ] Dashboard stats load (0 clients initially); no crash on empty state
- [ ] Revisit `/studio/signup` while enrolled → redirects to `/studio` (does not create duplicate org)

### 2B. Create first client event

- [ ] **New client** (`/studio/clients/new`) — enter couple names + wedding date
- [ ] Optional: couple email + internal notes save on create
- [ ] Redirect to `/studio/clients/{eventId}` with status **draft**, handoff **draft**
- [ ] Client appears on **Clients** list and dashboard **Recent clients**
- [ ] Super admin **Events** table shows **Studio** column with studio name
- [ ] Super admin stats include **Studios** count ≥ 1

### 2C. Upload album & index faces

- [ ] Client detail **Album** tab → **Open album manager** (or **Full manage page**)
- [ ] Lands on `/e/{slug}/manage?from=studio&tab=album`
- [ ] Upload 10–20 photos (desktop folder drag or mobile batch)
- [ ] **Album status banner**: Uploading → Indexing → Ready (auto-index)
- [ ] **Index faces** completes; client detail shows updated photo count
- [ ] Handoff checklist: **Photos uploaded** ✓, **Faces indexed** ✓
- [ ] **Draft** event: guest URL `/e/{slug}` blocked or shows setup state for non-admins

### 2D. Go live & share

- [ ] **Handoff** tab — guest link + QR visible; copy link works
- [ ] **Go live** sets event **active**; handoff status **live**
- [ ] **Preview guest page** opens `/e/{slug}` in new tab
- [ ] Guest page shows studio co-branding (studio name; **Powered by Snapic** on standard plan)
- [ ] Upload selfie → search runs; matches appear

### 2E. Optional couple handoff

- [ ] **Handoff** tab — enter couple email → **Send invite**
- [ ] Couple receives Supabase invite; lands on `/e/{slug}/setup`
- [ ] Couple setup copy mentions photographer prepared gallery (no upload required if photos exist)
- [ ] Couple **Manage** album: bulk upload hidden/disabled; single-photo remove still works
- [ ] Couple can complete branding and set **Active** (if not already live)

### 2F. Studio settings & billing *(optional)*

- [ ] **Settings** — update studio name, website, accent; **Require couple go-live** toggle saves
- [ ] **Studio logo** — upload in Settings → logo appears on guest page co-branding
- [ ] **Associate access** toggle (org-wide vs assigned events) saves; warning shown for event-scoped mode
- [ ] **Billing** — plan usage displays *(skip checkout if Stripe not configured)*
- [ ] With Stripe: choose plan → Checkout → webhook updates plan on return
- [ ] **Manage billing** portal button works when `stripe_customer_id` exists

### 2G. Team invite & assignments *(optional)*

- [ ] **Team** — invite associate email
- [ ] Associate receives invite; after sign-in can access `/studio` and client list
- [ ] Associate can upload/index on org events (when **org-wide** scope)
- [ ] **Event-scoped access:** owner assigns associates on client **Details** tab → associate sees only assigned clients
- [ ] **Client Details** — edit couple info, notes; **Close gallery** sets status closed

---

## 3. Admin create event

- [ ] Expand **Create event** — slug debounce + loader while checking
- [ ] Taken slug blocks **Create event** button with inline error
- [ ] Available slug enables button; event creates successfully

---

## 4. Couple onboarding

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

---

## 5. Guest experience (phone)

- [ ] Open guest URL `/e/{slug}` on mobile (not logged in as admin)
- [ ] **Before indexing completes:** guest sees **Gallery almost ready** (not a broken search)
- [ ] After indexing + active: upload selfie → search runs with progress bar
- [ ] Matches appear; lightbox opens full photo
- [ ] **Download my photos** ZIP works
- [ ] Search history icon shows past searches
- [ ] **New photos nudge:** after a search, add more photos as admin — guest sees “new photos since your last search” banner
- [ ] Slow/offline banners behave sensibly (optional: throttle network in DevTools)

---

## 6. Rate limiting & errors

- [ ] After many searches (~20/hour), guest sees friendly **try again in an hour** message
- [ ] No crash or blank screen on 429
- [ ] Search during incomplete indexing shows friendly message (503), not a generic error

---

## 7. Partner / co-admin (optional)

- [ ] Invite partner from setup or manage Settings
- [ ] Partner receives invite and can upload photos

---

## 8. Super admin ops

- [ ] Admin dashboard loads; attention strip accurate
- [ ] **Studios** and **Photographer signups** stats visible
- [ ] Events table **Studio** column populated for photographer-created events
- [ ] Index faces from events table works for unindexed albums (with progress)
- [ ] Super admin role is **not** downgraded when invited to an event
- [ ] Audit log lists recent admin actions
- [ ] **Live activity** badge shows **Live**; new signup appears in feed without refresh *(requires migration `009_admin_realtime.sql` on Supabase)*

---

## 9. Edge cases

- [ ] **Draft** event: guest page 404 for non-admins
- [ ] **Closed** event: guest sees “event ended”
- [ ] **Empty album:** guest sees “Photos coming soon”
- [ ] **Active but unindexed:** guest sees “Gallery almost ready” with Check again
- [ ] **Large mobile batch:** “Preparing N photos from your library…” appears after iOS picker returns
- [ ] Zero-match search: tips shown, no false “no matches during search”
- [ ] **Photo limit:** upload blocked with clear message when event `photo_limit` reached *(studio plan)*

---

## 10. Monitoring (optional)

- [ ] `SENTRY_DSN` set on Render; `VITE_SENTRY_DSN` on Vercel — unhandled errors appear in Sentry
- [ ] `/api/health` returns 200

---

## 11. Transactional email *(run after custom domain + Resend are configured)*

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

**Sign-off:** Date ______  Event slug ______  Studio slug ______  Tester ______