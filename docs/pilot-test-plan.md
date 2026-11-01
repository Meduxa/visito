# Pilot: what is needed and how we test

For Levan and his partner (2026-10-29). Part A lists what must exist before real salons use
Bookeria; Part B is the testing plan, from our own tests on the demo site to the first salons.

---

## Part A — what the pilot needs

### A1. Accounts and services (Levan)

| # | What | Why | Cost (approx.) | Status |
|---|---|---|---|---|
| 1 | **Domain `bookeria.ge`** (+ `bukeria.ge` as a redirect, decision 013) | Real address; short salon addresses `teka.bookeria.ge` | ~30–60 ₾ / year each | to do |
| 2 | **SMS company** (Georgian, with an API and a registered sender name "Bookeria") | Login codes, confirmations, reminders | per SMS, ~0.03–0.05 ₾ | to choose — then Claude writes its adapter (1 session) |
| 3 | **Email: Resend** (EU region) + the domain verified | Sign-up confirmation, password reset, invites; Supabase's built-in email does not reach strangers | free up to 3,000 / month | to do |
| 4 | **Supabase production project** on **Pro** (Frankfurt) | Real client data apart from the demo; daily backups; no pausing | ~$25 / month | to do |
| 5 | **Netlify Pro** (or stay free and watch credits) | Enough credits for regular updates; server in **Frankfurt** (speed) | ~$19–20 / month | decide |
| 6 | **Cloudflare Turnstile** key (free) | Stops bots from filling the booking page | free | to do |
| 7 | **Sentry** (EU, free plan) | We see errors before salons call us | free | to do |

### A2. Legal and business (Levan)

| # | What | Why |
|---|---|---|
| 8 | **Legal form** to invoice salons (individual entrepreneur or LLC), bank account | Salons pay you; you issue invoices |
| 9 | **Lawyer review** of Privacy policy, Terms, Data Processing Agreement (texts exist at `/legal/...`) | Georgian Law on Personal Data Protection — Bookeria is the processor, salons the controllers |
| 10 | **Ask the lawyer**: anything to register/notify with the Personal Data Protection Service; health data rules for dental notes | Dental notes are special-category data |
| 11 | **Pilot agreement** (1 page): free period, what you expect (use it daily, give feedback), what you promise (support, data export at any time) | Clear expectations both ways |
| 12 | **Plan prices** in `/admin/plans` | Shown on the landing page once set; needed after the free period |

### A3. Support and materials (Levan + partner)

| # | What |
|---|---|
| 13 | **Support channel**: one phone / WhatsApp / Viber number + support email, and who answers when |
| 14 | **Onboarding checklist** for a salon (services, staff, hours, website, QR code at the desk) — 30–60 min visit. Excel templates for services, clients and bookings: `docs/pilot/import-templates` |
| 15 | **Short video or 1-page guide** in Georgian for staff (calendar, new booking, checkout) |
| 16 | **Feedback form** (Google Form) + a weekly 15-min call with each pilot salon |

### A4. Technical work (Claude)

| # | What | When |
|---|---|---|
| 17 | SMS company adapter + test with real phones | when the company is chosen |
| 18 | Production setup: new Supabase project, migrations, your admin account, Netlify env, domain, short addresses, Resend SMTP | when 1, 3, 4 exist (`docs/go-live.md`) |
| 19 | Check the SMS job (every 5 minutes) runs on production without errors | with 18 |
| 20 | Turnstile on the booking page; Sentry on | when keys exist |
| 21 | Security review "before go-live" (`docs/security-review.md`) + backup **restore test** | before the first real salon |
| 22 | Speed check on production (calendar, booking page) | after 18 |

---

## Part B — testing plan

Four stages. Each stage ends with a **go / no-go** check; we move on only when it passes.

| Stage | Where | Who | How long |
|---|---|---|---|
| 1. Internal test | demo site `bookeria1.netlify.app` | Levan + partner | 1 week |
| 2. Production check | `bookeria.ge` (real setup, test business) | Levan + Claude | 2–3 days |
| 3. Friendly pilot | `bookeria.ge` | 2–3 businesses you know (1–2 salons, 1 dental clinic) | 4 weeks |
| 4. Wider pilot | `bookeria.ge` | 5–10 businesses | 4–6 weeks |

