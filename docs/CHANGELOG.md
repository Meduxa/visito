# Changelog

All notable changes per phase. Newest on top.

## From the Rezervo review: ready services, time-off requests, reviews, card billing (2026-11-12)

- **Ready services, next to manual adding** (decision 028): the Services page has a **Ready services** box covering 7 business types (names in ka/en/ru, duration, suggested price); each service is added with one click and existing ones are marked. **New service** can **start from a ready service**, which fills the form for editing.
- **Time-off requests:**
  - On **My day**, a specialist asks for days off: reason, note, withdraw.
  - On the **Staff** page, owner/admin approve or decline, with a warning when bookings exist in that period.
  - Approving creates the time off (decision 029).
- **Reviews:**
  - Optional SMS after a finished visit with a private link: 1–5 stars and a comment.
  - **Reviews** page: average, filters, reply, hide.
  - Published reviews appear on the booking page (clients by first name).
  - **Settings → Reviews** has the switches (decision 030).
- **Card payments** (**Settings → Subscription**, owner only):
  - pay the plan monthly by card on Flitt's secure page, and turn automatic payment off
  - payment history
  - the trial and payment-due banners link there
  - SMS packs are **not offered yet** (Levan: first decide how marketing SMS reach clients); the database is ready for them
  - Flitt's signed notices; the server checks the status itself (decision 031)
- **Database:** migrations `20261112090000_templates_timeoff_reviews.sql` and `20261112100000_billing.sql`. Tests: `rls_rezervo_features.test.ts`, `flitt.test.ts`, `e2e/rezervo-features.spec.ts`.

## Clients step 2: own fields, group numbers, columns, quick note, Excel, booking from the card (2026-11-11)

- **Settings → Clients** (new section):
  - **Own fields:** up to 20 extra fields on every client card: text, number, date, choice from a list, or yes/no. Fields can be reordered, renamed and removed; removing a field erases its values.
  - **Client groups:** VIP from N visits, at risk after N days, lost after N days. The list's groups and its hint follow these numbers.
- **The client card** has an "Own fields" block and a **New booking** button. The button opens the calendar's booking form with the client filled in.
- **Columns** menu on the list (desktop): show or hide columns, including own fields; it is remembered in this browser. **Show the standard columns** resets it.
- **Quick note** at the end of every row: read or edit the client's note without opening the card.
- **Download Excel** of exactly the current list: search, group, filters and sorting, all pages, the chosen columns. Owner/admin only, written to the audit log.
- **Privacy:** erasing a client clears own fields; merging keeps both cards' values.
- **Demo data:** 4 salon fields (hair type, colour formula, allergy, patch test), filled on some cards.
- **Database:** migration `20261111120000_clients_step2.sql` (decision 026). Tests: `rls_clients_step2.test.ts`, `fields.test.ts`, `e2e/clients-step2.spec.ts`.

## Payroll, only in plans that include it (2026-11-11)

- **Plans get paid features.** `/admin/plans` has a **Payroll** switch per plan. It is on for Pro ("Standard"), Clinic and the trial. The landing price cards list Payroll on plans that have it.
- **Menu → Payroll** (owner; admins who may see revenue):
  - month by month, with totals: earned this month, paid, still to pay
  - a row per specialist: services, % of services, salary, tips and bonuses, total, to pay
- **Payslip panel:**
  - salary, a line per % rate, tips, bonuses and deductions, and the total
  - payments recorded (cash, transfer or card; with date and note), and what is still to pay
  - add or remove a bonus, deduction or payment (removing asks first)
- **Pay settings:**
  - fixed salary per month and the default % (the same % as on the staff profile)
  - a different % for a category or a service: the service's % wins, then the category's, then the default
  - % is counted on completed services after discount
