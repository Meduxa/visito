# Full test plan — test salon with three branches, real SMS

For Levan, 2026-11-19, while Flitt registration is pending. Goal: go through **every** function once, as each kind of user, on a computer and on a phone, with **real SMS to your own phone**. About 6–7 working sessions of 1–2 hours.

Exact Georgian button names are in `docs/GUIDE.ka.md` (section numbers are given as **G 7.2** etc.).

---

## 0. Before you start (one time)

### 0.1 Where we test
**On the real site visito.ge** — so phone, email links, short addresses, SMS and delivery reports work exactly as salons will see them. This needs one deploy of the current work (additional service, legal pages, bot protection, login fix, SMS test mode). Claude does it after your "deploy".

### 0.2 Settings on Netlify (Claude prepares the list, you paste the secret values yourself)
- [ ] `SMS_PROVIDER=tnet`, the five `TNET_*` values (same as in `.env.local`), secrets marked **secret**
- [ ] `SMS_ONLY_TO=+995591314316` — **only your number gets real SMS**. Every other number shows in the SMS log as "test mode — not on the test list" and costs nothing. To add a partner's phone: `+995591314316,+9955XXXXXXXX`.
- [ ] `TURNSTILE_*` keys if you have them (otherwise bot protection stays off — fine for testing)
- [ ] Redeploy, then Settings → SMS → test SMS to your number arrives

### 0.3 Test accounts (use Gmail "+" addresses — they all arrive in your normal inbox)
| Role | Email | Used for |
|---|---|---|
| Owner | `yourname+owner@gmail.com` | creates the test salon |
| Admin (reception) | `yourname+admin@gmail.com` | calendar, clients, checkout |
| Staff 1 | `yourname+staff1@gmail.com` | specialist on the phone |
| Staff 2 | `yourname+staff2@gmail.com` | specialist in another branch |
| Platform admin | your existing admin account | `/admin`: SMS credits, plan, status |

Use a **different browser or a private window** for each person you are signed in as at the same time.

### 0.4 Phone numbers
- **Your number** = the test client who receives SMS ("ლევან ტესტი"). One phone = one client card, so all SMS tests use this one client.
- Other test clients: made-up numbers `555 00 00 01`, `555 00 00 02`, … They never get SMS (log shows "test mode").

### 0.5 SMS credits
A new business gets **50 trial SMS**. One booking ≈ 1–3 SMS (code, confirmation, reminders). Before Day 2: `/admin` → the test salon → **add 300 SMS**.

### 0.5a Testing without real SMS (e.g. abroad)
- Leave SMS on Netlify as it is now (no TNET) — nothing is really sent.
- Test salon → booking rules → **"online booking with SMS code" OFF**, so online booking works without a code.
- Instead of checking the phone, check **Settings → SMS → log**: every SMS the app would send is listed with its text.
- Steps that need a real SMS on the phone (2.3 code, 2.4, 2.17, 5.1–5.3, 5.8 "delivered") wait until you're back in Georgia; then switch TNET on with `SMS_ONLY_TO` (0.2) and repeat only those.

### 0.6 How to report a problem
For every problem write one line in the table at the end: **step number, what you did, what you expected, what happened, time, screenshot**. Don't stop at small problems — note them and continue.

---

## Day 1 — Owner: create and set up the salon (computer)

**Sign-up and login (G 4)**
- [ ] 1.1 visito.ge → "უფასოდ დაწყება" → owner email, name, password → "შეამოწმეთ ელფოსტა"; email arrives from visito.ge; the button signs you in and opens business creation
- [ ] 1.2 Business: name "Visito Test Salon", type **beauty salon**, booking address auto-filled (e.g. `visito-test`) → "ბიზნესის შექმნა". Dashboard opens with "პირველი ნაბიჯები"; trial banner/14 days; 50 SMS
- [ ] 1.3 Sign out → "დაგავიწყდათ პაროლი?" → email → new password works; old one doesn't
- [ ] 1.4 Wrong password 3× → clear error, no crash

