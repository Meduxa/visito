# Visito — Project Rules for Claude Code

> Name: **Visito** (renamed from Visito, Levan 2026-11-06), domain **visito.ge** — the name stays in ONE config constant, `APP_NAME`.
> Visito is a multi-tenant SaaS for **beauty salons and small dental clinics in Georgia**: services & prices, bookings, calendar, staff schedules, client base, SMS reminders, marketing email, and (later) online payments.

Read this file at the start of every session. The full product specification is in `docs/SPEC.md`. The build order is in `docs/ROADMAP.md`. Never start a module without reading its section in the spec.

---

## 1. Who you are working with

- The owner (Levan) is a product owner, not a full-time developer. Explain decisions in plain language, one or two sentences, before large changes.
- He works on **Windows (PowerShell)**. Give commands that work in PowerShell. Never assume bash-only syntax (`&&` chains, `export VAR=`, `rm -rf`).
- Prefer small, reviewable steps. After each step: say what changed, how to run it, and what to check in the browser.
- When something is ambiguous and costly to redo, ask ONE clear question before building. When it is cheap to redo, make a sensible choice and say what you chose.

## 2. Tech stack (do not change without asking)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript (strict)** | One codebase for web + mobile (PWA) |
| UI | **Tailwind CSS + shadcn/ui** components, `lucide-react` icons | Fast, consistent, easy to match Figma |
| Database / Auth / Storage | **Supabase** (PostgreSQL, Auth, Storage, Edge Functions, `pg_cron`) — **EU region (Frankfurt)** | Row Level Security for tenant isolation; EU hosting for data protection |
| Forms & validation | `react-hook-form` + **`zod`** (same schemas on client and server) | |
| Data fetching | Server Components + Server Actions; `@tanstack/react-query` only for live client views (calendar) | |
| Calendar UI | A maintained React calendar/scheduler library OR a custom grid — decide in Phase 2 and document the choice | Calendar is the heart of the product |
| Dates & time | `date-fns` + `date-fns-tz`. Store UTC in DB, display in `Asia/Tbilisi` (per-tenant timezone setting) | |
| i18n | `next-intl`. Languages: **Georgian (ka, default)**, English (en), Russian (ru) | |
| Mobile | **PWA** (installable, push-ready, responsive). Native apps are NOT in scope for v1 | |
| Testing | **Vitest** (unit), **Playwright** (end-to-end), Supabase local + pgTAP or SQL tests for RLS | |
| Hosting | **Netlify** (Frankfurt functions where available) + Supabase Cloud EU — `docs/go-live.md` | |
| Error tracking | Sentry (add in Phase 6) | |

## 3. Non-negotiable rules

### 3.1 Multi-tenancy & security (most important)
- Every business record has a **`tenant_id`** (the salon/clinic). No exceptions.
- **Row Level Security (RLS) is ON for every table** that holds tenant data. A table without RLS policies must not be merged.
- Never trust `tenant_id` sent from the browser. Resolve it on the server from the authenticated user's membership.
- The Supabase **service role key is server-only**. Never import it in client components. Never prefix it with `NEXT_PUBLIC_`.
- Every new table ships with an RLS test proving: user of tenant A cannot read/write tenant B.
- Follow the `tenant-security` skill for every schema change.

### 3.2 Secrets & integrations
- All API keys (SMS, email, payments) live in environment variables / Supabase secrets — never in code, never in the browser.
- All third-party calls go through **server-side adapters** (see `integrations-adapter` skill). UI code never calls an SMS, email or payment API directly.
- Commit only `.env.example` (placeholder values). `.env.local` is in `.gitignore`.

### 3.3 Personal data (Georgian Law on Personal Data Protection, in force since 1 March 2024)
- Visito is the **data processor**; each salon/clinic is the **controller**.
- Collect only what is needed. Client card = name, phone, optional email, optional birthday, notes, consents.
- **Marketing consent is separate from service messages.** Appointment reminders = service. Promotions = marketing → require recorded consent (who, when, how) and a working unsubscribe.
- **Dental clinics:** treatment notes may contain health data (special category). Keep them in a separate table with stricter RLS (only clinic doctors/owner), audit-logged, never included in marketing exports. Do NOT build full medical/dental charting in v1.
- Every client record must be exportable and deletable (data subject requests).
- Log sensitive actions in `audit_log` (who, what, when, tenant).
- Encrypt in transit (HTTPS everywhere). Rely on Supabase encryption at rest.

### 3.4 Money
- Store money as **integer tetri** (1 GEL = 100 tetri) in `*_minor` columns + `currency` (default `GEL`). Never floats.
- Format with `Intl.NumberFormat('ka-GE', { style: 'currency', currency: 'GEL' })`.

### 3.5 Phone numbers
- Store in **E.164** (`+995XXXXXXXXX`). Accept `5XX XX XX XX`, `995...`, `+995...` input and normalize. Validate with `libphonenumber-js`.

