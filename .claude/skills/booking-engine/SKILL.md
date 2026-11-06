---
name: booking-engine
description: Use when building or changing anything about availability, time slots, creating/moving/cancelling bookings, the calendar, recurring bookings, waitlist, reminders timing or the public booking flow in Visito. Defines the availability algorithm, double-booking protection, time-zone handling and required tests.
---

# Booking engine

The calendar is the heart of Visito. Wrong availability or a double booking destroys trust immediately. The engine is **pure, tested logic** shared by the admin calendar, the staff view and the public booking page.

## 1. Time rules

- DB stores `timestamptz` (UTC). The engine works in the **tenant timezone** (`tenants.timezone`, default `Asia/Tbilisi`, UTC+4, no daylight saving — but never hard-code +4; always use the timezone name with `date-fns-tz`).
- A "day" means the business's local day.
- Slot step comes from settings (5/10/15/30 min). Start times snap to the step.

## 2. Inputs to availability

For a request `(tenant, location, services[], staffId | "any", date range)`:

1. **Business open hours** for the location and date, minus **holidays/closed days**.
2. **Staff working intervals** for the date = weekly schedule, replaced by a date override if one exists.
3. Minus **time off** for that staff.
4. Minus **existing bookings** of that staff (statuses that block: `pending`, `confirmed`, `arrived`, `in_progress`; NOT `cancelled_*`, `no_show`), each extended by its `buffer_after_min`.
5. **Required resource** (chair/room) must also be free for the whole interval.
6. Staff must be able to perform **every** requested service (`staff_services`).
7. **Total duration** = sum of each service's duration (per-staff override → variant → base) + add-ons; buffer applies after the last service.
8. **Booking rules**: `min_notice` (no slots earlier than now + notice), `max_days_ahead`.
9. Public page only: services/staff must have `bookable_online = true`; clients flagged `blocked_online` cannot book online.

Output: list of `{ start, end, staffId, resourceId }`. For `"any"` staff: merge all staff slots, keep one option per start time, choosing the staff with the **least booked time that day** (load balancing), ties → staff sort order.

## 3. Implementation shape

```
src/features/booking/engine/
  intervals.ts        # pure interval math: merge, subtract, intersect, split by step
  availability.ts     # getAvailableSlots(input, data) — PURE, no DB calls
  load-data.ts        # fetches schedules, overrides, time off, bookings, resources for the range
  validate.ts         # validateBooking(draft, data) → list of conflicts with reasons
```

- `availability.ts` and `intervals.ts` must be pure functions so they are fast and fully unit-testable.
- The public page calls a **security-definer RPC** (or server action using a restricted path) that loads data and runs the same logic — never two different implementations.

## 4. Double-booking protection (database is the final judge)

UI checks are for convenience only. Two admins (or an admin and an online client) can click at the same moment. Protect in Postgres:

```sql
create extension if not exists btree_gist;

alter table public.booking_items
  add column active boolean not null default true; -- false when booking is cancelled/no_show (maintained by trigger)

alter table public.booking_items
  add constraint no_staff_overlap exclude using gist (
    tenant_id with =,
    staff_id with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (active);

alter table public.booking_items
  add constraint no_resource_overlap exclude using gist (
    tenant_id with =,
    resource_id with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (active and resource_id is not null);
```

`blocked_until` = `ends_at + buffer`. Catch the exclusion-violation error (SQLSTATE `23P01`) and show a friendly message: "This time was just taken — please choose another slot", then refresh availability.

Creating a booking with several items happens in **one transaction** (RPC function), so either all items are saved or none.

## 5. Booking operations

- **Create**: validate → insert booking + items (price/duration snapshots) + status history → schedule reminders (insert future rows in a `scheduled_messages` table or compute in the job) → audit log.
- **Move / resize / change staff**: same validation as create, excluding the booking itself from conflicts. Keep a status-history entry `rescheduled` with old and new times. Reschedule reminders.
- **Cancel / no-show**: set status, set items `active = false` (frees the slot), record reason, cancel pending reminders, increment `clients.no_show_count` on no-show, then check **waitlist** for matching entries and surface suggestions.
- **Recurring**: generate occurrences (e.g. every 2 weeks × 6), validate each, show the user which dates conflict and let them skip/shift those before saving. All share a `recurrence_id`.
- **Walk-in**: start = now (snapped), client optional.
- **Policy for clients** (manage link): cancel/reschedule allowed only until `cancellation_window` before start; afterwards show the business phone.

## 6. Reminders timing

- Reminder offsets from settings (default 24 h and 2 h before start).
- A reminder is due when `now >= starts_at - offset` and booking is still active and not already sent (`messages.idempotency_key = 'reminder:{offset}:{booking_id}:{starts_at}'` — including `starts_at` means a rescheduled booking gets fresh reminders).
- If the booking was created later than the offset (e.g. booked 1 h before), skip that reminder.
- Respect quiet hours: if due inside quiet hours, send at the end of quiet hours only if still before the appointment; otherwise skip.

## 7. Required unit tests (Vitest) — must pass before Phase 3 is done

1. Simple day: 10:00–19:00, 60-min service, step 15 → correct first/last slots.
2. Split shift with lunch break.
3. Date override replaces weekly schedule; day-off override → no slots.
4. Time off in the middle of the day.
5. Existing booking + buffer blocks the right range.
6. Cancelled and no-show bookings do NOT block.
7. Multi-service total duration with per-staff override.
8. Staff who cannot do one of the services is excluded.
9. Resource busy → slot unavailable even if staff is free.
10. `min_notice` and `max_days_ahead`.
11. "Any staff" returns one option per time and load-balances.
12. Booking that would end after closing time is not offered.
13. Timezone: a booking at 23:30 local is on the correct local day.
14. Concurrency: two parallel inserts for the same slot → exactly one succeeds (integration test against local Supabase).
15. Reschedule excludes the booking itself from conflicts.

## 8. Performance

- Load data for the whole visible range in **one round-trip per table**, not per slot.
- Day view with 15 staff and 150 bookings: availability and rendering under 1 second.
- Index: `booking_items (tenant_id, staff_id, starts_at)`, `bookings (tenant_id, starts_at)`.