**Business data, branches, closed days (G 5.1, 5.6, 5.6.1)**
- [ ] 1.5 Business data: phone, email, address, hours (Mon–Sat 10:00–20:00, Sunday closed)
- [ ] 1.6 Branches: rename the first branch "ვაკე"; add "საბურთალო" and "ისანი" with own phone, address, hours (e.g. Isani 11:00–19:00, closed Monday)
- [ ] 1.7 A **4th branch is refused** (trial limit 3) with a clear message
- [ ] 1.8 Each branch has its own booking link + QR; download a QR
- [ ] 1.9 Closed days: one holiday for **all branches**, one day only for "ისანი"

**Services (G 5.2)**
- [ ] 1.10 Categories: Hair, Nails, Brows
- [ ] 1.11 Services (8–10): e.g. Haircut 45 min 40 ₾, Colouring 120 min 120 ₾, Blow-dry 30 min 25 ₾, Manicure 60 min 35 ₾, Gel polish 90 min, Brow shaping 30 min …; at least one with **buffer** (preparation time) and one with a **price "from"**
- [ ] 1.12 One service **not bookable online**, one **inactive** → check later they're hidden online
- [ ] 1.13 **Requires additional service:** Colouring → Blow-dry after 30 min
- [ ] 1.14 Services available only in some branches (if offered per branch) — check the branch's online page later

**Staff and schedules (G 5.3)**
- [ ] 1.15 Add 5 specialists: 2 in Vake, 2 in Saburtalo, 1 working in **two branches** (Mon–Wed Vake, Thu–Sat Isani); photo, position
- [ ] 1.16 Each specialist's services; one with **own price and own duration** for a service
- [ ] 1.17 Schedules with a lunch break (10:00–14:00, 15:00–20:00); one **date change** (works only half a day next Friday)
- [ ] 1.18 Absence: one specialist on vacation 3 days next week

**Team and access (G 5.4)**
- [ ] 1.19 Invite admin and staff1, staff2 → emails arrive; link also copyable; one invitation cancelled and its link no longer works
- [ ] 1.20 Accept each invitation in its own browser; link staff accounts to their staff profiles (Staff → profile → account)
- [ ] 1.21 Access switches: "staff see all clients" OFF, "staff see all bookings" OFF, "admins see revenue" OFF (check on Day 4)

**Clients import (G 5.5)**
- [ ] 1.22 Import 10 clients from the Excel template (`docs/pilot/import-templates`), one with a bad phone → reported, others imported
- [ ] 1.23 Import a few old bookings → appear in the calendar

**Online booking, website, notifications, SMS (G 6)**
- [ ] 1.24 Booking rules: min. notice 2 h, 60 days ahead, free cancellation 24 h, step 15, **SMS code ON**, confirmation OFF (we switch it on Day 2)
- [ ] 1.25 Website: cover photo, logo, colours, description, Instagram, 3 photos → open the public page and check
- [ ] 1.26 Notifications: who gets the bell for new online bookings / overdue visits
- [ ] 1.27 SMS settings: balance shown, all automatic SMS on, reminders 24 h and 2 h, quiet hours 22:00–09:00; each SMS shows its exact text and count
- [ ] 1.28 Reviews: review request after visit ON
- [ ] 1.29 "პირველი ნაბიჯები" ticks itself and disappears when all done

---

## Day 2 — Client: online booking from your phone (real SMS)

Open the salon link from your phone (as a client would, e.g. scan the QR).

