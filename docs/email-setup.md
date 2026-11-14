# Email from visito.ge — step by step (Resend)

For Levan. About 30 minutes of clicking, then up to an hour waiting for DNS.
You create the account and paste the key **only into Netlify and Supabase** — never into the chat.
When a step says **(Claude)**, tell me it is done and I continue.

What it gives: sign-up confirmation emails, "forgot password" emails, team invitations and
online-booking confirmations arrive from **Visito &lt;no-reply@visito.ge&gt;** instead of Supabase's
test sender (which allows only a few emails per hour and often lands in spam).

---

## 1. Resend account (5 min)

1. Open **resend.com** → **Sign up** (Google sign-in is fine). The free plan sends 3,000 emails a
   month, 100 a day — enough for the pilot.
2. Left menu **Domains** → **Add domain**.
   - Domain: `visito.ge`
   - Region: **Ireland (eu-west-1)** — keeps data in the EU.
   - **Add**.
3. Resend now shows a table of **DNS records** (usually 3–4 rows). Leave this tab open.

## 2. DNS records in Netlify (10 min)

`visito.ge` uses Netlify DNS, so the records go there.

1. **app.netlify.com** → **Domains** (left menu, team level) → **visito.ge** → **DNS settings** →
   **Add new record**.
2. Add **every row** from Resend's table, one by one, copying **Type**, **Name** and **Value**
   exactly. They look like this (your values come from Resend):

   | Type | Name (host) | Value | Priority |
   |---|---|---|---|
   | TXT | `resend._domainkey` | `p=MIGfMA0GCSq…` (long) | — |
   | MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | 10 |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |

   - In Netlify's **Name** field type only the part before `.visito.ge` (e.g. `send`,
     `resend._domainkey`); Netlify adds the domain itself.
   - These records live under `send.` and `resend._domainkey.` — they do **not** touch the website
     or any mailbox you may add later.
3. Add one more record (recommended, protects your name from fakes):
   | TXT | `_dmarc` | `v=DMARC1; p=none;` | — |
4. Back in Resend → **Verify DNS records**. It turns **Verified** within minutes, at most an hour.
   If not, compare each value letter by letter (a missing character is the usual cause).

## 3. API key (2 min)

1. Resend → **API Keys** → **Create API key**.
   - Name: `visito-netlify`
   - Permission: **Sending access**
   - Domain: `visito.ge`
2. Copy the key (starts with `re_`). Resend shows it **once**. Keep it only for the next two steps.

## 4. Netlify — emails sent by the app (5 min)

**app.netlify.com** → project **visito-ge** → **Project configuration → Environment variables** →
**Add a variable** (type the names by hand):

| Name | Value | Secret? |
|---|---|---|
| `EMAIL_PROVIDER` | `resend` | no |
| `EMAIL_API_KEY` | the `re_…` key | **yes — mark as secret** |
| `EMAIL_FROM` | `Visito <no-reply@visito.ge>` | no |
| `NEXT_PUBLIC_APP_URL` | `https://visito.ge` (check it is already like this) | no |

Then **Deploys → Trigger deploy → Deploy project**.

## 5. Supabase — sign-in emails (10 min)

Today this is the project **visito-dev** (the one visito.ge uses). Repeat the same on the
production project when it exists.

1. **supabase.com** → project → **Authentication → Emails** (or **Settings → SMTP**) →
   **Enable custom SMTP**:
   - Sender email: `no-reply@visito.ge`
   - Sender name: `Visito`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the same `re_…` key
   - **Save**.
2. **Authentication → Rate limits** → "Rate limit for sending emails": set **30** per hour
   (the default with custom SMTP is very low).
3. **Authentication → URL Configuration**:
   - Site URL: `https://visito.ge`
   - Redirect URLs — these two lines must be there:
     `https://visito.ge/**` and `http://localhost:3000/**`
4. **Authentication → Email Templates**:
   - **Confirm signup** → Subject: `Visito — დაადასტურეთ ელფოსტა / Confirm your email` →
     Body: paste everything from `supabase/templates/confirmation.html` → **Save**.
   - **Reset password** → Subject: `Visito — ახალი პაროლი / New password` →
     Body: paste everything from `supabase/templates/recovery.html` → **Save**.
   (Each email appears in Georgian, English or Russian — the language the person chose.)
5. **Authentication → Sign In / Providers → Email**: **Confirm email** = on.

## 6. Tell me — (Claude)

I will then check, with real addresses you give me in the chat (only addresses, never keys):
- a new sign-up gets the Georgian confirmation email, the button signs them in and opens
  "Set up your business";
- "Forgot password?" sends the email, the link opens "Choose a new password";
- a team invitation and an online-booking confirmation arrive from no-reply@visito.ge;
- the emails do not land in spam (Gmail, Outlook).

## If something goes wrong

- **Resend says "Not verified"** after an hour: a record was copied wrongly — open the record in
  Netlify and compare.
- **No email at all**: Supabase → **Authentication → Logs**; Resend → **Emails** (each attempt
  is listed with its error).
- **Email arrives, link says "expired"**: the link was already used or is older than one hour —
  ask for a new one. With our templates (step 5.4) the link works on any device.
