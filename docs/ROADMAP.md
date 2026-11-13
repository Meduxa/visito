# Visito — Build Roadmap

Work one phase at a time. Claude Code ticks the boxes and updates `CHANGELOG.md` at the end of each phase. Rough durations assume a few focused hours per day.

## Phase 0 — Foundation (≈ 2–4 days)
✅ Done 2026-10-25

- [x] Tools checked (Node 24 LTS, Git), Git repo initialised — no Docker (no admin rights on the laptop), see decision 002
- [x] Next.js 16 + TypeScript (strict) + Tailwind 4 + shadcn/ui
- [x] Supabase EU cloud **dev** project `visito-dev` (Frankfurt) instead of local Docker; env files; typed Supabase clients (server, browser, admin)
- [x] next-intl (ka default — always, not from browser language — en, ru), temporary Noto Sans Georgian font (final font in Phase 2)
- [x] ESLint, Prettier, Vitest, Playwright, RLS test setup (Vitest integration tests against the dev project)
- [x] Migration: tenants, profiles, memberships, invitations, audit_log + RLS + isolation tests (32)
- [x] Sign-up → create business (salon/dental) → invite staff (link) → accept → dashboard shell (sidebar desktop, bottom nav mobile)
- [x] Seed: demo salon + demo dental clinic (`npm.cmd run db:seed`)
- [x] `APP_NAME` constant
- [ ] Production Supabase project (separate from dev) — create before the pilot
- [x] Transactional email provider: Resend wired (Phase 6b, decision 011) — [ ] switch on with the domain and key

## Phase 1 — Services, staff, clients (≈ 1 week) — SPEC 4.1–4.4
✅ Done 2026-10-26 (built after the design foundation, see Phase 2 and decision 004)

- [x] Business settings (details, opening hours, holidays/closed days, booking rules, staff visibility)
- [x] Locations (data model; one primary location in UI, created with the business) — [x] several branches, Standard and above (decision 032, 2026-11-13)
- [x] Service categories (reorder with buttons), services (fixed / from / range price), variants, add-ons, per-staff price/duration
- [x] Price list import (paste or CSV/XLSX) with preview and error report — tested with two real Georgian price lists
- [x] Staff profiles (photo, login link), weekly schedules (split shifts), date changes, time off, services per staff
- [x] Resources (chairs/rooms) for dental
- [x] Clients: card, server-side search, tags, important note, marketing consents with history, preferred staff, block online booking
- [x] Client import (paste or CSV/XLSX), duplicate detection (file + existing), merge
- [x] Client export (JSON) / anonymise (owner only, audited)
- [x] Visit history on the client card — done in Phase 3a
- [ ] Staff levels — skipped by decision (per-staff price covers it)

## Phase 2 — Design system (≈ 3–5 days)
Design foundation done 2026-10-26 from screenshots + videos (no Figma file yet). Remaining items wait for Figma / calendar.

- [x] References in `design/references/` with notes on what we take from each (no Figma link yet)
- [x] Tokens → `design/tokens.json` → CSS variables / Tailwind theme, light + dark, contrast checked (≥ 4.5:1)
- [x] Core components: buttons, inputs, selects, cards, status pills, stat cards, dialogs, sheets (details panel), tabs, toasts, empty states, avatar with staff colour, colour swatches
- [x] App shell: grouped sidebar (desktop), bottom navigation + "More" page (mobile), dark-mode switch
- [x] Phase 0 + 1 screens in the new style; checked at 375px and 1280–1440px
- [ ] Final fonts and visual check against a Figma file (when available)
- [ ] Date/time picker components (with the calendar, Phase 3)

## Phase 3 — Calendar and bookings (≈ 2 weeks) — SPEC 4.5–4.7
Split into 3a and 3b with a report in between (Levan, 2026-10-26). Staff may create and move only their own bookings; admin bookings start as confirmed.

