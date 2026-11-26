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

- [x] 3.1 Calendar views: day, week, by specialist; **branch switch** shows only that branch's bookings and people
- [x] 3.2 New booking (G 7.2): existing client by name/phone; **new client** inline; **walk-in without client** (no SMS sent)
- [x] 3.3 Several services in one visit; "any free specialist"
- [x] 3.4 **Colouring** → reminder card with Blow-dry pre-selected → pick a **free time** for it → two blocks in the calendar, each with its own name
- [x] 3.5 Open the online Colouring visit from 2.12 → "„დავარცხნა“-ის დამატება" → choose time → added; mark and bell notice disappear
- [x] 3.6 Conflicts: on a closed day / outside hours / during vacation / overlapping → clear reason; "book anyway" only where allowed
- [x] 3.7 **Repeat:** every 2 weeks × 4 → "თარიღების შემოწმება" shows conflicts → skip one → saved
- [x] 3.8 Drag a booking to another time, another specialist, another day; stretch by the bottom edge → for your client a **"rescheduled" SMS** arrives; reminders move with it
- [x] 3.9 Two people book the **same slot at the same time** (admin + you online) → only one succeeds, the other gets "this time was just taken"
- [x] 3.10 Waitlist (G 7.5): add a client; cancel a booking → "N clients waiting" → book from the list
- [x] 3.11 Statuses (G 8): confirm → arrived → in progress → completed; cancel with reason (**cancel SMS** to you); no-show (counter on the client grows); undo cancel
- [x] 3.12 A past visit left "confirmed" → bell: "booking needs a status"; disappears after setting it
- [x] 3.13 Bell: new online booking, needs status, additional service not added — each opens the right visit; mark as read
- [x] 3.14 Checkout (G 9.1): extra item (product), discount %, tip for a specialist, **split payment** cash + card; pay less → "partly paid"; booking shows paid state
- [x] 3.15 Cashbox (G 9.2): today's totals by method and specialist; unpaid visits list
- [x] 3.16 Booking import (if not done on Day 1)

---

## Day 4 — Staff and permissions (phone)

Sign in on your phone as **staff1**; install the app on the home screen (G 3.3).

> 27.11: run by Claude on localhost at phone size (staff1, then admin). Not covered: installing on the home screen and a real phone — for you.

- [x] 4.1 "ჩემი დღე": current visit highlighted, next visit, today's list; Upcoming / Today / Past
- [x] 4.2 Sees **only own** calendar and clients (access switches OFF); turn "see all bookings" ON as owner → now sees all; back OFF
- [x] 4.3 Mark arrived / completed / no-show on own visit; add a note
- [x] 4.4 Create a booking for themself (if allowed)
- [x] 4.5 **Time-off request** → owner/admin sees it, approves one, rejects another → calendar blocks the approved days
- [x] 4.6 Staff has **no Settings**, only "Team"; can't open `/settings/...` addresses by typing them; no revenue, no export
- [x] 4.7 As **admin**: revenue is hidden ("owner hid revenue"); owner turns it ON → visible
- [x] 4.8 Admin can't open Subscription and Data & security
- [x] 4.9 Phone layout: every screen fits 375 px, no sideways scrolling; buttons big enough

---

## Day 5 — SMS from start to end (your phone)

Plan bookings so the reminders arrive while you're awake (quiet hours 22:00–09:00).

> 27.11, Claude on localhost: which reminders are due (24 h, 2 h; cancelled and late-booked visits left out), quiet hours, SMS switch off, review → Reviews and booking page, SMS log and balance — OK. Not done: real delivery on the phone, TNET "delivered" status, /admin (needs a platform-admin login). #52 fixed 27.11 (CRON_SECRET re-entered) — now repeat 5.1–5.6 on your phone.

- [ ] 5.1 Today at 12:00 book a visit for **tomorrow 14:00** → the **24 h reminder** arrives today at ~14:00 (24 h before the visit)
- [x] 5.2 Book a visit **in 3 h** → **2 h reminder** arrives 2 h before
- [x] 5.3 A reminder that falls inside quiet hours → sent at 09:00 if still before the visit, otherwise skipped
- [ ] 5.4 Move a booking after its reminder was planned → old reminder not sent, new one is
- [ ] 5.5 Cancel a booking → its reminders are not sent
- [x] 5.6 Complete a visit → **review request SMS** with link → leave a review → it appears in Reviews (G 14.4) and, if switched on, on the booking page
- [x] 5.7 Turn one automatic SMS **off** → it is no longer sent
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