- **Excel download** of the month: a summary sheet and a detail sheet.
- **Plans without Payroll** show the menu item with an "upgrade" page. Data stays, locked, after a downgrade.
- **Safety:** database rules on all 4 new tables (plan feature + revenue rights; staff never). Every change is in the audit log.
- **Demo data:** pay schemes, a bonus and a deduction this month, and last month's salaries paid.
- **Database:** migration `20261111090000_payroll.sql` (decision 025, plan `docs/plans/payroll.md`). Tests: `rls_payroll.test.ts`, `compute.test.ts`, `e2e/payroll.spec.ts`.

## Clients: visit numbers, groups, filters (2026-11-09)

- **New columns:**
  - **Group**
  - **Last visit**
  - **Next visit**
  - **Visits**
  - **Spent** and **Average**: only for the owner, and for admins who may see revenue

  On a phone each client is a card with "last · next · visits".
- **Automatic groups** above the list, each with its count:
  - **All**
  - **New:** 0–1 visits
  - **Regular:** 2–4
  - **VIP:** 5+, last visit within 60 days
  - **At risk:** no visit for 60–180 days
  - **Lost:** over 180 days
- **Filters:**
  - tag
  - has an upcoming visit
  - birthday this month
  - had a no-show
  - **Clear filters**, when nothing matches
- **Sort by:**
  - newest added
  - name
  - last visit
  - number of visits
  - amount spent

  The view is in the address, so a link opens the same list.
- **The client card** starts with "At a glance": the group, then visits, spent, average bill, last and next visit, no-shows, cancellations, and "client since". "Client since" is the first booking date for imported clients.
- **Money reads the same everywhere**, fixed for browsers without Georgian number data. Before, "32,78 ₾" could flip to "32.78 ₾" after loading and lose a click.
- **Demo data:** a year of past visits, so every group has clients.
- **Database:** migrations `20261109120000_client_list.sql` and `20261109130000_client_list_first_visit.sql` (decision 024; plan in `docs/plans/clients-section.md`). Tests: `rls_client_list.test.ts`, `e2e/clients.spec.ts`.

## Online booking extras (2026-11-09)

- **Settings → Online booking → Booking rules** has two new rules:
  - **"Show prices on the booking page"** (on by default). When it's off, clients see services and times but no prices. The prices aren't even sent to the browser.
  - **"Upcoming visits per client"** (0 = no limit). This is how many future visits one client may hold at once when booking online. Past the limit, the booking page says to call or to cancel a visit first. The team can still book from the calendar.
- **New card "Booking on your own website"**, with two snippets to copy:
  - the booking form inside the page (an iframe of the new `/{language}/embed/{address}` page: the booking steps without the website parts)
  - a "Book online" button
  - plus **Preview**
- Only the embed page may be shown inside other websites. Every other page still refuses to be framed. In the embedded form, "Change or cancel" and the legal links open a new tab.
- Database: migration `20261109090000_online_limits.sql` adds two settings and the limit check inside the online booking function (decision 023). Tests: `rls_online_limits.test.ts`, `e2e/online-extras.spec.ts`.

## New font: FiraGO (2026-11-08)

- The whole app, the salon websites and the booking pages use **FiraGO**, one font for Georgian, English and Russian (before: Inter + Noto Sans Georgian). Mixed Georgian/Latin text now matches.
- Served from our own site (no Google Fonts request), trimmed to the alphabets we use: about 77 KB per weight. Decision 022; license in `src/app/fonts/FiraGO-OFL.txt`.

## Settings in sections (2026-11-07)

- **Settings home** lists every section with a line about what is inside, in three groups: Business, Notifications & SMS, Team & data. On a computer each section has the menu on the left; on a phone the section opens on its own with "← Settings" at the top.
- **Sections:** Business details (name, contacts, address, opening hours) · Online booking (link, QR code, booking rules) · Website (about, links, colours, cover, photos) · Closed days · Rooms & chairs (dental only) · **Notifications** (new) · SMS & reminders (the former SMS page) · Team & access (team, invitations, and now what staff see and whether admins see revenue) · Data & security (owner: support access, export, action log, sign out everywhere, delete business).
- **Settings → Notifications:** for "new online booking" and for "booking needs a status", choose whether the owner & admins and/or the specialist get it under the bell. All on by default. The specialist is told only about their own clients.
- The main menu has one **Settings** item for owner and admin (Team and SMS moved inside); staff keep their Team link. Old links (`/settings/business`, `/settings/sms`, `/settings/team`) still work. The dashboard's "booking link" step now opens Online booking; the deletion banner opens Data & security.
- Database: migration `20261107120000_notification_settings.sql` (four switches on `tenant_settings`; the notification visibility function respects them) — decision 021. Tests: 4 new cases in `rls_notifications.test.ts`, `e2e/settings.spec.ts`; other e2e tests point at the new sections.

