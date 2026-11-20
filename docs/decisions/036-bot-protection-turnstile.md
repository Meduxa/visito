# 036 — Bot protection with Cloudflare Turnstile

**Context.** Anonymous visitors can make Visito spend money or send mail: every online-booking SMS code is a paid SMS, and sign-up / "forgot password" send emails (Resend quota). Until now the only defences were a hidden trap field, rate limits (hashed phone and IP) and the SMS code itself (security review, Levan 2026-10-26: Turnstile before launch).

**Decision.**
- **Cloudflare Turnstile** (free, privacy-friendly, no puzzles for most people), mode "interaction-only": invisible unless Cloudflare is unsure, then a small "verify you are human" box appears.
- Checked **on the server** (`src/integrations/captcha`) before: sending an online-booking SMS code; an online booking when the business switched codes off; sign-up; "forgot password". A token works once; the form takes a fresh one for every attempt.
- **Off until configured**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public) and `TURNSTILE_SECRET_KEY` (secret). Without them no widget is shown and nothing changes.
- A missing or rejected token is refused ("couldn't confirm that you are a person"). If Cloudflare itself cannot be reached, the request is allowed and logged — the rate limits still apply — so an outage elsewhere never blocks real clients from booking.
- Security headers allow `challenges.cloudflare.com` for the script, its frame and its connection.

**Consequences.** Locally and in tests Cloudflare's official test keys are used (always pass). Real keys go only to Netlify (`docs/go-live.md`). The privacy policy should list Cloudflare among providers once switched on. Also fixed while testing: on the sign-in page "Forgot password?" now comes after the password field, so Tab goes email → password.