- [x] All problems in the table fixed (26.11) — re-tested on localhost; on the phone: re-check after the next deploy
- [ ] Decide: what else before the first real salons (see `docs/pilot-test-plan.md`, Stage 2)
- [ ] **At real launch: empty `SMS_ONLY_TO` on Netlify** (otherwise salons' clients get no SMS) — `docs/go-live.md`
- [ ] When Flitt is ready: separate test of card payment, monthly renewal, turning auto-payment off, failed payment

## Problems found

| # | Step | What I did | Expected | What happened | Time | Screenshot | Fixed? |
|---|---|---|---|---|---|---|---|
| 1 | 1.9 / 1.19 | Closed days → branch; Team → role | Field shows the chosen value | Field looks **empty** although "all branches" / "staff member" is selected | 25.11 | Claude | Fixed 26.11: shows the chosen text from the first moment (it was empty only until the page finished loading) |
| 2 | 1.13 | Service window | Save easy to find | **Save is mid-form, below the fold; Delete is pinned at the bottom** | 25.11 | Claude | Fixed 26.11: Save moved to the bottom bar, next to Delete |
| 3 | 1.19 | Invite admin, then next person | Role resets | Role **stays "administrator"** → easy to invite staff as admin | 25.11 | Claude | Fixed 26.11: role goes back to "staff" after each invitation |
| 4 | 1.19 | Cancel an invitation | Box with the link disappears | "Invitation created" box still shows the **cancelled link** | 25.11 | Claude | Fixed 26.11: the link box disappears when that invitation is cancelled |
| 5 | 1.19 | Cancel an invitation | Visito's own confirm window | Browser's plain confirm box (OK/Cancel in browser language) | 25.11 | Claude | Fixed 26.11: Visito window, buttons "არა" / "მოწვევის გაუქმება" |
| 6 | 1.20 | Staff signs in before being linked to a profile | Explanation what to do | Home page empty under "აი, რით დაიწყოთ" | 25.11 | Claude | Fixed 26.11: staff home explains "not linked yet — ask the owner", or links to My day / Calendar |
| 7 | 1.15 | Isani opens 11:00, Mariam's shift there 10:00 | Warning | No warning (check Day 2 that 10:00 is not offered) | 25.11 | Claude | Fixed 26.11: yellow note under the day ("ისანი ამ დღეს ღიაა 11:00–19:00…"); saving still allowed |
| 8 | 1.22 | Clients → import | "ჩასვით კლიენტების სია" | Says **"ჩასვით ფასების სია"** (price list) | 25.11 | Claude | Fixed 26.11: "ჩასვით კლიენტების სია" |
| 9 | 1.2 | Dashboard | Correct Georgian | "ვიზიტო ტესტ სალონი-ის მართვის პანელი" | 25.11 | Claude | Fixed 26.11: "მართვის პანელი — {name}" (also Team, decline request, client deletion) |
| 10 | 1.21 | Team → access switches | Clear state | "გამორთული: …" under each switch reads like the current state, not "when off" | 25.11 | Claude | Fixed 26.11: "თუ გამორთულია: …" |
| 11 | 1.8 | New branch "საბურთალო" | Link `?branch=saburtalo` | Link name `branch-2` | 25.11 | Claude | Fixed 26.11: new branches get the link name from the name (საბურთალო → saburtalo). Existing test branches keep branch-2/branch-3 (can be renamed on the branch page) |
| 12 | 1.2 | Dashboard at 1024 px | Titles readable | Card titles cut ("ჯავშნე…", "შემოსა…") | 25.11 | Claude | Fixed 26.11: card title on its own line under the icon |
| 13 | 1.15–1.18 | Staff page | — | Tab bar shows ▲▼ arrows; own-price placeholders and absence time fields cut off; team email box very narrow | 25.11 | Claude | Fixed 26.11: no ▲▼ in the tab bar; short placeholders "ფასი, ₾" / "დრო, წთ"; new time fields fit; email box full width |
| 14 | — | Time fields | 24-hour time | Shows 10:00 AM / 07:00 PM when the browser is English | 25.11 | Claude | Fixed 26.11: own 24-hour time field (hours + minutes lists) everywhere. Note: date fields still follow the phone language |
| 15 | — | Screen reader | Labels in Georgian | Many switches/checkboxes unlabeled; colour buttons, "Close", "salon/dental" in English; 4 identical "გაუქმება" buttons | 25.11 | Claude | Fixed 26.11: "Close" and colour names in the page language; invitation buttons named with the email; confirm windows say "არა" instead of a 2nd "გაუქმება". "salon/dental in English" not found again |
| 16 | 1.27 | SMS texts | Client knows which salon | Texts have no salon or branch name (sender is "Visito") — decide | 25.11 | Claude | Fixed 26.11 (decision 039): every automatic SMS starts with the salon name, plus the branch when there are several |
| 17 | 1.27 | Review request SMS | 1 SMS | 87 characters = **2 SMS** because of the long link | 25.11 | Claude | Fixed 26.11: shorter review link + text "გმადლობთ! შეაფასეთ ვიზიტი: …" = 69 characters, 1 SMS |
| 18 | 2.12 | Bell (Georgian) | "7 წუთის წინ" | **"7 minutes ago" in English** | 26.11 | Claude | Fixed 26.11: Visito's own words ("7 წუთის წინ"); many browsers have no Georgian built in |
| 19 | 2.10 | Client moves/cancels with the manage link | Salon is told | No bell notice; the "new online booking" notice of a cancelled visit doesn't show it was cancelled | 26.11 | Claude | Fixed 26.11: bell notices "კლიენტმა ვიზიტი გადაიტანა" / "…გააუქმა"; a cancelled online booking shows "· გაუქმებულია" |
| 20 | 2.15–2.16 | Client over the limit / blocked client | Refused before the SMS code | Refused only **after** the code is sent → the salon pays an SMS for nothing | 26.11 | Claude | Fixed 26.11: checked before the code; message "ამ ნომრით ონლაინ ჯავშანი ახლა ვერ მოხერხდება…", no SMS sent |
| 21 | 2.3 | Wrong email on the booking form | Georgian message | Browser's own bubble in the phone's language (English here) | 26.11 | Claude | Fixed 26.11: "შეიყვანეთ სწორი ელფოსტა" under the field |
| 22 | 2.10 | Cancel on the manage page | Clear buttons | Buttons "გაუქმება" (= close) and "ჯავშნის გაუქმება" look alike | 26.11 | Claude | Fixed 26.11: "ჯავშნის გაუქმება" / "არა, დავტოვო" |
| 23 | 2.10 | Manage page | Same as booking | Price "120 ₾" loses "-დან"; for the main branch "სად" shows no branch name | 26.11 | Claude | Fixed 26.11: "120 ₾-დან"; branch name shown also for the main branch; no price when the salon hides prices |
| 24 | 2.3 | Confirmation SMS with 3 branches | Says which branch | Date and time only (see #16) | 26.11 | Claude | Fixed 26.11 with #16 |
| 25 | 2.18 | Booking page in en/ru | Translated | Interface yes; positions, branch names, addresses only in Georgian (no field to translate) | 26.11 | Claude | Fixed 26.11 (decision 039): optional English/Russian name + address per branch, and position per staff member; empty = Georgian |
| 26 | 3.4 / 3.5 | Save a visit / add the additional service | Calendar shows it at once | Change appears only after ~5–10 s (until then the old block, mark still visible). Recheck on visito.ge — the laptop's dev server is slower | 26.11 | Claude | Not changed: on the laptop the dev server re-renders slowly; recheck on visito.ge after deploy |
| 27 | 3.6 | Book Ana during her vacation (1–3 Dec) | "Specialist is on time off" | Says **"სპეციალისტის სამუშაო საათების გარეთაა"** (outside working hours) and offers "მაინც დაჯავშნა" | 26.11 | Claude | Fixed 27.11: "სპეციალისტს ამ დროს არყოფნა აქვს (შვებულება, ავადმყოფობა ან სხვა)."; "მაინც დაჯავშნა" still possible |
| 28 | 3.7 | Repeat every 2 weeks × 4 | Client is told | **No confirmation SMS at all** for a repeat series (single bookings get one; reminders still come) | 26.11 | Claude | Fixed 27.11: one confirmation SMS for the series (its first visit); every visit keeps its reminders |
| 29 | 3.10 | Add to waitlist | Possible when the wanted time is taken | "მოლოდინის სიაში დამატება" appears **only when the whole day has no free time** | 26.11 | Claude | Fixed 27.11: "მოლოდინის სიაში დამატება" also under the free times |
| 30 | 3.10 | Cancel → "ამ დროს 1 კლიენტი ელოდება" → ნახვა → დაჯავშნა | Opens at the freed time (4 Dec 10:00) | Opens at the waitlist's first date (2 Dec, Ana on vacation, no times); date and time chosen again by hand | 26.11 | Claude | Fixed 27.11: opens at the freed time and specialist |
| 31 | 3.11 | Cancel a visit, then "დაბრუნება" (undo) | Client knows it is back on | Client got **"ჯავშანი გაუქმებულია"** and **nothing after the undo** → thinks it is cancelled | 26.11 | Claude | Fixed 27.11: undo sends "ჯავშანი დადასტურდა"; a second cancel sends its own SMS again |
| 32 | 3.10–3.11 | Cancel / no-show confirm window | Clear question | Title and text both "დარწმუნებული ხართ?" | 26.11 | Claude | Fixed 27.11: own explanation per action (e.g. "ჯავშანი გაუქმდება და დრო გათავისუფლდება."); duplicates hidden everywhere |
| 33 | 3.11 | Confirm Mzia's pending online request | SMS says confirmed | SMS says "ჯავშანი შექმნილია" (created) — after "მოთხოვნა მიღებულია" "დადასტურებულია" reads better | 26.11 | Claude | Fixed 27.11: "{salon}: ჯავშანი დადასტურდა — …" (68 characters, 1 SMS) |
| 34 | 3.14 | Checkout with a 10 ₾ tip | Tip visible in the amount to take | Tip not in "გადასახდელი" nor on "მიღება 162 ₾" (saved correctly on the cash payment, shows in the cashbox) | 26.11 | Claude | Fixed 27.11: "თიფი (ანა ვაკელი) +5 ₾", "სულ მისაღები" and "მიღება" include the tip |
| 35 | 3.14 | Visit panel after checkout | Lines add up | Shows 120 + 35 and "ჯამი 162 ₾"; the extra item (შამპუნი 25 ₾) and discount (−18 ₾) are not listed | 26.11 | Claude | Fixed 27.11: extra items and "ფასდაკლება −18 ₾" listed |
| 36 | 3.16 | Booking import with 3 branches | Visit in the specialist's branch | **Always the main branch**, no branch choice → a Saburtalo specialist's imported visits land in Vake (and its SMS would say "ვაკე") | 26.11 | Claude | Fixed 27.11: the branch where the specialist works that weekday (date change first), main branch otherwise |
| 37 | 3.5 | Visit panel of the online colouring | Correct Georgian, "-დან" price | Button "„დავარცხნა / ფენით გაშრობა“-ის დამატება" ("-ის" after quotes, like #9); "from" price shows "120 ₾" without "-დან" | 26.11 | Claude | Fixed 27.11: "დამატება: „დავარცხნა / ფენით გაშრობა“"; "120 ₾-დან" |
| 38 | 3.8 | Stretch a visit by its bottom edge | "Length changed" | Message "გადატანილია" (moved) | 26.11 | Claude | Fixed 27.11: "ხანგრძლივობა შეიცვალა" |
| 39 | 3.9 | Second person saves the just-taken slot | Free times refreshed | Correct refusal "სპეციალისტი ამ დროს დაკავებულია.", but the list still offers the taken 15:00 | 26.11 | Claude | Fixed 27.11: free times reload after the refusal |
| 40 | 3.2 | Client search in a new booking | Smooth | Results appear 1–2 s later with no "searching…" sign and push "ახალი კლიენტი" down — easy to click the wrong button. Screen readers: walk-in block and pending visits have no "walk-in"/status in their name | 26.11 | Claude | Fixed 27.11: "იძებნება…" / "ვერ მოიძებნა — დაამატეთ ახალი კლიენტი."; block names say "პირდაპირ მოსული" and the status |
| 41 | 3.13 | "ყველას წაკითხულად მონიშვნა" | Badge 0 | Server 0 but badge stayed "3" until reload — may be my automated click; recheck by hand | 26.11 | Claude | Not reproduced in code (badge is updated at once); recheck by hand |
| 42 | 3.14 | Second checkout of a part-paid visit (found while re-testing) | Due 12 ₾ (162 − 150) | Discount forgotten: asked 30 ₾, and saving would have raised the total back to 180 ₾ | 27.11 | Claude | Fixed 27.11: checkout starts with the discount already given |
| 43 | 4.2 | Staff with "see all bookings" ON | Other clients' visits marked as hidden clients | Visits of clients the staff member may not see show as **"პირდაპირ მოსული"** (walk-in); other specialists' visits don't say who does them | 27.11 | Claude | Fixed 27.11: hidden clients show "სხვა სპეციალისტის კლიენტი"; with the switch on, staff get everyone's columns and names. Needs a staff sign-in to see |
| 44 | 4.3 / 3.13 | Open a visit by link (bell notices use this) when it is in another branch | Calendar switches to the visit's branch and opens it | Opens the default branch; the visit's window does not open (Keti at Isani) | 27.11 | Claude | Fixed 27.11: a visit link opens that visit's branch |
| 45 | 4.1 | "ჩემი დღე" on a phone | Today's visits on the first screen | The three number cards stack full-width and fill the first screen; today's list starts below the fold | 27.11 | Claude | Fixed 27.11: three small cards in one row on a phone |
| 46 | 4.3 | No-show visit window | Count of earlier no-shows | "ადრე 1-ჯერ არ გამოცხადდა" counts this very visit as "earlier" | 27.11 | Claude | Fixed 27.11: this visit is not counted |
| 47 | 4.5 | Reject a time-off request | Button "უარყოფა", optional reason | Confirm button says **"წაშლა"** (delete); no reason field (the request has a place for it) | 27.11 | Claude | Fixed 27.11: button "უარყოფა" and an optional reason the staff member sees |
| 48 | 4.5 | Staff sends a time-off request | Owner/admin is told | No bell notice; seen only on the Staff page | 27.11 | Claude | Fixed 27.11: count next to "პერსონალი" (and a dot on "მეტი" on phones) while requests wait |
| 49 | 4.5 | Send a time-off request | Shown in the list at once | List says "მოთხოვნები ჯერ არ არის" for a few seconds after "შენახულია" | 27.11 | Claude | Not changed: same slow re-render on the laptop as #26; recheck on visito.ge |
| 50 | 4.7 | Admin with revenue hidden | Menu without money pages | Cashbox / Reports / Payroll stay in the menu and open to "მფლობელმა … დაუმალა" | 27.11 | Claude | Fixed 27.11: money pages leave the menu when the owner hides revenue |
| 51 | 4.9 | Small things at 375 px | — | Calendar branch picker 32 px high (finger target); it shows empty until the page finishes loading (like #1); "მეტი" page tab title is only "Visito" | 27.11 | Claude | Fixed 27.11: all dropdowns are finger-sized on phones (44 px; a shared style was overriding it); branch name shown from the start; "მეტი" has its own tab title |
| 52 | 5.1–5.6 | Live SMS job on Netlify (cron-sms, every 5 min) and daily job (cron-daily) | Runs | **Every run fails (287 of 287 in 24 h):** "Cannot convert argument to a ByteString … character at index 34 has a value of 8220". The `CRON_SECRET` saved on Netlify contains a curly quote (“). On visito.ge **no reminders, review requests or held messages go out**, and the daily job (trial endings, deletions) does not run. **Fix: Levan re-enters CRON_SECRET (letters and digits only) and redeploys.** The job now logs a clear message if this happens again | 27.11 | Claude | Fixed 27.11: Levan re-entered CRON_SECRET and redeployed — cron-sms returns 200 from 20:10 UTC. Job now logs a clear reason if it happens again |
| 53 | 5.4 / 5.5 | Read the code: a reminder already waiting in the queue (e.g. held during quiet hours until 09:00), then the visit is moved or cancelled | Old reminder not sent | Nothing removes or re-checks a queued message: it would still go out with the old time, or for a cancelled visit | 27.11 | Claude | Fixed 27.11: before a queued message about a visit is sent, it is checked against the visit now — moved/cancelled/replaced ones are not sent (credits back) and the log says why. Unit-tested; to see live after deploy |
| 54 | 5.8 | SMS settings page with 3 branches | Example shows the branch | Text examples show only the salon name, not ", ვაკე" | 27.11 | Claude | |
| 55 | 5.6 | Review request made on the laptop | — | Its link is `http://localhost:3000/r/…` (2 SMS) and the live site would send it — a side effect of the laptop and visito.ge sharing one database, not an app bug | 27.11 | Claude | |