## Reports in sections (2026-11-07)

- **Tabs** on the Reports page: Overview, Revenue, Payments, Services, Clients, Specialists. Revenue and Payments are hidden from people who may not see money. The tab, period, specialist and comparison are in the address, so a link opens the same view.
- **Chart or table** — every chart card has a chart/table switch; cards with several measures also switch between them (revenue / bookings, revenue / count, service value / occupancy / booked hours).
- **Real bar charts** over time: by day for periods up to two months, by month for longer ones (shadcn chart on Recharts, colours from the design tokens). Payments are stacked by method (cash, card, transfer…).
- **Compare with** the previous period or the same period last year: every number card shows the change (green when it went the good way; rates in percentage points), charts show the earlier period as faded bars, tables get "this period / compared / change" columns.
- New presets **Today** and **This week**; Payments tab has a card per method with its tips; Services tab lists all services (table first).
- Decision 020. Tests: `params.test.ts`, new cases in `compute.test.ts`, `e2e/reports.spec.ts`; `phase6a.spec.ts` opens the Specialists tab.

## In-app notifications (2026-11-07)

- **Bell next to the Visito logo** (sidebar on desktop, top bar on phones) with a red unread count. It opens a "Notifications" panel (full width on phones), newest first, refreshed every minute and whenever it opens.
- **New online booking** — whenever a client books on the business's booking page or website: client, service(s), specialist, date and time (in the business's time zone).
- **Booking needs a status** — a visit that has ended but is still "pending"/"confirmed" (nobody marked it arrived, completed, no-show or cancelled), last 30 days. It disappears by itself once a status is set.
- Clicking a notification marks it read and opens that booking in the calendar (`/calendar?booking=…`); "Mark all as read". Read state is per person.
- Owner and admin see everything; staff only notifications for their own specialist profile. No notes or health data in notifications.
- Database: migration `20261107090000_notifications.sql` (tables `notifications`, `notification_reads`, RLS, feed functions; the online-booking function now also writes the notification) — decision 019. Tests: `rls_notifications.test.ts`, `e2e/notifications.spec.ts`.

## Renamed to Visito (2026-11-06)

- **Bookeria is now Visito** (domain visito.ge): the name in the app, browser tab, installed app, landing page, emails, SMS test text, legal texts, admin and support screens (ka/en/ru), file names of exports and the offline page.
- The logo keeps its calendar mark for now, with the wordmark "Visito"; the new mark comes later.
- Short addresses are now `name.visito.ge`; `visito` can't be taken as a business address (migration `20261106090000`).
- The demo salon's address is now **orchidea** (`orchidea.visito.ge`, `visito.ge/ka/book/orchidea`) instead of demo-salon; the calendar test now picks a visit that is still open.
- Internal names follow: package `visito`, demo password `Demo-Visito-2026` (demo data reloaded), backups `visito-*.tgz.gpg`, offline cache, calendar-file IDs and the key for codes/manage links (old demo links stop working — there are no real clients yet), brand file `design/brand/visito-logo.svg`, pilot tracker `visito-pilot-tracker.xlsx` and the Excel templates. Docs now use the new dashboard names: Supabase `visito-dev`, Netlify `visito-ge`, GitHub `Meduxa/visito`, folder `Desktop\Visito`.

## Calendar look (2026-11-03)