### 3.6 Time
- DB columns: `timestamptz`. Business logic and display use the tenant's timezone (default `Asia/Tbilisi`, UTC+4, no DST).
- Never compute availability with naive local dates.

## 4. Code conventions

- Folder structure (create as needed):
  ```
  src/
    app/[locale]/(auth)/...          login, signup, invite
    app/[locale]/(dashboard)/...     admin & staff app
    app/[locale]/book/[slug]/...     public online booking page
    app/api/...                      webhooks, read/[name]/[id] panel loads (decision 006), cron/* jobs, export/* downloads
    components/ui/                   shadcn primitives (do not edit by hand except via tokens)
    components/                      app components
    features/<module>/               actions.ts, queries.ts, schema.ts, components/
    lib/                             supabase clients, i18n, money, phone, time utils
    integrations/sms|email|payments/ adapters (interface + providers)
  supabase/
    migrations/                      SQL migrations (never edit an applied migration)
    seed.sql                         demo salon + demo dental clinic
    tests/                           RLS & SQL tests
  design/
    tokens.json                      design tokens from Figma
    references/                      Levan's screenshots
  docs/                              SPEC.md, ROADMAP.md, decisions/
  ```
- One feature = one folder under `src/features/`.
- Names in code are English. All user-facing text goes through `next-intl` message files (`messages/ka.json`, `en.json`, `ru.json`). Never hard-code Georgian strings in components.
- Use the design tokens (CSS variables / Tailwind theme). **Never hard-code hex colors, font sizes or spacing in components.**
- Accessibility: keyboard navigation, focus states, labels on inputs, contrast AA minimum.
- Every list screen has: loading state, empty state (with a helpful action), error state.
- Every destructive action has a confirmation and, where sensible, undo.

## 5. Workflow for every task

1. Read the relevant section of `docs/SPEC.md`.
2. If the task touches the DB → follow `tenant-security` skill. If it touches booking/availability → `booking-engine` skill. If it implements a screen from Figma → `figma-to-ui` skill. If it touches SMS/email/payments → `integrations-adapter` skill.
3. Write/adjust the migration + RLS + tests first, then server logic, then UI.
4. Run: type-check, lint, unit tests, RLS tests. Fix everything before saying "done".
5. Update `docs/ROADMAP.md` checkboxes and add a short entry to `docs/CHANGELOG.md`.
6. Record any non-obvious decision in `docs/decisions/NNN-title.md` (3–10 lines: context, decision, consequence).

## 6. Definition of Done

- [ ] Works in Georgian, English and Russian
- [ ] Works on phone width (375px) and desktop
- [ ] RLS policies + tenant isolation test pass
- [ ] Types, lint and tests pass
- [ ] Loading, empty and error states exist
- [ ] No secrets in client code
- [ ] Roadmap + changelog updated

## 7. Commands (PowerShell)

On Levan's laptop PowerShell scripts are blocked, so always write `npm.cmd` / `npx.cmd` (not `npm` / `npx`). Run from the project folder.

There is no local Docker database (no admin rights, see `docs/decisions/002`). Development uses the Supabase Cloud project **bookeria-dev** (Frankfurt, demo data only), linked with `supabase link`. Secrets live in `.env.local` (copy of `.env.example`).

```
npm.cmd run dev              # start the app → http://localhost:3000 (opens in Georgian)
npm.cmd run typecheck        # generate route types + TypeScript check
npm.cmd run lint             # ESLint
npm.cmd run format           # Prettier (format:check to only check)
npm.cmd run test             # unit tests (Vitest, no network)
npm.cmd run test:rls         # tenant-isolation tests against bookeria-dev (needs .env.local)
npm.cmd run test:e2e         # Playwright on a production build (port 3100), phone 375px + desktop 1440px (needs seeded dev DB) — decision 010
npm.cmd run test:e2e:dev     # the same tests against the running dev server (quicker to start, slower and less stable)
npm.cmd run db:push          # apply new migrations in supabase/migrations to bookeria-dev
npm.cmd run db:types         # regenerate src/lib/supabase/database.types.ts from the DB
npm.cmd run db:seed          # reset + load demo salon & dental clinic (dev project only — refuses any other)
npm.cmd run jobs             # SMS every minute + daily job (trials, deletions, monthly SMS) while the dev server runs
npm.cmd run platform-admin -- you@example.com   # make an existing account a platform admin (/admin); --remove to undo
npm.cmd run landing:shots       # retake the landing page screenshots from the running dev app (after UI changes)
npx.cmd supabase login       # once per computer
npx.cmd supabase link --project-ref cznbcglbskunoofrdeut   # once per checkout
```

Before saying a phase is done: `typecheck`, `lint`, `test`, `test:rls`, `test:e2e` must all pass.
