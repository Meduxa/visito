# Visito — Product Specification (v1)

Status: draft for build · Owner: Levan · Name: Visito (renamed from Visito 2026-11-06) · Domain: visito.ge

---

## 1. Product in one paragraph

Visito is a web and mobile (PWA) booking and client-management system for **beauty salons** and **small dental clinics** in Georgia. The administrator sets up services and prices, staff and their working hours, and manages all bookings in a dashboard and calendar. Masters/doctors see their own past, current and upcoming bookings. Clients book online and receive SMS confirmations and reminders. The business can send marketing emails to clients who consented, and (later) take online deposits and payments. Each business is a separate, fully isolated tenant.

## 2. Target customers

| Segment | Typical size | Key needs |
|---|---|---|
| Beauty salon (hair, nails, brows/lashes, cosmetology, barbershop, spa) | 2–20 staff, 1–3 locations | Fast calendar, per-master services and prices, no-show reduction, repeat visits |
| Small dental clinic | 1–8 doctors, 1–4 chairs | Chair/room scheduling, longer appointments, treatment-plan visits, stricter privacy |

The data model must support both with **business type** templates (default categories, wording such as "master" vs "doctor", "client" vs "patient").

## 3. Users and roles

| Role | Who | Can |
|---|---|---|
| **Owner** | Business owner | Everything, including billing, deleting the business, exporting all data, managing admins |
| **Admin** (receptionist/manager) | Front desk | Manage bookings, clients, services, staff schedules, send SMS/campaigns, see reports (configurable: hide revenue) |
| **Staff** (master/doctor) | Service provider | See own calendar (past/current/future), own clients' contact info and history, add notes to own bookings, mark booking status, block own time (if allowed). Cannot see other staff's revenue or export data |
| **Client** (public, no account in v1) | End customer | Book, confirm, cancel or reschedule via public page and secure links |
| **Platform admin** (Levan) | Visito operator | Separate super-admin area: tenants, plans, SMS credits, support impersonation **only with logged consent** |

Permissions are enforced in the database (RLS) — the UI only hides what the user cannot do.

## 4. Modules

### 4.1 Business setup and settings
- Sign-up → choose business type (salon / dental clinic) → business name, address, phone, logo, working hours, language, timezone (default Asia/Tbilisi), currency (GEL).
- **Onboarding checklist** on the dashboard: add services → add staff → set hours → share booking link → send first SMS. (Reduces churn in the first week.)
- Multiple **locations** per business (v1: data model supports it; UI can start with one location).
- Business holidays and closed days.
- Booking rules: minimum notice before booking (e.g. 2 h), maximum days ahead (e.g. 60), cancellation window (e.g. 24 h), slot step (5/10/15/30 min), whether online bookings need admin approval.
- Public booking page settings: slug, cover image, description, which services/staff are bookable online.
- SMS settings: sender name, templates per message type (ka/en/ru), reminder timing (e.g. 24 h and 2 h before).
- Roles & invitations: invite by email, resend, revoke.

### 4.2 Staff and schedules
- Staff profile: name, photo, position (e.g. "Senior stylist", "Dentist"), phone, email, colour on calendar, bio for booking page, is bookable online.
- **Weekly working schedule** with multiple intervals per day (e.g. 10:00–14:00, 15:00–20:00), plus **date-specific overrides** (extra day, shorter day).
- **Time off / breaks / vacations / sick days** — blocks availability.
- Which services each staff member performs, with optional **per-staff price and duration override** (senior stylist charges more / works faster).
- Staff levels (Junior / Middle / Senior / Top) with price multipliers — optional convenience over per-staff overrides.
- Commission settings per staff (percentage of service price) — used in reports (v1: calculation only, no payroll).

### 4.3 Services and prices
- **Categories** (Hair, Nails, Brows & lashes, Cosmetology, Massage / for dental: Consultation, Hygiene, Therapy, Surgery, Orthodontics, Prosthetics...). Drag to reorder.
- Service fields: name (ka/en/ru), description, category, **price** (fixed, "from" price, or price range), **duration**, **buffer time after** (cleaning/preparation), optional **processing time** (e.g. colour developing — the master can take another client meanwhile; v2), colour, active/hidden, bookable online, deposit required (amount or %), required resource (chair/room/equipment).
- Example data the seed must contain:
  - Women's haircut — 55 ₾ — 45 min
  - Hair colouring with product X — 80 ₾ — 120 min
  - Manicure with gel polish — 45 ₾ — 75 min
  - Dental consultation — 30 ₾ — 30 min · Professional teeth cleaning — 120 ₾ — 60 min
