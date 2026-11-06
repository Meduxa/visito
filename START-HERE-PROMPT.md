# Visito (formerly Bookeria) — Master Prompt for Claude Code

How to use this file:
1. Open the **Salon booking system** folder in Claude Code.
2. Copy everything inside the box in **Part A** and paste it as your first message.
3. After Phase 0 is finished, use the short prompts in **Part B**, one phase at a time.
4. Put your design screenshots in `design/references/` before Phase 2 and paste your Figma link when asked.

---

## Part A — First message (copy everything between the lines)

---

You are the lead full-stack engineer for **Visito** (formerly Bookeria), a multi-tenant SaaS I will sell to **beauty salons and small dental clinics in Georgia**. I am the product owner. You will build it with me step by step in this folder.

### Install the project skills
The folder `skills-to-install/` contains four skills. Copy each subfolder into `.claude/skills/` (create the folder; e.g. `skills-to-install/tenant-security/SKILL.md` → `.claude/skills/tenant-security/SKILL.md`), confirm all four are there, then delete `skills-to-install/`.

### Read first
Before writing any code, read these files completely:
- `CLAUDE.md` — project rules, tech stack, security and coding conventions (these rules are mandatory)
- `docs/SPEC.md` — full product specification
- `docs/ROADMAP.md` — build phases and order
- `.claude/skills/*/SKILL.md` — the four project skills (tenant-security, booking-engine, figma-to-ui, integrations-adapter)

### What the product does (summary)
- A **browser and mobile (PWA) app** for salons and small dental clinics.
- **Administrators** add services with prices and durations (e.g. "Women's haircut — 55 ₾ — 45 min", "Hair colouring with product X — 80 ₾ — 120 min"), organise them into categories, set which staff member performs which service, and manage bookings through a **dashboard and a calendar** (day / week / per-staff views, drag-and-drop rescheduling).
- **Masters / doctors** see their **past, ongoing and upcoming** bookings, their schedule and their own clients.
- **Clients** book online through a public booking page (link for Instagram/Facebook/Google), get confirmation and reminder **SMS**, and can confirm or cancel through a link.
- **Built-in SMS** through an external Georgian SMS provider (sender name per salon, reminders, delivery log, SMS credit balance).
- **Marketing email** through an external email service (campaigns to segments of clients, consent and unsubscribe handled correctly).
- **Online payments / deposits** through a payment provider — designed now as an adapter, implemented later. Note: Stripe does not currently support businesses registered in Georgia, so the adapter must allow Georgian gateways (Bank of Georgia, TBC, Flitt or similar).
- **Design** comes from my screenshots and Figma file, through the Figma connection. Do not invent a visual style; follow the `figma-to-ui` skill.

### Non-negotiables (details in CLAUDE.md)
1. Strict **tenant isolation** with Supabase Row Level Security on every table, proven by tests.
2. **No secrets in the browser.** All SMS / email / payment calls go through server-side adapters.
3. Compliance with the **Georgian Law on Personal Data Protection**: separate marketing consent, unsubscribe, export/delete of client data, audit log, stricter access for dental notes, EU data hosting.
4. Georgian first: default language **ka**, plus **en** and **ru**; currency **GEL** stored as integer tetri; phones in **E.164 (+995)**; timezone **Asia/Tbilisi**.
5. Mobile-first: every screen must work at 375px width.
6. I work on **Windows / PowerShell** — give me commands that work there.

### How we work
- Work in the phases from `docs/ROADMAP.md`. Do **one phase at a time**. Do not start the next phase until I say "next phase".
- At the start of each phase: give me a short plan (5–10 bullet points) and list any decision you need from me. Ask at most 3 questions, and only ones that change what you build.
- During a phase: small commits with clear messages. Write the migration, RLS policies and tests first, then server logic, then UI.
- At the end of each phase: run type-check, lint and all tests; fix failures; update `docs/ROADMAP.md` and `docs/CHANGELOG.md`; then tell me in plain language (a) what now works, (b) exactly how to try it (commands + what to click), (c) what is left or risky.
- If you disagree with something in the spec, say so and explain why before building it differently.
- Never claim something works without running it.

### Start now: Phase 0 — Foundation
1. Check what is installed on my computer (Node.js LTS, npm, Git, Docker Desktop for local Supabase). Tell me exactly what to install if anything is missing and wait for me.
2. Initialise Git and the Next.js + TypeScript + Tailwind + shadcn/ui project in this folder (keep `CLAUDE.md`, `docs/`, `design/`, `.claude/` as they are).
3. Set up Supabase (local first; I will create the EU cloud project when you tell me what to click), `next-intl` with ka/en/ru, ESLint, Prettier, Vitest, Playwright.
4. Create the folder structure from `CLAUDE.md`, `.env.example`, `.gitignore`, and the `APP_NAME` constant.
5. Create the first migration: `tenants`, `profiles`, `memberships` (roles: owner, admin, staff), `audit_log` — with RLS and an isolation test.
6. Build sign-up → create business (salon or dental clinic) → invite staff by email, and an empty dashboard shell with navigation.
7. Seed one demo salon and one demo dental clinic.
8. Fill in the real commands in section 7 of `CLAUDE.md`.

Then stop and report.

---

## Part B — Prompts for the next phases

Paste these one by one after you have tested the previous phase.

**Phase 1 — Services, staff, clients**
> Read `docs/SPEC.md` sections 4.1–4.4 and start Phase 1 from `docs/ROADMAP.md`. Follow the tenant-security skill. Plan first, then build.

**Phase 2 — Design system from Figma**
> I added screenshots to `design/references/` and here is my Figma file: [PASTE FIGMA LINK]. Follow the figma-to-ui skill: extract the design tokens, build the core components, and restyle what exists. Show me the main screens before going further.

**Phase 3 — Calendar and bookings**
> Start Phase 3. Follow the booking-engine skill strictly. The calendar is the most important screen of the product — it must be fast, clear on a phone, and impossible to double-book.

**Phase 4 — Public online booking page**
> Start Phase 4: the public booking page per business (`/book/[slug]`), mobile-first, in Georgian by default.

**Phase 5 — SMS**
> Start Phase 5. Follow the integrations-adapter skill. Provider for now: [smsoffice.ge / other — I will give you the API key as an env variable]. Build confirmation, reminders, confirm/cancel link, delivery log and SMS credits.

**Phase 6 — Reports, settings, polish, production**
> Start Phase 6: reports, business settings, audit log viewer, data export/delete, Sentry, PWA install, and the production deployment checklist.

**Phase 7 — Marketing email**
> Start Phase 7. Follow the integrations-adapter skill. Provider: [name]. Consent and unsubscribe must be correct before any campaign can be sent.

**Phase 8 — Online payments (later)**
> Start Phase 8. Follow the integrations-adapter skill. Provider: [Bank of Georgia / TBC / Flitt / other]. Deposits on booking, payment links, refunds, webhook verification.

---

## Useful prompts at any time

- **Review:** "Review the whole codebase against CLAUDE.md and the Definition of Done. List problems by severity. Do not fix yet."
- **Security check:** "Act as a security reviewer. Try to find any way a user of one salon could see or change another salon's data. Check RLS, server actions, API routes and storage buckets. Report, then fix."
- **Explain:** "Explain how [feature] works in simple language, as if to a salon owner, then as if to a developer."
- **Bug:** "This is broken: [what I did → what I expected → what happened]. Find the cause before changing code, then fix it and add a test so it never comes back."