- **Bookings in the day and week view** have a bold coloured outline all around, a solid stripe on the left, a tinted fill and bold time + client; 30-minute visits show on one line instead of being cut; completed visits stay outlined but white; no-shows are faded and struck through; pending ones dashed.
- **Brighter, clearly different colours** for the 10 specialist/service colours (light and dark mode).
- **Colour by specialist or by service** — a switch in the calendar toolbar, remembered on each device; services without their own colour use the specialist's. The demo salon's services and team got distinct colours.
- Dashed half-hour lines and a softer grid.

## Business website redesign (2026-11-03)

- **Full-width cover**: the photo runs edge to edge with a flowing bottom edge (a ribbon in the business's theme colour behind a wave), logo, name, an "open now / closed · today 10:00–20:00" badge in the business's time zone, address, and Book / Call / Directions on the photo; language switcher floats over it. Phones get the same, stacked.
- **Services fold by category**: each category has a minimalist icon picked from its name (Georgian, English, Russian — hair, nails, pedicure, lashes, laser, massage, injections, dental…; a general icon otherwise), the number of services and how many are chosen; the first category is open (all of them when there are only a few services); a search field finds a service in any category.

## Import templates (2026-11-02)

- **Excel templates for the three imports** in docs/pilot/import-templates: services, clients, bookings — Georgian column names, example rows, every cell as text (so Excel never changes times, dates or phones), and a second sheet with instructions. Checked against the app's own import rules.

## SMS company: sender.ge (2026-11-01)

- **sender.ge connected in the code** (switched on with two settings, decision 018): reminders, codes and confirmations go as informational SMS, promotions as promotional; delivery is checked with sender.ge for a day after sending; the platform admin's SMS page shows Bookeria's sender.ge balance. Until the key is set, the fake SMS stays in use.

## Prices on the landing page (2026-10-29)

- **Hero pictures take turns**: the landing page shows the calendar and the reports, changing every 5 seconds or by clicking "Calendar" / "Reports" (pauses under the mouse; no auto-change when animations are off); the phone picture is now სალონი ორქიდეა. Screenshots retaken, reports added to npm.cmd run landing:shots.
- **No more console error about a script tag** (the theme script from next-themes is only run from the server HTML; dark mode still applies before the page shows).
- **Georgian wording**: "ჩაის ფული" / "ჩაი" is now "თიფი" everywhere (checkout, cash summary, reports, landing page).
- **Calendar**: the sideways-scrolling grid (many specialists) can be reached and scrolled with the keyboard.
- **Demo salon is now "სალონი ორქიდეა"**: a realistic cover photo (orchids, blush and gold interior) and an orchid logo, made with Figma AI and kept in scripts/seed-assets so a demo reset keeps them; new description in ka/en/ru. The demo team uses made-up names and AI portraits (no real people).
- **Feature icons react to the mouse**: on the landing page a feature's icon turns solid green and pops slightly, and the card lifts; the numbers of the three "how it works" steps swap colours the same way. No movement for people who turned animations off.
- **Business website on big screens**: the page is wider (one column, about 1000 px instead of ~670 px), with a lower cover photo, the team in a grid across the width, services and specialists in two columns, and a comfortable line length for the description. Phones are unchanged.
- **Prices section**: Starter 39 ₾ / month (1 specialist, 900 SMS), Standard 89 ₾ (2–15 specialists, 1,500 SMS, "most popular"), Premium priced individually. A switch for 1 / 6 / 12 / 18 months shows the discounted price (−10 / −20 / −30 %), the old price crossed out and the total. A card turns green under the mouse; every "Choose plan" opens the free sign-up. Prices and limits stay editable in /admin/plans; the old "Clinic" placeholder plan is no longer offered.
- **Pilot plan and tracker**: docs/pilot-test-plan.md and docs/pilot/bookeria-pilot-tracker.xlsx.

## Demo site (2026-10-28)

- **Online demo** at https://bookeria1.netlify.app on the demo database (setup notes in `docs/go-live.md`). The demo salon books without an SMS code (no SMS company yet); `db:seed` turns the code back on.
- **New logo**: a minimalist calendar mark with a check ("booked") instead of "b." and the wordmark in Sora ExtraBold, so it no longer resembles Booking.com. App header, landing page, browser tab and phone app icons all use it; landing screenshots retaken.
- The SMS job on Netlify runs **every 5 minutes** instead of every minute, to stay within the free plan's monthly credits. Reminders may go out up to 5 minutes later; login codes and booking confirmations are still sent at once.

## Before the pilot — part 1 (2026-10-28)

- **Sign out of all devices**: in the account menu (after a confirmation) — for a lost phone or a shared computer. Other devices are signed out on their next click; recorded in the audit log.
- **Waitlist SMS offer**: after a cancellation, the clients waiting for that time show up with an "Offer by SMS" button that sends them the freed date and time with the business phone. Pressing twice does not send twice.
- **Bookeria support access (view only)**: the owner can let Bookeria support look at the business for 24 hours or 3 days (Settings → Business) and end it at any time. Support sees the screens like an admin, with a banner, but the database refuses every change; treatment notes stay hidden. Allowing, ending and every visit are in the business's audit log.
- **Each business gets its own small website** (the booking page): cover photo, logo, a few words about the business in ka/en/ru, Instagram and Facebook, photos, team, hours and map, with a big "Book a visit" button. The owner fills it in under Settings → "Your website" and picks one of 5 colour themes. Clients can start "by service" or "by specialist". Shared links show the cover and description. The demo salon and clinic have a cover, logo and text.
- **Short addresses**: each business's website opens at its own address, e.g. `teka.bookeria.ge` (`/en`, `/ru` for other languages); Settings and the QR code show it. Switched on with one setting once bookeria.ge is registered; old links keep working; names like www/admin/app can't be taken. Try it on this laptop: `http://demo-salon.localhost:3000`.
- **Keyboard check**: every button and field on the booking page and the main app screens shows where the focus is, and sign-in and booking work without a mouse (automatic test).
- **Landing page**: bookeria.ge now explains Bookeria to visitors (ka/en/ru) with real screenshots, the features, why clients stay the salon's own, prices (shown automatically once set in the admin area; until then "14 days free, prices soon"), questions and a "Start free" button everywhere. Signed-in people go straight to their dashboard.
- The booking page no longer jumps down to the booking form when it opens — visitors first see the cover and the business.
- The booking button "Cancel" is now "Cancel booking" — the confirmation showed two buttons both called "Cancel" (ka/en).

## Phase 6b — Ready for production (2026-10-26)

- **Installable app**: Bookeria can be added to a phone's home screen with its own icon; an "Install the app" button (Android/Chrome) or a hint (iPhone) in the menu; a friendly page when there is no internet. Nothing personal is stored on the phone.
- **Security**: browser security headers on every page (no embedding in other sites, scripts only from us and the database), 0 known vulnerable packages, written review with a before-go-live list. Fixed: names starting with "=" could run as formulas when an export was opened in Excel.
- **Accessibility**: automatic WCAG 2.1 AA checks on 16 screens at phone and desktop size; fixed keyboard access to scrolling strips and the contrast of inactive tabs and finished bookings.
- **Speed**: every main page loads in under a second on the production build (`docs/performance.md`).
- **Legal pages**: privacy policy, terms of service and data processing agreement in ka/en/ru, clearly marked as drafts for the lawyer; linked from sign-up and the booking page.
- **Error reports (Sentry)** and **email (Resend)** ready, switched on by entering their keys; error reports never contain client data.
- **Going live**: Netlify configuration, the SMS and daily jobs as scheduled functions, automatic checks on GitHub, an encrypted nightly backup while on Supabase's free plan, and a step-by-step guide (`docs/go-live.md`). Demo data and database tests can no longer touch any project but the dev one. Without an SMS company, SMS are logged as "not sent" instead of failing.

## Phase 6a — Reports, account and platform admin (2026-10-26)

- **Dashboard home** for owners/admins: today's bookings and money received, this month's revenue, occupancy, new clients and no-shows, birthdays in the next 7 days, SMS left (with a warning when low), and a first-steps checklist that ticks itself and disappears when done.
- **Reports** (period presets or dates, one specialist or all): money received by day and payment method, service value by category, per specialist (service value, commission, booked vs working hours, occupancy), top services, booking sources and statuses, no-show and cancellation rates, new vs returning clients, retention after 30/60/90 days. **Excel download** with the same filters. Admins see no money when the owner switched revenue off.
- **Owner's data and account** (Settings → Business): download everything (Excel or JSON), audit log page with readable actions and filters, delete the business — typed name, 14 days to change your mind, banner on every page meanwhile.
- **Plans and status**: placeholder plans (Trial, Start, Pro, Clinic) with a staff limit; trial ends → "payment due" banner (online booking keeps working); suspended → read-only (viewing and export still work). Decision 009.
- **Platform admin area** `/admin` (Levan only; others get "not found"): all businesses with owner, plan, status, staff, bookings, SMS left and last activity; change plan/status/trial; add SMS credits; edit plans; SMS log across businesses with error rate. Make yourself admin with `npm.cmd run platform-admin -- your@email`.
- **Photo gallery** (up to 12) shown on the booking page.
- **Daily job** (`/api/cron/daily`, also run by `npm.cmd run jobs`): ends trials, deletes businesses whose 14 days are over, adds monthly included SMS.
- 8 new security tests (platform admin, plans, staff limit, deletion, export, photos); report calculations unit-tested.
- **Tests**: end-to-end tests now run against a production build (decision 010): 1.5 minutes instead of 4, and stable. The dashboard numbers are reused for one minute per business, so many sign-ins at once stay fast.

## Phase 5 — SMS (2026-10-26)

- **One SMS queue and log** for everything: booking codes, confirmations, reminders, moved/cancelled messages, manual SMS and promotions. A message can never go twice; failed sends are retried and their credits returned. The owner/admin sees every message with its status in **Settings → SMS → Message log** (codes are blanked out).
- **Credits** in SMS parts: every business starts with 50 trial SMS; a warning appears on the dashboard and in SMS settings when few are left. One Georgian SMS holds 70 characters, so a message with a manage link usually takes 2.
- **Reminders**: 2 hours before by default, 24 hours optional; never inside quiet hours (default 22:00–09:00 — sent when they end, if still before the visit); a moved booking gets a fresh reminder.
- **Booking messages**: confirmation when the team books (not for walk-ins) or a client books online, "moved", "cancelled by the business", and "confirmed" when a pending online booking is approved — each can be switched off.
- **Texts**: every message type in Georgian, English and Russian, editable with variables ({client_name}, {date}, {time}, {manage_link}…), live preview and a character/SMS counter; unknown variables are refused.
- **Sender name** (e.g. SalonNino) with status; a new name waits for the SMS company's approval.
- **Manual SMS** from the client card; **promotions** to all clients who agreed (optionally by tag), with an unsubscribe link and page. Clients without consent never get promotions — they are logged as skipped.
- **Test SMS** button. Background job `npm.cmd run jobs` (production: the host calls it every minute with `CRON_SECRET`).
- **Not yet**: a real SMS company (Levan chooses later, decision 008) — until then messages are only printed in the dev server window.
- Fixed: translations in background jobs used no language; "send now" used the computer's clock instead of the database's.

## Phase 4 — Public online booking page (2026-10-26)

- **Booking page** `/book/<business>` (e.g. /book/demo-salon), built for phones, in Georgian with a language switch: business card (call, directions, opening hours, team) → services → a person or "anyone available" → day and free time → name, phone, optional email and comment → SMS code → booked. Only real free times are offered, with the business's online rules (notice, how far ahead, services and people bookable online, blocked clients).
- **SMS code** before booking, on by default (owner switch in Settings). Codes last 5 minutes, 5 tries, at most 3 per phone per hour. Until Phase 5 the SMS goes to a fake provider: the code is printed in the dev server window.
- **Confirmation**: "add to calendar" (.ics) and an SMS with a private **manage link** `/m/<key>`, where the client can move or cancel until the cancellation window; after that the page shows the business phone. Online bookings start as confirmed, or pending if the business approves them.
- **Consent**: marketing boxes are unticked by default; a ticked box is recorded with the source "booking page". Returning clients are recognised by phone.
- **Settings**: booking link with copy/open and a QR code to print; SMS-code switch. The team sees "online" and the client's comment on the booking.
- **Security** (decision 007): visitors' browsers get no new database access; everything goes through server code. Codes and manage keys are stored only scrambled. Rate limits and a hidden trap field against bots. 9 new security tests.
- Dashboard checklist now links to services, staff, hours and the booking link.

## After Phase 3b (2026-10-26)

- **Logo** in the sidebar, phone header, sign-in pages and browser tab; works in dark mode.
- **Faster panels, no stuck buttons**: client card, booking history and payments now load in parallel (decision 006). Before, a button pressed right after opening a panel ("arrived", "view notes") could wait 15+ seconds on a busy server.
- **Dates** everywhere use our own month names, so server and browser always show the same text (fixed a page redraw on the clients list).
- Client list order is stable for clients added at the same moment (imports).

## Phase 3b — Calendar and bookings, the rest (2026-10-26)

- **Recurring bookings**: "repeat every N weeks, X times" in the new-booking panel; the list of dates shows clashes before saving, clashing dates can be skipped, the series is saved in one go. "Cancel this and all following" on any booking of a series.
- **Waitlist**: when nothing is free, add the client with wished dates, times and person. The list sits in the calendar; when a booking is cancelled the matching waitlist entries are suggested and can be booked in one click.
- **Checkout**: extra items, discount (amount or %), split payment (cash, card, transfer, gift card), tip per person; paid / partly paid shown on bookings. **Cash page**: daily totals by method and by person, payments list, unpaid visits of the last 30 days. Owner switch decides whether administrators see revenue; staff see only their own.
- **Dental chair view**: day view by chair/room as well as by doctor.
- **Booking import**: paste from Excel or upload .xlsx/.csv; columns are recognised in Georgian, English and Russian and can be corrected; every row is previewed with its problems (unknown service, unknown person, bad date/time/phone/price); good rows import, rows that overlap an existing booking are reported back by line. Clients are matched by phone or created. No SMS is ever sent for imported bookings. Managers only.
- **Security**: 5 new tables with forced RLS, 8 new isolation tests (161 in total).
- **Speed**: a day with 15 staff and 150 bookings loads in about 340 ms from Georgia (test included).
- Tests: end-to-end tests no longer depend on run order or on fresh demo data; local runs use 3 browsers at a time.

## Phase 3a — Calendar and bookings, core (2026-10-27)

- **Bookings in the database**: bookings, one line per service with price and duration copied at booking time, status history, dental treatment notes. All changes go through checked database functions; a staff member may create and move only their own bookings. Double booking is impossible: the database refuses overlapping times for a person or a chair, including two clicks at the same moment (tested).
- **Availability engine**: free times from opening hours, staff hours, date changes, time off, existing bookings with their breaks, chairs, booking rules and the business time zone; "anyone free" picks the least busy person. 17 tests.
- **Calendar**: day (staff as columns), week (one person), list (phone default) and month views; shaded non-working time, hatched time off, red current-time line; Georgian dates ("26 ოქტომბერი, ორშაბათი") from our own month names.
- **Booking**: click an empty slot → find or add the client (allergy warning, no-show count) → services → person or anyone free → real free times → book. Managers can book outside hours after a warning.
- **Changing bookings**: drag to move (time, person, day), drag the bottom edge to change length; reschedule form on phones; status buttons (confirm, arrived, start, complete, no-show, cancel with reason, undo); notes; history. Changes by other admins appear live.
- **My day** for masters and doctors; **visit history** on the client card; **treatment notes** for dental clinics (doctors and owner only, every read logged).
- Demo data now includes bookings from 3 days ago to 6 days ahead.
- Fixed during the phase: deleting a business with bookings could have failed (foreign-key rule), a moved booking jumped back until the refresh, time zone hard-coded in two places, Georgian no-show wording.

## Phase 1 — Services, staff, clients + design foundation (2026-10-26)

- **Design**: light and dark theme from Levan's references (green main colour, grouped sidebar, status pills, number cards, details panel sliding in from the right, filter tabs with counts); colour contrast checked; Inter + Noto Sans Georgian; "More" page on phones.
- **Services**: categories (reorder), fixed / "from" / range prices, duration, break after, online/hidden, colour, variants and add-ons; chairs/rooms requirement for dental.
- **Price list import**: paste from a website or Excel, or upload .xlsx/.csv. Recognises category rows and prices like 35, 25-დან, 250–300, 150–200-დან; asks for a duration where the list has none. Tested with two real price lists (20 services in one go).
- **Staff**: profile with photo and calendar colour, link to a login, services with own price/time, weekly schedule with lunch breaks, one-off date changes, time off (in Tbilisi time).
- **Business settings**: contact details, opening hours, closed days, booking rules (notice, how far ahead, cancellation window, time step, approval), what staff can see, chairs/rooms.
- **Clients / patients**: search by name/phone/email, card with important-note warning, tags, preferred staff, block online booking; marketing consent per channel with dated history; merge duplicates; owner can download a client's data or delete personal data; client import with column recognition in ka/en/ru and duplicate checks.
- **Security**: 16 new tables, all with forced RLS and links that cannot cross businesses; 136 isolation tests in total. Atomic database functions for schedules, staff services, opening hours, imports, merge, export, anonymise.
- **Demo data**: both demo businesses now have services (incl. the spec's examples), staff with schedules, 30 clients each, chairs for the clinic.
- Fixed during the phase: a client-import bug that could attach consent to the wrong client; prices showed "GEL 55" in browsers without Georgian locale data; a browser component importing server-only code.

## Phase 0 — Foundation (2026-10-25)

- Next.js 16 (App Router, strict TypeScript), Tailwind 4, shadcn/ui, lucide icons; `APP_NAME` in `src/lib/app.ts`.
- Georgian / English / Russian with next-intl. The app always opens in Georgian; a language switcher is on every page. A test keeps the three translation files in sync.
- Supabase dev project `bookeria-dev` in Frankfurt. First migration: businesses (tenants), profiles, memberships (owner / admin / staff), invitations, audit log. Row Level Security on and forced on every table; writes that span tables go through checked database functions.
- 32 tenant-isolation tests prove a user of business A cannot see or change anything of business B, staff cannot do owner/admin actions, anonymous visitors see nothing, and a business can be deleted cleanly.
- Sign-up, sign-in, sign-out; create a business (salon or dental clinic) with an auto-generated booking address (Georgian names are transliterated); invite staff by link (email goes through the email adapter — fake provider for now); accept invitation; switch between businesses.
- Dashboard shell: sidebar on desktop, bottom navigation on phones, "Patients" instead of "Clients" for dental clinics, placeholder pages for Calendar / Clients / Services, onboarding checklist.
- Helpers with tests: phone numbers to E.164 (+995), money as integer tetri, slugs.
- Demo data: "სალონი ნინო" and "დენტალ სმაილი" with owner, administrator and staff each.
- Fixed during the phase: business deletion was blocked by the membership audit trigger; emails typed with spaces were rejected; avatar initials turned Georgian letters into Mtavruli capitals; invite email no longer travels in the URL; auth pages now have a real page heading.
- Decisions: 001 Cache Components off, 002 cloud dev database instead of Docker, 003 own invitations table.

## [Unreleased]
- Project brief, rules, specification, roadmap and Claude Code skills created.