- **Service variants / options** (e.g. hair length short/medium/long changes price and duration).
- **Add-ons** (e.g. "+ hair mask 15 ₾, +10 min").
- **Packages / bundles** (e.g. "Bridal package") — v2.
- **Price list import** from CSV/Excel (businesses already have price lists — huge onboarding time saver).
- **Product/material usage** per service (e.g. colouring uses product X) — v2, links to inventory.

### 4.4 Clients (patients for dental)
- Client card: first/last name, phone (E.164, unique per tenant), email, birthday, gender (optional), preferred staff, tags (VIP, new, regular), source (Instagram, walk-in, referral, online page), notes, **allergies / important notes** field (shown as a warning on bookings).
- **Visit history**: all past and future bookings, total spent, number of visits, last visit, no-shows count, cancellations count.
- **Consents**: service messages (implicit with booking), **marketing SMS** and **marketing email** (explicit, timestamp, source, can be withdrawn), photo consent (v2).
- **No-show / blacklist flag**: after N no-shows require deposit or block online booking.
- Duplicate detection by phone; **merge clients**.
- Import clients from CSV/Excel with consent column; export (owner only).
- **Data subject requests**: export one client's data (JSON/PDF), delete/anonymise a client (keeps anonymous financial totals).
- Birthday list (for marketing, only with consent).
- **Dental only — treatment notes**: stored in a separate table, visible only to doctors and owner, audit-logged, never exported to marketing, never shown in the client-facing page. Full dental charting (tooth map) is **out of scope for v1**.

### 4.5 Calendar (the core screen)
- Views: **Day** (columns = staff, or chairs/rooms for dental), **Week** (one staff), **List/agenda** (mobile default), **Month** overview (counts only).
- Time grid with slot step from settings; current-time line; working hours shaded; time off shown as blocked.
- **Create booking** by clicking an empty slot → pick client (search by name/phone, or create new inline) → services (multiple services in one visit, back-to-back) → staff (auto-suggest available) → time → notes → save.
- **Drag & drop** to move; drag edge to change duration; move between staff (with availability + skill check).
- **Conflict prevention**: cannot overlap the same staff or the same resource; server-side check with a database exclusion constraint — the UI check is only for convenience.
- Booking colours by status or by service category (toggle).
- Filters: staff, location, status, service category.
- Quick actions on a booking: confirm, mark arrived, start, complete, no-show, cancel (with reason), reschedule, send SMS, call client, add payment.
- **Walk-in** booking (now, no client details required — can attach later).
- **Recurring bookings** (every N weeks, X times — common for dental treatment courses and regular nails).
- **Waitlist**: client wants a slot that is full → added to waitlist; when a cancellation frees a slot, admin sees a suggestion and can send an SMS offer.
- Real-time updates (Supabase Realtime): two admins see each other's changes instantly.
- **Import existing bookings** (from IDEAS.docx): CSV/Excel import of future (and optionally past) bookings from the salon's old system, paper diary transferred to Excel, or another booking app's export. Flow: upload → map columns (date, time, client name, phone, service, staff, price) → preview with conflict and error report (unknown service/staff, overlaps, bad phone) → import valid rows → clients are matched by phone or created. Imported bookings are marked `source = 'import'` and do not send SMS unless the admin chooses to.
- Mobile: agenda list by default, swipe between days, large touch targets.

### 4.6 Bookings — lifecycle
Statuses: `pending` (online, awaiting approval) → `confirmed` → `arrived` → `in_progress` → `completed`; side exits: `cancelled_by_client`, `cancelled_by_business`, `no_show`, `rescheduled` (keeps history).
- Every status change is logged with who and when.
- Booking fields: tenant, location, client, staff, resource, services (line items with price snapshot and duration snapshot — price changes later must not change old bookings), start/end, status, source (admin, online, phone, walk-in), notes (internal), client comment, deposit/payment status, reminder status.
- **Price snapshot** on every line item; discounts per line or per booking (amount or %).