### 3a ✅ Done 2026-10-27
- [x] Availability engine (booking-engine skill) with unit tests (17; #14 concurrency runs against the database)
- [x] Exclusion constraints against double booking (staff + resource), concurrency test
- [x] Calendar: day (by staff), week (one person), list (phone default), month counts — own grid, decision 005
- [x] Create / move (drag & drop) / resize / reassign / cancel bookings; multi-service visits back to back; walk-ins
- [x] Statuses + status history (incl. undo of cancel/no-show, no-show counter)
- [x] Realtime updates between admins
- [x] Staff view "My day": now / next / today / upcoming / past, actions, own numbers
- [x] Client card: visit history; dental treatment notes (doctors + owner only, every read audited)
- [x] Day view by chair/room for dental — done in 3b

### 3b ✅ Done 2026-10-26
- [x] Recurring bookings (every N weeks, X times, conflict list before saving; cancel this and all following)
- [x] Waitlist with suggestions when a slot frees up
- [x] Import existing bookings from CSV/Excel (column mapping, preview, conflict report, no SMS ever) — not yet tried on a real export from a salon's old system
- [x] Checkout: payment methods, split payment, discounts, tip, daily cash summary; owner decides whether admins see revenue
- [x] Dental: day view by chair/room
- [x] Speed: day view with 15 staff × 150 bookings loads in ~340 ms (test `perf_calendar`)
- [x] Panels load in parallel (GET /api/read, decision 006) — buttons no longer wait behind loading panels

## Phase 4 — Public online booking page (≈ 1 week) — SPEC 4.8 ✅ Done 2026-10-26
- [x] `/book/[slug]` flow, mobile-first, ka default (business card with call, map, hours, team)
- [x] Real availability, "any staff" option — same engine as the admin calendar, online rules
- [x] Consents (marketing unticked by default, recorded with source "booking page")
- [x] SMS OTP — on by default, owner can switch off; fake SMS provider until Phase 5 plugs in a real one
- [x] Manage-booking link `/m/[key]` (move / cancel within the cancellation window, then the business phone)
- [x] .ics "add to calendar", QR code, link sharing (settings card)
- [x] Rate limiting (per phone, per IP behind the host) and honeypot — Cloudflare Turnstile before launch (Levan, 2026-10-26)
- [x] Business photo gallery — done in Phase 6a

## Phase 5 — SMS (≈ 1 week) — SPEC 4.9 ✅ Done 2026-10-26 (without a real SMS company — Levan chooses later)
- [x] SMS adapter interface + fake provider for tests — [x] first real provider: sender.ge (decision 018, 2026-11-01) — [x] SMS company changed to TNET: adapter, duplicate guard, signed delivery reports (decision 027, 2026-11-12) — [ ] TNET onboarding (credentials, sender titles, callback secret), answers to the open questions in `docs/plans/tnet-sms.md`, test on a real phone
- [x] Templates (ka/en/ru) with variables, character & segment counter, live preview
- [x] Sender name settings and status (approval set by the server only)
- [x] Scheduled reminders job (idempotent), quiet hours — 2 h on by default, 24 h optional (Levan, 2026-10-26)
- [x] Message log with filters — [ ] delivery reports from the real provider (webhook → `sms_delivery`)
- [x] SMS credits ledger in SMS parts, 50 trial SMS (Levan, 2026-10-26), low-balance warning, top-up screen for the platform admin (done in Phase 6a)
- [x] Manual SMS to a client; promotion to clients who agreed (optional tag), unsubscribe link and page — hidden during the pilot (decision 033)
- [x] Pilot: automatic SMS only, texts written by Visito in `/admin/sms-texts` (decision 033, 2026-11-13) — [ ] switch `SMS_SALON_TOOLS` on after the pilot

## Phase 6 — Reports, settings, polish, production (≈ 1–2 weeks) — SPEC 4.12–4.15
Split into 6a (in the app) and 6b (production) with a report in between (Levan, 2026-10-26).

### 6a ✅ Done 2026-10-26
- [x] Dashboard home (today, month so far, occupancy, new clients, no-shows, birthdays, SMS) + onboarding checklist that ticks itself
- [x] Reports with filters (period, specialist) + Excel export; money hidden from those who may not see it
- [x] Audit log viewer, full business export (Excel + JSON), business deletion with a 14-day grace period
- [x] Trial + placeholder plans + staff limit; status banners; read-only when suspended (decision 009)
- [x] Platform admin area: businesses, plan/status/trial, SMS top-up, plans editor, global SMS log; monthly included SMS
- [x] Business photo gallery on the booking page

### 6b ✅ Code done 2026-10-26 — accounts and go-live by Levan (`docs/go-live.md`)
- [x] PWA: manifest, icons from the logo, install button / iPhone hint, offline page
- [x] Performance pass on the production build (all main pages < 1 s, `docs/performance.md`)
- [x] Security review (`docs/security-review.md`): security headers, package audit, Excel formula-injection fix
- [x] Accessibility: automatic WCAG 2.1 AA checks on 16 screens, fixes; keyboard-only check (see Before the pilot) — [ ] a screen-reader pass by a person
- [x] Legal pages as marked drafts (ka/en/ru) — [ ] lawyer's texts
- [x] Sentry and Resend wired, switched on by keys (decision 011)
- [x] Netlify config, scheduled jobs, CI on GitHub, encrypted nightly backup workflow (decision 012)
- [x] GitHub repo (Meduxa/visito, private) — code pushed, CI green (2026-10-26)
- [ ] Production: Supabase production project, Sentry, Netlify — **deferred until the pilot** (Levan, 2026-10-26: the free plan allows only 2 active projects and both are in use; plan: Supabase Pro at pilot time, which also brings backups). Follow `docs/go-live.md` from step 2 then.
- [ ] Later: domain + Resend (needed for real sign-ups), SMS company key on Netlify (sender.ge chosen), Turnstile, plan prices, Supabase Pro

## Before the pilot
- [x] Sign out of all devices (account menu, confirmation, audit log) — SPEC 4.14 (2026-10-28)
- [x] Waitlist: offer a freed time to waiting clients by SMS, one tap per client (2026-10-28)
- [x] Support access, view only (Levan, 2026-10-28): owner allows 24 h / 3 days and can end it; enforced by the database; every visit audit-logged — SPEC 4.15, decision 014
- [x] Keyboard-only check: every control on the booking page, dashboard, calendar, clients and settings shows focus; sign-in and booking work without a mouse (e2e `keyboard.spec.ts`, 2026-10-28)
- [ ] Cloudflare Turnstile on the booking page (when Levan has the key); a screen-reader pass by a person (e.g. NVDA)
- [x] Short salon addresses `name.visito.ge` (code done 2026-10-28, decision 016; on this laptop: `orchidea.localhost:3000`); old `/book/...` links keep working; reserved names refused — [ ] at go-live: register visito.ge, wildcard domain on Netlify, `SITE_DOMAIN=visito.ge` (`docs/go-live.md`)
- [x] A small, beautiful website for every business, where clients book online (Levan, 2026-10-28): cover, logo, about (ka/en/ru), Instagram/Facebook, gallery, team, map, hours, "Book a visit" button; booking by service or by specialist; 5 colour themes picked in Settings → Your website; share preview — decision 015. Moves to the short address when visito.ge is registered
- [x] In-app notifications (Levan, 2026-11-07): bell next to the logo with unread count — new online bookings, and visits whose time is over but still have no status (they clear once a status is set); owner/admin see all, staff their own; mark read / mark all; opens the booking in the calendar — decision 019. Later: client cancelled/moved via the manage link, push
- [x] Reports in sections, step 1 (Levan, 2026-11-07, after looking at a competitor): tabs Overview / Revenue / Payments / Services / Clients / Specialists; every chart switches to a table, and between revenue and bookings; compare with the previous period or the same period last year (change on every number card, faded bars, change column); presets Today and This week; real bar charts (shadcn chart = Recharts) — decision 020
- [ ] Reports step 2: busy-hours heatmap, revenue by weekday, new vs returning over time, visit frequency, top clients table, CSV per card
- [ ] Reports step 3 (later): expenses module, then profit & loss
- [x] Settings in sections (Levan, 2026-11-07, after looking at a competitor): Settings home with every section; menu beside each section on desktop, "← Settings" on phones; Business details / Online booking / Website / Closed days / Rooms & chairs (dental) / Notifications / SMS & reminders / Team & access / Data & security (owner); one "Settings" item in the main menu — decision 021
- [x] Settings → Notifications: owner & admins and/or the specialist, separately for new online bookings and for visits that need a status (migration `20261107120000`, RLS tests) — decision 021. Later: booking sound, push
- [x] Online booking extras seen at competitors (Levan, 2026-11-09): show/hide prices, upcoming-visit limit per client, embed code (iframe + button) for the salon's own website — migration `20261109090000`, RLS tests — decision 023
- [x] Clients step 1 (Levan, 2026-11-09, after Visage + EasyWeek): list columns last/next visit, visits, spent, average; automatic groups new / regular / VIP / at risk / lost; filters (tag, upcoming, birthday this month, no-show); sorting; numbers on the client card — decision 024, plan `docs/plans/clients-section.md`
- [x] Clients step 2 (Levan, 2026-11-11): choose columns + Excel of the current view, quick note in the list, own fields (Settings → Clients), group thresholds as a setting, "new booking" from the card — decision 026
- [ ] Clients step 3: SMS to a group from the list, own fields on the booking page, loyalty
- [x] Payroll step 1 (Levan, 2026-11-11), only on plans with the Payroll feature (Pro/Standard, Clinic, trial): pay schemes (salary + % with category/service rates), tips, bonuses/deductions, monthly payslip + payouts, Excel, upgrade view — decision 025, plan `docs/plans/payroll.md`
- [ ] Payroll step 2: staff see their own payslip, other pay periods, closing a month, product commission
- [x] From the Rezervo review (Levan, 2026-11-12): ready services by business type (028), staff time-off requests with approval (029), reviews after a visit (030), owners pay their plan by card via Flitt (031)
- [ ] Card billing go-live: Visito's Flitt merchant + subscriptions enabled, terms (recurring charges, refunds)
- [ ] SMS packs for sale (database ready, decision 031) — after deciding how marketing SMS reach clients

## 🚀 Pilot with 2–3 salons + 1 dental clinic (2–4 weeks of real use, fix feedback)

## Go-to-market (from IDEAS.docx)
- [ ] Short, friendly **video tutorial** (2–3 min, Georgian, with subtitles) showing a salon's day in Visito: add a service → booking from Instagram link → SMS reminder → checkout. Send it to prospects.
- [ ] Short feature clips (30–60 s each) for Instagram/Facebook
- [ ] Demo account with realistic seeded data for sales calls
- [x] Landing page at visito.ge, built into the app instead of Webflow (ka/en/ru, real screenshots, features, "your clients stay yours", prices from /admin/plans, FAQ, trial sign-up) — decision 017 (2026-10-28) — [ ] add the video when it exists

## Phase 7 — Marketing email (≈ 1 week) — SPEC 4.10
- [ ] Email adapter + provider, contact & consent sync
- [ ] Segments, campaign editor, test send, schedule
- [ ] Unsubscribe webhook → consent update; stats
- [ ] Targeted special offers: combined segment filters, SMS + email, offer code / pre-applied booking link, results tracking

## Phase 8 — Online payments (≈ 1–2 weeks) — SPEC 4.11
- [ ] Payment adapter + Georgian gateway (per-tenant merchant account)
- [ ] Deposits on booking, payment links, refunds
- [ ] Signed webhooks, payment status on bookings, reconciliation report

## v2 ideas
Gift cards, memberships/packages, inventory, review requests, Viber/WhatsApp messages, Google Calendar sync for staff, embed widget, 2FA, processing-time double booking, AI suggestions.
