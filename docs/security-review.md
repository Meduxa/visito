# Security review — before going live (Phase 6b, 2026-10-26)

What was checked, what was found and fixed, what remains. Re-check this list before the pilot and after big changes.

## Checked

| Area | How | Result |
|---|---|---|
| Tenant isolation | 189 database tests (RLS on every table, forced; every function's access) | ✅ pass |
| Secrets in the browser | Searched the production browser bundles for the server key and its name | ✅ none — the only match is supabase-js checking a key *prefix* |
| Who uses the server key | `createAdminClient` / `SUPABASE_SECRET_KEY` only in server-only files: public booking, SMS sending, jobs, unsubscribe | ✅ every use filters by a business resolved on the server |
| Every change goes through a checked entry point | All server actions use `managerContext` / `memberContext` (role + read-only status) or check the owner / platform admin explicitly | ✅ |
| Public pages | Booking page, manage link (192-bit key, stored hashed), unsubscribe link (HMAC-signed), SMS codes (hashed, 5 tries, rate-limited) | ✅ (decision 007) |
| Background jobs | `/api/cron/*` need `CRON_SECRET` in production (constant-time comparison) | ✅ |
| Personal data in logs | Server-action argument logging off; errors log codes only | ✅ |
| HTML injection | One `dangerouslySetInnerHTML`: the QR code SVG generated on our server from our own URL | ✅ |
| Packages | `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| Browser headers | CSP (scripts/connections only from us and Supabase, no framing, no plugins, forms only to us), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS, no `X-Powered-By` | ✅ added, tested; no page content blocked |

## Found and fixed in this review

- **Excel formula injection**: text people typed (e.g. a client's name from the booking page starting with `=`) would run as a formula when the owner opened an export. All text cells in both Excel exports are now neutralised (`src/lib/excel-safe.ts`, tested).

## Remaining risks (accepted for now)

1. **CSP allows inline scripts** (`'unsafe-inline'`), needed by Next.js without per-request nonces. It still blocks scripts from other sites. Later: nonce-based CSP in the proxy.
2. **Read-only (suspended) is enforced in the app's entry points**, not in every database policy (decision 009). New server actions must use the context helpers.
3. ~~No CAPTCHA yet~~ — **Cloudflare Turnstile** added (decision 036, 2026-11-15) on booking codes, bookings without a code, sign-up and forgot password, on top of the trap field and rate limits. Switch on with the real keys on Netlify.
4. **Supabase free plan: no automatic backups** and the project pauses after 7 days without activity (Levan's choice to start, 2026-10-26). Our own nightly backup (see `docs/go-live.md`) until the upgrade.
5. **Fake SMS provider** until an SMS company is chosen: no real SMS codes, so online booking with codes cannot go live yet.

## Before go-live — settings to verify in the production Supabase project

- [ ] Authentication → email confirmation **on**; minimum password length 10; leaked-password protection on (if the plan offers it).
- [ ] Authentication → URL configuration: Site URL = the production address; redirect URLs only ours.
- [ ] All migrations applied (`supabase db push`) and `npm.cmd run test:rls` pointed at a **staging copy**, never at production data.
- [ ] Netlify environment: `SUPABASE_SECRET_KEY`, `CRON_SECRET` set; `ALLOW_FAKE_SMS` **not** set.
- [ ] Your account added as platform admin (`npm.cmd run platform-admin -- you@…`); demo accounts never created in production (`db:seed` refuses URLs containing "prod").