### 4.7 Staff view (masters/doctors)
- "My day" home: current booking highlighted, next booking with countdown, today's list.
- Tabs: **Upcoming**, **Today**, **Past** (with filters by date range).
- Booking detail: client name, phone (tap to call), services, notes, client's allergy/important note, history with this client.
- Actions (if permitted): mark arrived/completed/no-show, add notes, block own time.
- Own statistics: bookings count, completed services, (optionally) own revenue and commission.

### 4.8 Public online booking page (`/book/[business-slug]`)
- Mobile-first, Georgian by default with language switch.
- Flow: choose service(s) → choose staff or "any available" → choose date and time (only real availability) → enter name + phone (+ optional email, comment) → consent checkboxes (marketing unchecked by default) → confirm → success page with "add to calendar" (.ics).
- **Phone verification by SMS code (OTP)** before confirming — prevents fake bookings (configurable).
- Business info: address with map link, working hours, photos, staff bios.
- Shareable link + QR code for the salon wall and Instagram bio.
- Secure **manage-booking link** sent by SMS: confirm, cancel (within policy), reschedule.
- Embed widget (`<script>`/iframe) for the business's own website — v2.

### 4.9 Notifications — SMS (built-in, external provider)
- Message types: booking created/confirmed, reminder (configurable, default 24 h and 2 h before), rescheduled, cancelled, waitlist offer, OTP code, review request after visit (v2), birthday greeting (marketing → consent required).
- Templates per type and language with variables: `{client_name}`, `{business_name}`, `{service}`, `{staff}`, `{date}`, `{time}`, `{address}`, `{manage_link}`.
- **Character counter and segment counter** in the template editor. Georgian text uses Unicode, so one SMS segment is about 70 characters (67 when split) — show the cost before sending.
- Sender name per tenant (must be registered with the provider; show status: pending / approved).
- Scheduling: a database job runs every 5 minutes, finds due reminders, and sends them through the SMS adapter. **Idempotent** — a reminder can never be sent twice.
- Quiet hours (e.g. no SMS between 22:00 and 09:00).
- **Delivery log**: every message with status (queued, sent, delivered, failed), error code, segments, cost.
- **SMS credits**: each tenant has a balance; sending deducts; low-balance warning; platform admin tops up (v1 manual, later paid).
- Manual SMS to one client or a selected list (marketing ones respect consent).

### 4.10 Marketing email (external provider)
- Connect via adapter (e.g. Brevo, Mailchimp, MailerLite, Resend — decide in Phase 7).
- **Segments**: all consented clients, by tag, by last visit (e.g. not visited 60+ days), by service category, birthday this month, by staff.
- Campaign: subject, content (simple block editor or provider template), preview, test send, schedule, send.
- Only clients with **marketing email consent** are included. Every email has an **unsubscribe link** that updates consent in Visito immediately (webhook).
- Stats: sent, delivered, opened, clicked, unsubscribed (from provider webhooks).
- **Targeted special offers** (from IDEAS.docx): the admin creates an offer (e.g. "-20% colouring for clients who haven't visited in 60 days", "free hair mask with your next manicure") → picks a precise segment (combine filters: last visit, services used, staff, tags, total spent, visit count, birthday month, no-shows excluded) → sees how many consented clients match → sends by **SMS and/or email** → optional unique offer code or booking link with the discount pre-applied → tracks results: bookings and revenue that came from the offer. Consent rules apply to every channel.
- Sync contacts and consent to the provider; never send clients without consent to the provider.

### 4.11 Payments and checkout
**v1 (no online payments yet):**
- **Checkout** at the end of a visit: line items from the booking, add extra service/product, discount, **payment method** (cash, card terminal, bank transfer, gift card), tip (optional), mark paid.
- Daily cash summary: totals by method, by staff — for closing the day.
- Unpaid / partially paid bookings list.

**Phase 8 (online, via adapter):**
- Deposits on booking (fixed or %), required for selected services or for clients with no-shows.
- Payment links by SMS.
- Refunds and partial refunds.
- Webhooks with signature verification; payment status shown on the booking.
- Provider: **Stripe does not currently support businesses registered in Georgia** — implement Georgian gateways (Bank of Georgia, TBC, Flitt or similar) behind the same adapter interface. Each salon connects **its own merchant account**; Visito never holds the salon's money.