- [ ] 2.1 Page shows 3 branches → "აირჩიეთ ფილიალი"; each shows its own address, hours, services, prices, specialists. A branch link skips the choice
- [ ] 2.2 Not-bookable-online and inactive services are **not** shown
- [ ] 2.3 Book **by service** → specialist → time → your details (your number) → "SMS კოდის გაგზავნა" → **code SMS arrives** → "დაჯავშნა" → "დაჯავშნილია!" + **confirmation SMS arrives**
- [ ] 2.4 Wrong code → error; 5 wrong tries → blocked; code older than 5 min → refused; more than 3 codes an hour → refused
- [ ] 2.5 Book **by specialist**; and with **"any free specialist"** → least busy one chosen
- [ ] 2.6 **Two services** in one visit; services one specialist can't do together → clear message
- [ ] 2.7 Times offered respect: branch hours, lunch break, vacation, closed days, 2 h notice, 60 days, existing bookings + buffer
- [ ] 2.8 The specialist working in two branches is offered only in the right branch on the right days
- [ ] 2.9 "კალენდარში დამატება" → .ics opens in the phone calendar
- [ ] 2.10 "შეცვლა ან გაუქმება" → move the visit to another time → **"rescheduled" SMS**; then cancel → slot free again
- [ ] 2.11 Book a visit starting in less than 24 h → online change is refused: "please call"
- [ ] 2.12 Book **Colouring** online → staff calendar shows "additional service not added" mark + bell notice (Day 3 adds it)
- [ ] 2.13 Owner switches **confirmation ON** → new online booking = "მოთხოვნა გაგზავნილია" + "request received" SMS → admin confirms → **confirmation SMS**
- [ ] 2.14 **Hide prices** ON → no prices on the booking page; OFF again
- [ ] 2.15 **Max future visits per client = 2** → the 3rd online booking is refused with the message; set back to 0
- [ ] 2.16 Admin **blocks** your client for online booking → you can't book online; unblock
- [ ] 2.17 Try booking with a made-up number → code SMS doesn't come (log: "test mode") — expected in test mode
- [ ] 2.18 The same on a computer browser; and in **English** and **Russian**

---

## Day 3 — Reception (admin) in the calendar (computer)

- [ ] 3.1 Calendar views: day, week, by specialist; **branch switch** shows only that branch's bookings and people
- [ ] 3.2 New booking (G 7.2): existing client by name/phone; **new client** inline; **walk-in without client** (no SMS sent)
- [ ] 3.3 Several services in one visit; "any free specialist"
- [ ] 3.4 **Colouring** → reminder card with Blow-dry pre-selected → pick a **free time** for it → two blocks in the calendar, each with its own name
- [ ] 3.5 Open the online Colouring visit from 2.12 → "„დავარცხნა“-ის დამატება" → choose time → added; mark and bell notice disappear
- [ ] 3.6 Conflicts: on a closed day / outside hours / during vacation / overlapping → clear reason; "book anyway" only where allowed
- [ ] 3.7 **Repeat:** every 2 weeks × 4 → "თარიღების შემოწმება" shows conflicts → skip one → saved
- [ ] 3.8 Drag a booking to another time, another specialist, another day; stretch by the bottom edge → for your client a **"rescheduled" SMS** arrives; reminders move with it
- [ ] 3.9 Two people book the **same slot at the same time** (admin + you online) → only one succeeds, the other gets "this time was just taken"
- [ ] 3.10 Waitlist (G 7.5): add a client; cancel a booking → "N clients waiting" → book from the list
- [ ] 3.11 Statuses (G 8): confirm → arrived → in progress → completed; cancel with reason (**cancel SMS** to you); no-show (counter on the client grows); undo cancel
- [ ] 3.12 A past visit left "confirmed" → bell: "booking needs a status"; disappears after setting it
- [ ] 3.13 Bell: new online booking, needs status, additional service not added — each opens the right visit; mark as read
- [ ] 3.14 Checkout (G 9.1): extra item (product), discount %, tip for a specialist, **split payment** cash + card; pay less → "partly paid"; booking shows paid state
- [ ] 3.15 Cashbox (G 9.2): today's totals by method and specialist; unpaid visits list
- [ ] 3.16 Booking import (if not done on Day 1)

---

## Day 4 — Staff and permissions (phone)

Sign in on your phone as **staff1**; install the app on the home screen (G 3.3).

- [ ] 4.1 "ჩემი დღე": current visit highlighted, next visit, today's list; Upcoming / Today / Past
- [ ] 4.2 Sees **only own** calendar and clients (access switches OFF); turn "see all bookings" ON as owner → now sees all; back OFF
- [ ] 4.3 Mark arrived / completed / no-show on own visit; add a note
- [ ] 4.4 Create a booking for themself (if allowed)
- [ ] 4.5 **Time-off request** → owner/admin sees it, approves one, rejects another → calendar blocks the approved days
- [ ] 4.6 Staff has **no Settings**, only "Team"; can't open `/settings/...` addresses by typing them; no revenue, no export
- [ ] 4.7 As **admin**: revenue is hidden ("owner hid revenue"); owner turns it ON → visible
- [ ] 4.8 Admin can't open Subscription and Data & security
- [ ] 4.9 Phone layout: every screen fits 375 px, no sideways scrolling; buttons big enough

