# Going live — step by step

For Levan. You create the accounts and paste the keys yourself — never into the chat, only into the
websites named below (or into `.env.production.local` on your laptop). Claude can run every command
marked **(Claude can do this)** once you say the step before it is done.

**Order:** 1 GitHub → 2 Supabase (production) → 3 Sentry → 4 Netlify → 5 your admin account →
6 checks → 7 backups. Email (Resend) and the domain come together later (step 8).

**Demo site (live since 2026-10-28):** https://visito.ge — Netlify project `visito-ge`,
built from GitHub `main` on every push, connected to **visito-dev** (demo data only, never real
clients). Lessons from setting it up, which apply to production too:
- Netlify sees only the GitHub repositories you allowed: GitHub → Settings → Applications → Netlify →
  Repository access → add the repository.
- Type variable names by hand; values without quotes or spaces. A secret variable shows a lock and
  can only be replaced, not read. After changing a variable: Deploys → Trigger deploy.
- New Netlify projects may start with **Team login protection** (visitors see "This site is
  private"): Project configuration → Access & security → Visitor access → "Non-production deploys only".
- Supabase → Authentication → URL Configuration → Redirect URLs must include the site address + `/**`.

---

## 1. GitHub — the code, off the laptop

1. Sign in at github.com (or create a free account).
2. **New repository** → name `visito` → **Private** → do *not* add a README or .gitignore → Create.
3. Copy the address it shows, like `https://github.com/YOUR-NAME/visito.git`.
4. Send me only that address. **(Claude can do this)**:

   ```
   git remote add origin https://github.com/YOUR-NAME/visito.git
   git push -u origin main
   ```

   Windows asks you to sign in to GitHub in a browser window the first time — that is expected.

After the push, GitHub runs the automatic checks (typecheck, lint, unit tests) on every change
(`.github/workflows/ci.yml`).

## 2. Supabase — the production database

1. supabase.com → **New project** → name `visito-prod` → **Region: Central EU (Frankfurt)** →
   a long database password → save it in your password manager → Create. Free plan for now
   (your choice, 2026-10-26 — see step 7 for backups).
2. When it is ready: **Project Settings → API Keys**. Keep the page open; you need the
   **Project URL**, the **publishable** key and the **secret** key.
3. On your laptop, create the file `.env.production.local` in the Visito folder (it is never
   uploaded — `.gitignore` excludes it) with:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROD-REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   ```

4. Create the tables: **Connect** (top of the Supabase page) → **Session pooler** → copy the
   connection string, put your database password in it, then **(Claude can do this, you paste the
   string into the terminal yourself)**:

   ```
   npx.cmd supabase db push --db-url "postgresql://postgres.YOUR-PROD-REF:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
   ```

   This does not touch the dev project link; `db:seed` and the database tests refuse to run
   against anything but the dev project.
5. **Authentication → Sign In / Providers → Email**: confirm email **on**, minimum password
   length **10**.
6. **Authentication → URL Configuration**: Site URL = your Netlify address from step 4
   (`https://….netlify.app`); add the same address + `/**` to Redirect URLs.

> ⚠ Supabase's built-in email sender only delivers to your own team's addresses and a few per
> hour. Real salon owners can sign up only after step 8 (Resend + domain). Until then, invite
> testers through **Team → Invite** and copy the link the app shows.

## 3. Sentry — error reports (optional but recommended)

1. sentry.io → sign up → choose data region **EU (Germany)**.
2. Create a project → platform **Next.js** → copy the **DSN** (`https://…ingest.de.sentry.io/…`).
   The DSN is not secret.

## 4. Netlify — the website

1. app.netlify.com → **Sign up with GitHub** → **Add new site → Import an existing project** →
   GitHub → `visito`. Netlify reads `netlify.toml`; leave the build settings as they are.
2. Before the first deploy, **Site configuration → Environment variables** → add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_APP_URL` | `https://YOUR-SITE.netlify.app` (Netlify shows the name) |
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 2 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | from step 2 |
   | `SUPABASE_SECRET_KEY` | from step 2 — tick **Contains secret values** |
   | `CRON_SECRET` | a new random value (below) — secret |
   | `EMAIL_PROVIDER` | `fake` (until step 8) |
   | `SMS_PROVIDER` | `tnet` once TNET finished onboarding (decision 027); `fake` until then — SMS are then logged as "not sent" |
   | `TNET_BASE_URL` | the base_url TNET supplied |
   | `TNET_CLIENT_ID` | client_id from TNET |
   | `TNET_SECRET_HASH` | secret_hash from TNET — **mark as secret** |
   | `TNET_SENDER` | the default sender title exactly as TNET registered it (e.g. `Visito`; case matters) |
   | `TNET_WEBHOOK_SECRET` | the 64-character signing secret for delivery reports — **mark as secret** |
   | `PAYMENTS_PROVIDER` | `flitt` once Visito's own Flitt merchant is ready (decision 031); `none` until then (owners pay by transfer) |
   | `FLITT_MERCHANT_ID` | Visito's Flitt merchant ID (not the test 1549901) |
   | `FLITT_SECRET_KEY` | its payment key — **mark as secret** |
   | `NEXT_PUBLIC_SENTRY_DSN` | from step 3 (or leave out) |

   A random `CRON_SECRET` — run this in PowerShell and paste the result into Netlify:

   ```
   $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   ```

   Never set `ALLOW_FAKE_SMS` on Netlify.
3. **Site configuration → Build & deploy → Functions → Region**: **EU Central (Frankfurt)** if your
   plan offers the choice (the server then sits next to the database).
4. **Deploys → Trigger deploy**. When it is green, open the site.
5. The two scheduled jobs (`netlify/functions/cron-sms.ts` every 5 minutes, `cron-daily.ts` at 03:30
   Tbilisi) start by themselves; **Logs → Functions** shows them answering `200`.

## 5. Your admin account

1. On the live site, sign up with your own email (see the ⚠ in step 2 about email).
2. **(Claude can do this)**:

   ```
   node --env-file=.env.production.local scripts/platform-admin.mts YOUR@EMAIL
   ```

3. Open `https://YOUR-SITE.netlify.app/ka/admin`.

## 6. Checks on the live site

- [ ] Sign-in page opens in Georgian; the padlock shows HTTPS.
- [ ] On a phone: "Install the app" (Android) / Share → Add to Home Screen (iPhone) works.
- [ ] Create a test business → services → staff → booking page `/book/…` opens.
- [ ] With **SMS code switched off** (Settings → Business) a test booking from a phone works.
- [ ] Netlify function logs show both jobs answering `200`.
- [ ] Sentry: an error appears there after you open `/ka/this-page-does-not-exist`? (404s are not
      errors — instead ask Claude for a one-off test error.)
- [ ] Measure speed again (`docs/performance.md`).

## 7. Backups (while on the free plan)

The free plan keeps **no backups**. Until you upgrade to Pro (~$25/month, daily backups),
the GitHub workflow `.github/workflows/backup.yml` makes an **encrypted** nightly copy:

1. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_DB_URL` = the Session pooler connection string from step 2.4 (with password)
   - `BACKUP_PASSPHRASE` = a long new passphrase — keep it in your password manager; without it
     the backups cannot be opened.
2. **Actions → Backup → Run workflow** once; a file `visito-YYYY-MM-DD.tgz.gpg` appears under
   the run's **Artifacts** (kept 30 days).
3. **Restore test** (do it once, the spec requires it): download an artifact, then in Git Bash:
   `gpg -d visito-….tgz.gpg > backup.tgz && tar xzf backup.tgz` → load `roles.sql`, `schema.sql`,
   `data.sql` with `psql` into a **new, empty** Supabase project and open a few clients.
   Claude can walk you through it.

> Ask your lawyer whether an encrypted copy on GitHub (a US company) is acceptable for clients'
> data — upgrading Supabase to Pro removes the need for it.

The free plan also **pauses a project after 7 days without activity** — fine once salons use it
daily, but check it during quiet test weeks.

## 8. Later, before inviting real salons

- **Domain** (`visito.ge`, bought 2026-11-06 at RE:HOST; nameservers point to Netlify DNS, HTTPS on): set `NEXT_PUBLIC_APP_URL=https://visito.ge` on Netlify and add `https://visito.ge` to Supabase's Site URL / redirect URLs.
- **Short salon addresses** (`teka.visito.ge`, decision 016): the Netlify free plan does not accept a wildcard alias, so add each business as a domain alias (`orchidea.visito.ge`; the certificate already covers `*.visito.ge` because Netlify DNS manages the domain) — on Pro, ask Netlify support to switch on wildcard subdomains, then set `SITE_DOMAIN=visito.ge` in Netlify's environment variables and redeploy. Check: open a business's short address on a phone and book a test visit.
- **Email (Resend)** — full step by step in `docs/email-setup.md` (DNS records, Netlify, Supabase SMTP, our email templates). In short: resend.com → add and verify your domain (EU region) → API key → Netlify:
  `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY` (secret), `EMAIL_FROM=Visito <no-reply@your-domain>`.
  Supabase → **Authentication → Emails → SMTP settings** → use Resend's SMTP (host
  `smtp.resend.com`, port 465, user `resend`, password = the API key) so sign-up emails arrive.
- **SMS company**: TNET (decision 027) — give TNET the sender titles and the callback address `https://visito.ge/api/webhooks/sms/tnet`, receive base_url, client_id, secret_hash and the webhook signing secret, set the `TNET_*` values and `SMS_PROVIDER=tnet` on Netlify, then send a test SMS from Settings → SMS, **Cloudflare Turnstile** on the booking page, **lawyer's texts**
  for the legal pages, **plan prices** in `/admin/plans`, **Supabase Pro**.
- Go through `docs/security-review.md` → "Before go-live".