**Gift cards and memberships/packages** (e.g. "10 manicures"): v2.

### 4.12 Reports and dashboard
- Dashboard home (admin/owner): today's bookings, revenue today/this month, occupancy %, new clients, no-shows, upcoming birthdays, SMS balance, onboarding checklist.
- Reports (date range, location, staff filters, export to Excel/CSV):
  - Revenue by day / staff / service / category / payment method
  - **Staff occupancy** (booked hours ÷ working hours)
  - Bookings by status, **no-show and cancellation rate**
  - New vs returning clients, **retention** (came back within 30/60/90 days)
  - Top services, average ticket
  - Commission per staff
  - Booking sources (online page vs admin vs walk-in)

### 4.13 Visito's own subscription billing (how Levan gets paid)
- Plans (example — final prices TBD): **Start** (1–2 staff), **Pro** (up to 10 staff), **Clinic** (dental features, resources), each with included SMS per month.
- **14-day free trial** without card; reminder SMS/email before trial ends.
- Plan limits enforced in the app (staff count, locations).
- v1: manual invoicing (bank transfer) + plan set by platform admin. Later: automatic recurring billing through a Georgian gateway.
- Tenant status: trial, active, past_due (warning banner), suspended (read-only + export still allowed), cancelled (data deleted after the retention period stated in the terms).

### 4.14 Security, audit and data rights
- Audit log: logins, role changes, exports, client deletions, viewing of dental notes, settings changes, SMS campaigns.
- Owner can see audit log (filter by user, action, date).
- Full business export (owner): clients, bookings, services, payments as Excel/CSV + JSON.
- Business deletion flow with confirmation and grace period.
- Session management: log out of all devices; optional 2FA for owner/admin (v2).
- Rate limiting on public booking, OTP and login endpoints.
- Daily backups (Supabase) + documented restore test.

### 4.15 Platform admin area (Levan only)
- List of tenants with plan, status, staff count, bookings last 30 days, SMS balance, last activity.
- Change plan/status, add SMS credits, extend trial.
- Global SMS log and error rates.
- Support access to a tenant only with the owner's in-app consent, time-limited and audit-logged.

## 5. Data model (starting point — refine in migrations)

All tenant tables: `id uuid pk`, `tenant_id uuid not null`, `created_at`, `updated_at`, RLS on.

```
tenants(id, name, type[salon|dental], slug unique, timezone, currency, locale_default, plan, status, trial_ends_at, settings jsonb)
locations(tenant_id, name, address, phone, working_hours jsonb)
profiles(id = auth.users.id, full_name, phone, locale)
memberships(tenant_id, user_id, role[owner|admin|staff], staff_id null, status)
staff(tenant_id, location_id, display_name, position, color, photo_url, bio, bookable_online, commission_pct, level)
staff_schedules(tenant_id, staff_id, weekday, start_time, end_time)
staff_schedule_overrides(tenant_id, staff_id, date, start_time, end_time, is_day_off)
time_off(tenant_id, staff_id, starts_at, ends_at, reason)
resources(tenant_id, location_id, name, type[chair|room|equipment])
service_categories(tenant_id, name_i18n jsonb, sort_order)
services(tenant_id, category_id, name_i18n, description_i18n, price_minor, price_type[fixed|from|range], price_max_minor, duration_min, buffer_after_min, deposit_type, deposit_value, resource_type, bookable_online, active, sort_order)
service_variants(tenant_id, service_id, name_i18n, price_minor, duration_min)
service_addons(tenant_id, service_id, name_i18n, price_minor, duration_min)
staff_services(tenant_id, staff_id, service_id, price_minor_override, duration_min_override)
clients(tenant_id, first_name, last_name, phone_e164, email, birthday, gender, tags text[], source, notes, important_note, preferred_staff_id, no_show_count, blocked_online, anonymized_at)
client_consents(tenant_id, client_id, channel[sms|email], purpose[marketing], granted bool, granted_at, source, withdrawn_at)
dental_notes(tenant_id, client_id, booking_id, author_id, body)       -- stricter RLS, audit on read
bookings(tenant_id, location_id, client_id, staff_id, resource_id, starts_at, ends_at, status, source, internal_note, client_comment, discount_minor, total_minor, paid_minor, deposit_status, recurrence_id, manage_token_hash)
booking_items(tenant_id, booking_id, service_id, variant_id, staff_id, resource_id, name_snapshot, price_minor_snapshot, duration_min_snapshot, starts_at, ends_at, blocked_until, active)
booking_status_history(tenant_id, booking_id, from_status, to_status, changed_by, changed_at, reason)
waitlist(tenant_id, client_id, service_id, staff_id, preferred_from, preferred_to, status)
payments(tenant_id, booking_id, amount_minor, method[cash|card|transfer|online|gift_card], status, provider, provider_ref, created_by)
sms_templates(tenant_id, type, locale, body)
messages(tenant_id, client_id, booking_id, channel[sms|email], type, to, body, status, provider, provider_ref, segments, cost_minor, error, sent_at, idempotency_key unique)
sms_credits_ledger(tenant_id, delta, reason, ref)
email_campaigns(tenant_id, name, segment jsonb, subject, provider_campaign_id, status, scheduled_at, stats jsonb)
audit_log(tenant_id, actor_id, action, entity, entity_id, meta jsonb, ip, at)
integrations(tenant_id, kind[sms|email|payment], provider, status, config jsonb)      -- secrets NOT here; in vault/env
```