### How to report a problem (all stages)

Use the ready-made tracker **`docs/pilot/bookeria-pilot-tracker.xlsx`** (upload it to Google Drive and open it with Google Sheets to share it). Its Problems tab has one line per problem, with these columns:

| Date | Who | Device + browser | Language | Page (copy the address) | What I did | What I expected | What happened | Screenshot | Severity |
|---|---|---|---|---|---|---|---|---|---|

**Severity**: **A** — data wrong or lost, money wrong, someone sees another salon's data, booking impossible → stop and tell Claude at once. **B** — a feature doesn't work, there is a workaround. **C** — looks wrong, text unclear, idea.

Never put real client names or phone numbers in the sheet — describe them ("client with 2 visits").

---

### Stage 1 — internal test on the demo site (1 week)

Demo accounts (password `Demo-Bookeria-2026`): `salon.owner@demo.test`, `salon.admin@demo.test`,
staff of the salon, `dental.owner@demo.test`, `dental.doctor@demo.test`, `platform.admin@demo.test`.
Test on **a phone (Android and iPhone if possible) and a computer**, in **Georgian, English and Russian**.
Use made-up names and phones like `599 00 00 01`. No real SMS or emails are sent on the demo.

Split the work: **partner = client + staff view**, **Levan = owner + admin view**, then swap for a day.

#### 1.1 Client: online booking (phone first)

| # | Scenario | Expected |
|---|---|---|
| 1 | Open the salon website, read about, photos, team, hours, map | Everything readable on a phone, Book button visible |
| 2 | Book "by service": service → any specialist → date → time → name/phone | Confirmation screen with date, time, specialist; booking appears in the owner's calendar |
| 3 | Book "by specialist" | Only that specialist's services and times |
| 4 | Two services in one visit | Total time and price add up |
| 5 | Try a day the salon is closed / a time already taken | Not offered |
| 6 | Same time from two phones at once | Only one gets it, the other sees "time taken" |
| 7 | Open the "manage my booking" link from the confirmation; move it; cancel it | Calendar updates; cancelling inside the no-cancel window is refused |
| 8 | Switch language on the booking page | Everything translated, no English left in Georgian |
| 9 | Dental clinic booking page | Works the same, clinic theme |
| 10 | Marketing tick boxes left empty vs ticked | Client card shows consent only when ticked |

#### 1.2 Staff (specialist) on a phone

| # | Scenario | Expected |
|---|---|---|
| 11 | Sign in, see today's own bookings | Only allowed bookings (setting "staff sees all") |
| 12 | Open a booking, mark arrived / done / no-show | Status changes everywhere |
| 13 | Try to open Settings, reports, export | Refused or hidden |
| 14 | Dental doctor: write a treatment note | Saved; staff of the salon can never see it |

#### 1.3 Admin / reception

| # | Scenario | Expected |
|---|---|---|
| 15 | New booking from the calendar for a new client by phone | Client created, phone stored as +995… |
| 16 | Move a booking to another time / specialist | Moves; refuses overlaps |
| 17 | Block time (lunch, day off) | No online bookings in that time |
| 18 | Cancel a booking; waitlist offer by SMS | Freed time offered to waiting clients |
| 19 | Checkout: price, discount, payment method | Receipt total correct in ₾, appears in reports |
| 20 | Search a client, open the card, history, notes | Correct history |
| 21 | Import clients from Excel (use the sample) | Imported without duplicates, no SMS sent |

#### 1.4 Owner

| # | Scenario | Expected |
|---|---|---|
| 22 | Services: add, edit price, variants, hide from online | Booking page updates |
| 23 | Team: invite a staff member, set hours, remove | Invite works; removed person can't sign in to this business |
| 24 | Business hours, holidays, online booking rules (how far ahead, cancel window, SMS code) | Booking page follows them |
| 25 | Website settings: cover, logo, about (3 languages), Instagram, theme | Website changes immediately |
| 26 | SMS templates and reminder times | Preview shows the right text |
| 27 | Reports: this month, by specialist, Excel download | Numbers match the bookings |
| 28 | Export all data (Excel/JSON); delete one client | Export opens; deleted client gone, bookings anonymous |
| 29 | Audit log | Shows who did what |
| 30 | Allow Bookeria support for 24 h, then end it | Platform admin can look, cannot change anything |
| 31 | Sign out of all devices | Other devices signed out on next click |

