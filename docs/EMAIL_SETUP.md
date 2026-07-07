# Email setup for snapic.me

Snapic uses two email layers on the same domain:

| Layer | Provider | Purpose |
|-------|----------|---------|
| **Inbound** | Cloudflare Email Routing | `hello@`, `privacy@` → your Gmail inbox |
| **Outbound (app)** | [Resend](https://resend.com) | Welcome, rejection, album-ready, and team-invite emails from the API |

They coexist: Cloudflare MX records stay on the root domain; Resend uses a `send` subdomain for SPF/DKIM.

---

## 1. Cloudflare Email Routing (inbound — already configured)

In Cloudflare → **Email → Email Routing**:

- `hello@snapic.me` → your Gmail
- `privacy@snapic.me` → your Gmail (or same destination)

Gmail **Send mail as** (optional): use `smtp.gmail.com` with a Google App Password so you can reply from `@snapic.me`.

---

## 2. Resend (transactional outbound)

### Add the domain

1. Sign in at [resend.com](https://resend.com) → **Domains → Add domain**
2. Enter `snapic.me`
3. Copy the DNS records Resend shows (typically on the `send` subdomain)

### Add DNS in Cloudflare

Add Resend’s records **exactly as shown** in the Resend dashboard. Do **not** remove your existing records:

| Keep (root) | Resend adds (usually `send` subdomain) |
|-------------|----------------------------------------|
| MX → `route*.mx.cloudflare.net` | MX + TXT SPF on `send` |
| TXT SPF with Cloudflare + Google | DKIM CNAMEs on `send` |
| `_dmarc`, Cloudflare DKIM | — |

Resend verification uses `send.snapic.me`, so it does not conflict with Cloudflare inbound MX on `@`.

Click **Verify** in Resend. Propagation is usually minutes, sometimes up to a few hours.

### Create an API key

Resend → **API Keys → Create** → copy the key (starts with `re_`).

---

## 3. Render environment variables

On the **snapic-api** web service in Render, set:

```env
RESEND_API_KEY=re_xxxxxxxx
SNAPIC_FROM_EMAIL=Snapic <hello@snapic.me>
SNAPIC_REPLY_TO_EMAIL=hello@snapic.me
SNAPIC_APP_URL=https://snapic.me
ALLOWED_ORIGINS=https://snapic.me,https://www.snapic.me
```

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Sends transactional HTML emails |
| `SNAPIC_FROM_EMAIL` | From address (must use a verified Resend domain) |
| `SNAPIC_REPLY_TO_EMAIL` | Reply-To header so couples can reply to `hello@snapic.me` |
| `SNAPIC_APP_URL` | Links in emails point here (setup, guest, live URLs) |
| `ALLOWED_ORIGINS` | CORS for the frontend on your custom domain |

Redeploy the API after saving.

---

## 4. Verify end-to-end

### Inbound (Cloudflare)

- [ ] Send a test message to `hello@snapic.me` → arrives in Gmail
- [ ] Send to `privacy@snapic.me` → arrives in Gmail

### Outbound (Resend + API)

Follow [SMOKE_TEST.md](./SMOKE_TEST.md) section 11:

- [ ] Approve a signup request → couple receives Snapic welcome email
- [ ] Reject a signup → couple receives rejection email
- [ ] Set event to Active → optional live email reaches admins
- [ ] Admin UI does **not** show “email could not be sent” toast
- [ ] Render logs have no Resend errors

### Reply path

- [ ] Reply to a transactional email → lands in your Gmail via Cloudflare routing

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Resend domain not verifying | Match record names/values exactly; use `send` not `@` for Resend SPF/MX |
| Emails go to spam | Confirm Resend domain verified; keep `_dmarc` at `p=none` while testing |
| “Email could not be sent” in admin | Check `RESEND_API_KEY` and `SNAPIC_FROM_EMAIL` on Render |
| Links in emails use wrong host | Set `SNAPIC_APP_URL=https://snapic.me` |
| Sandbox only delivers to your Resend account email | Verify the domain in Resend (step 2) — unverified domains are sandboxed |
| CORS errors on snapic.me | Add both `https://snapic.me` and `https://www.snapic.me` to `ALLOWED_ORIGINS` |

---

## Addresses used in the product

| Address | Use |
|---------|-----|
| `hello@snapic.me` | General contact, transactional From/Reply-To |
| `privacy@snapic.me` | Privacy policy and data requests |

Both should exist as Cloudflare routing rules forwarding to your team inbox.
