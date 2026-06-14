# Supabase Setup for Snapic

## 1. Create project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **anon public** key (Settings → API).
3. Note your **JWT Secret** (Settings → API → JWT Settings).
4. Copy the **service_role** key (server only — never expose to frontend).

## 2. Run migrations

Install [Supabase CLI](https://supabase.com/docs/guides/cli) or paste SQL from:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_storage.sql`

Into the Supabase SQL Editor and run in order.

## 3. Enable auth providers

Authentication → Providers:

- **Email**: enable magic link / OTP
- **Google**: enable and add OAuth client ID/secret

Authentication → URL Configuration:

- Site URL: `https://frontend-seven-mocha-96.vercel.app` (your Vercel URL)
- Redirect URLs: add `http://localhost:5173/**` and your production URL

## 4. Bootstrap super admin

After your first signup (email or Google):

```sql
UPDATE public.profiles
SET global_role = 'super_admin'
WHERE email = 'your@email.com';

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "super_admin"}'::jsonb
WHERE email = 'your@email.com';
```

## 5. Environment variables

### Vercel (frontend)

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE_URL=https://snapic-api.onrender.com
```

### Render (backend)

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ALLOWED_ORIGINS=https://frontend-seven-mocha-96.vercel.app
SNAPIC_ALLOW_VERCEL=true
```

## 6. Verify

- Sign in at `/login`
- Super admin: open `/admin`
- Create an event, set status to `active`
- Guest link: `/e/your-event-slug`