#### 1.5 Platform admin (Levan)

| # | Scenario | Expected |
|---|---|---|
| 32 | Businesses list, open one, extend trial, add SMS | Saved, written to the business's audit log |
| 33 | Plans: set names and prices | Landing page shows prices once all are set |
| 34 | Sign up a brand-new business from the landing page | Onboarding works end to end (on the demo the email step may not arrive — note it) |

#### 1.6 General

| # | Check |
|---|---|
| 35 | Install as an app on the phone ("Add to home screen"), open from the icon |
| 36 | Slow / no internet: clear message, nothing lost |
| 37 | Every page in ka / en / ru — note untranslated or awkward text |
| 38 | Dark mode on the phone |

**Go / no-go:** no open **A** problems; **B** problems fixed or accepted; Claude re-runs all automatic tests.

---

### Stage 2 — production check (2–3 days, after Part A items 1–7 and 17–22)

| # | Check | Expected |
|---|---|---|
| 1 | Open `bookeria.ge`, `www.bookeria.ge`, `bukeria.ge` | All reach the landing page over https |
| 2 | Sign up as a new business with your real email | Confirmation email arrives (inbox, not spam) |
| 3 | Password reset; invite a staff member | Emails arrive within a minute |
| 4 | Short address `yourtest.bookeria.ge` on a phone | Website opens; booking works |
| 5 | Book with **your real phone**: SMS code, confirmation | SMS arrive within seconds, sender "Bookeria" |
| 6 | Booking for tomorrow + 24 h / 2 h reminders | Reminders arrive on time (up to 5 min late) |
| 7 | SMS balance goes down; admin top-up | Correct counts |
| 8 | Marketing SMS unsubscribe link | Client's consent switched off |
| 9 | Sentry: Claude triggers a test error | Error visible in Sentry |
| 10 | Backups: first daily backup exists; restore test done once | Yes |
| 11 | Two businesses: neither sees the other's data (Claude also runs the automatic isolation tests against production setup) | Yes |
| 12 | Speed: calendar and booking page on a phone over mobile data | Under ~2 s after the first load |

Then delete the test business (or keep it as your own demo).
**Go / no-go:** all 12 pass.

---

### Stage 3 — friendly pilot (4 weeks, 2–3 businesses)

**Choose**: owners you know, who will answer the phone; at least one salon with 3+ staff and one
dental clinic; they use Instagram (to test the booking link).

**Week 0 — onboarding visit (1 hour each)**
- Sign the pilot agreement; owner creates the account (or you do it together).
- Enter services, staff, hours; import clients; set up the website; print the QR code.
- Train reception and staff (15 min each); put the booking link in Instagram bio.
- Agree on the support channel.

**Weeks 1–4 — daily use**
- They keep their old system (paper/Excel) **in parallel in week 1** only, then switch.
- Weekly 15-min call: what was slow, confusing or missing.
- You watch `/admin` daily: bookings per business, SMS failures, last activity.
- Claude fixes A problems the same day, B problems in a weekly update (one deploy).

**What we measure**

| Measure | Target |
|---|---|
| Bookings entered in Bookeria (vs their real visits) | > 90 % by week 2 |
| Online bookings (website / Instagram) | at least some every week |
| No-shows (compare with before, ask the owner) | lower |
| SMS delivered | > 98 % |
| A-problems | 0 open |
| Owner answer to "Would you pay for this?" at the end | yes, and at what price |

**Go / no-go:** businesses still use it daily in week 4, no open A problems, they would pay.

---

### Stage 4 — wider pilot (5–10 businesses, 4–6 weeks)

- Owners **sign up by themselves** from the landing page (tests onboarding without you).
- Free period ends → first invoices at the agreed plan price.
- Support load: how many questions per business per week — write down repeated ones and turn them into the guide or a fix.
- Check costs: SMS per business per month, Supabase and Netlify usage.

**After stage 4:** decide prices, start marketing (video, Instagram), and continue the roadmap
(marketing email, online payments).
