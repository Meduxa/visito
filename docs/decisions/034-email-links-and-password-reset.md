# 034 — Sign-in emails: links that sign in, "forgot password"

**Context.** Before real salons sign up, email must come from visito.ge (Resend, step-by-step in `docs/email-setup.md`). Two gaps showed up: there was no "forgot password", and the confirmation link only confirmed the address — people then had to sign in again by hand.

**Decision.**
- Every link in a sign-in email goes to `/api/auth/confirm` with a one-time token (`token_hash` + `type`). The route checks it with Supabase (`verifyOtp`), which signs the person in on that device, then opens `next` (our own pages only, `safeNext`). Old links with `?code=` are handled too. A used or expired link leads to sign-in (or "forgot password") with a clear message.
- Our own email templates (`supabase/templates/confirmation.html`, `recovery.html`), pasted into Supabase, build that link from `{{ .RedirectTo }}` — so the same template works on visito.ge and on localhost — and pick Georgian, English or Russian from the account's language (`{{ .Data.locale }}`).
- **Forgot password:** `/forgot-password` (same answer whether or not the address has an account) → email → `/reset-password` (new password, then the dashboard; audit-logged per business).

**Consequences.** Supabase's URL configuration must allow `https://visito.ge/**` and `http://localhost:3000/**`. The templates must be pasted into every Supabase project (dev now, production later).