---

## Day 5 — SMS from start to end (your phone)

Plan bookings so the reminders arrive while you're awake (quiet hours 22:00–09:00).

- [ ] 5.1 Today at 12:00 book a visit for **tomorrow 14:00** → the **24 h reminder** arrives today at ~14:00 (24 h before the visit)
- [ ] 5.2 Book a visit **in 3 h** → **2 h reminder** arrives 2 h before
- [ ] 5.3 A reminder that falls inside quiet hours → sent at 09:00 if still before the visit, otherwise skipped
- [ ] 5.4 Move a booking after its reminder was planned → old reminder not sent, new one is
- [ ] 5.5 Cancel a booking → its reminders are not sent
- [ ] 5.6 Complete a visit → **review request SMS** with link → leave a review → it appears in Reviews (G 14.4) and, if switched on, on the booking page
- [ ] 5.7 Turn one automatic SMS **off** → it is no longer sent
- [ ] 5.8 SMS log (G 12.6): each SMS with status **delivered** (TNET report), segments; test-mode lines for made-up numbers; balance went down by the right amount
- [ ] 5.9 `/admin` → SMS log across businesses shows the same
- [ ] 5.10 Text of every SMS: correct date/time (Tbilisi time), branch address, Georgian letters fine, no broken links

---

## Day 6 — Clients, reports, account (computer)

**Clients (G 10)**
- [ ] 6.1 Client card: history, visits, no-shows, important note (allergy) shows on bookings
- [ ] 6.2 Custom fields (text, date, list, yes/no) and client groups (VIP, at risk, lost)
- [ ] 6.3 Marketing consent: on/off with who/when recorded
- [ ] 6.4 Export one client's data; delete a client (with confirmation) → gone everywhere, past bookings anonymous
- [ ] 6.5 Search by name and by phone in any format (`591…`, `+995…`)

**Dashboard, reports, payroll (G 14)**
- [ ] 6.6 Dashboard numbers match what you did (bookings, revenue, no-shows)
- [ ] 6.7 Reports by date range, branch, specialist; Excel download opens correctly
- [ ] 6.8 Payroll: fixed + % of services + tips for a specialist → amounts correct

**Account and security (G 15–17)**
- [ ] 6.9 Subscription page (owner): plans and prices shown; **card payment waits for Flitt** — just check the page and the consent tick box
- [ ] 6.10 Platform admin changes the salon to **past due** → banner, everything still works; **suspended** → view and download only; back to trial
- [ ] 6.11 Support access: owner allows 24 h → platform admin opens read-only, can't change anything; owner stops access
- [ ] 6.12 Audit log shows sign-ins, role changes, exports, deleted client, support visit
- [ ] 6.13 "Sign out of all devices" → phone gets signed out on next action
- [ ] 6.14 Switch language ka / en / ru on several screens — no missing texts
- [ ] 6.15 Legal pages and footer on visito.ge open (terms, privacy, DPA, payments)

---

## Day 7 — Ending (last)

- [ ] 7.1 Data & security → download everything (Excel and JSON) → files open, contain clients, bookings, services, payments
- [ ] 7.2 "Delete business…" → banner with the date → **"keep business"** → not deleted
- [ ] 7.3 (Optional) create a throwaway second business and really delete it → after 14 days it's gone. **Keep** the test salon for future tests.
- [ ] 7.4 Remove a staff member from the team and set their profile inactive → history stays, no new online bookings for them

---

## When everything passes

- [ ] All problems in the table fixed and re-tested
- [ ] Decide: what else before the first real salons (see `docs/pilot-test-plan.md`, Stage 2)
- [ ] **At real launch: empty `SMS_ONLY_TO` on Netlify** (otherwise salons' clients get no SMS) — `docs/go-live.md`
- [ ] When Flitt is ready: separate test of card payment, monthly renewal, turning auto-payment off, failed payment

## Problems found

| # | Step | What I did | Expected | What happened | Time | Screenshot | Fixed? |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