Key constraints:
- **No double booking**: Postgres exclusion constraint on `booking_items` using `tstzrange(starts_at, blocked_until)` per `staff_id` (and per `resource_id`), only for `active` items, so cancelled/no-show bookings free the slot (requires `btree_gist`; details in the booking-engine skill).
- `clients (tenant_id, phone_e164)` unique.
- `messages.idempotency_key` unique (e.g. `reminder:24h:{booking_id}`).

## 6. Non-functional requirements
- Calendar day view loads in < 1 s with 15 staff and 150 bookings.
- Works on the last 2 versions of Chrome, Safari (iOS), Edge, Firefox; installable as PWA on Android and iOS.
- Uptime target 99.5%; daily backups; error tracking.
- Accessibility: WCAG 2.1 AA for the public booking page.
- All user-facing text translatable (ka/en/ru); Georgian font with full Mkhedruli support.
- Dates: Georgian formats (e.g. "25 ოქტომბერი, კვირა").

## 7. Out of scope for v1
- Native iOS/Android apps (PWA instead)
- Full dental charting, X-ray storage, insurance claims
- Inventory/stock management
- Payroll
- AI features (v2 ideas: smart rebooking suggestions, no-show prediction, auto-reply to clients)
- Integration with RS.ge fiscal receipts (investigate before selling to businesses that need it)

## 8. Features added beyond the original brief (and why)
| Feature | Why it matters |
|---|---|
| Public online booking page + QR + manage link | Most bookings in Georgia come from Instagram/Facebook — a link in bio is the main sales channel for clients |
| SMS OTP on online bookings | Stops fake/joke bookings |
| Waitlist | Fills cancelled slots = direct revenue for the salon |
| No-show tracking + deposit rule | No-shows are the #1 pain; this is the main selling argument |
| Per-staff prices/durations, staff levels | Real salons price by master seniority |
| Buffer time, resources (chairs/rooms) | Prevents impossible schedules; essential for dental |
| Recurring bookings | Dental treatment courses, regular nails/brows |
| Checkout + daily cash summary | Owners want to know "how much did we make today" |
| Price-list and client import | Cuts onboarding from days to minutes |
| Price snapshots on bookings | Changing prices never breaks history or reports |
| Consent records + unsubscribe + data export/delete | Required by Georgian data protection law |
| Audit log | Trust and compliance; shows who changed/deleted what |
| Onboarding checklist + trial | Converts trials into paying customers |
| Platform admin + SMS credits | How Levan runs and earns from the business |
| ka/en/ru | Georgian default; Russian and English widely used by staff and tourists |
| Import existing bookings (IDEAS.docx) | Salons switch from another system without losing their future appointments |
| Targeted special offers (IDEAS.docx) | Brings clients back; salons can see the revenue each offer earned |
| Video tutorial for prospects (IDEAS.docx) | Sales tool — see ROADMAP "Go-to-market" |
