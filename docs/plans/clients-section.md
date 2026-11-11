# Plan: a better Clients section (2026-11-09)

**Goal.** Make the client list a real CRM at a glance, the way salons use Visage and EasyWeek. You should see right away:
- who comes often
- who stopped coming
- who is booked next
- how much each client is worth

Then you can act on it: call, book, or send an SMS.

## What the competitors have (checked 2026-11-08/09)

| | Visage | EasyWeek | Visito today |
|---|---|---|---|
| List columns | name, phone, note (edit inline), last visit, next visit, visits, total spent; choose columns | no., tags, phone, visits, average check, paid | name, phone, consent, date added |
| Sort / filter | sort, filters, search | "add a filter", search | search only |
| Automatic groups | new · regular · VIP · at risk · lost (paid module) | new · inactive · no bookings · no-show · birthday · app users; own segments | none |
| Client card numbers | visits, spent, average, last/next visit, no-shows | visits, average check, paid | visit list only |
| Tags | yes (module) | yes, with categories | yes |
| Notes / allergies | notes & preferences | — | notes + important note (shown on every booking) |
| Import / export / merge | yes | yes | yes |
| SMS to a group | by segment (paid module) | — | to all who agreed, or by tag |

## Step 1: build now

**1. Numbers per client, worked out by the database** (a view on top of clients and bookings, using the rights each person already has):
- **Visits:** completed visits.
- **Last visit:** the date of the last completed visit.
- **Next visit:** the next pending or confirmed visit.
- **Spent:** the total of completed visits, after discount. Visits imported from an old system count too.
- **Average:** spent ÷ visits.
- **No-shows, cancellations, client since:** some of these already exist; they get shown now.
- **Who sees money:** "Spent" and "Average" are visible only to people who may see revenue: the owner, and admins when "Admins see revenue" is on. Everyone else gets empty values from the database itself, not just a hidden column.

**2. Automatic groups (segments)**, worked out from visits and the last visit date:

| Group | Rule |
|---|---|
| ახალი (new) | 0–1 visits, last visit within 60 days (or none yet) |
| მუდმივი (regular) | 2–4 visits, last visit within 60 days |
| VIP | 5+ visits, last visit within 60 days |
| რისკის ქვეშ (at risk) | last visit 60–180 days ago |
| დაკარგული (lost) | last visit over 180 days ago |

The numbers 60 and 180 are fixed for now. They could become a setting later.

**3. Client list:**
- **New columns:**
  - Name (with tags and ⚠ important note)
  - Phone
  - Group
  - Last visit
  - Next visit
  - Visits
  - Spent and Average (only for people who may see money)
- On a phone each client is a compact card: name, group, phone, and one line with "last … · next …".
- **Group chips** above the list: All · New · Regular · VIP · At risk · Lost.
- **Filters:**
  - tag
  - has an upcoming visit
  - birthday this month
  - had a no-show
- **Sort by:** newest added (default) · name · last visit · visits · spent.
- Search, paging and the filters all live in the address, so a link reopens the same view.

**4. Client card:** a row of number tiles at the top:
- visits
- spent
- average
- last visit
- next visit
- no-shows
- cancellations
- client since

The client's group is shown next to the name.

**5. Safety and tests:**
- an isolation test proving each business sees only its own clients' numbers
- staff see only what their rights allow
- admins without "see revenue" get no money values
- an end-to-end test of the columns, the group chips, sorting and the card
- Georgian, English and Russian; phone width 375 px

## Step 2 (items 2–6 built 2026-11-11, decision 026; SMS to a group and loyalty still open)

1. **SMS to a group:** "Send to at-risk clients" from the list (marketing consent still required). This is Visage's paid "SMS marketing by segment".
2. **Choose columns**, and export exactly the current view to Excel.
3. **Edit the note inline** from the list (Visage).
4. **Own fields** (EasyWeek's "custom attributes"), e.g. hair type or formula, optionally asked on the booking page.
5. Group thresholds (60 / 180 days, VIP at 5 visits) as a setting.
6. "New booking for this client" straight from the card.
7. Loyalty (points or stamps), as a separate module.

## Not doing

- Client numbers like "CN-1" (EasyWeek): we have phone search.
- A separate "uses the app" group: we have no client app.
