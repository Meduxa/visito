# 032 — Branches (several locations of one business)

**Context.** Salons with 2–3 branches must be served from one account (Levan, 2026-11-12). The schema already had `locations` with a main branch; bookings were always put in the main branch.

**Decision (Levan's answers).**
- **Plan limit:** `plans.max_locations` — Starter 1, Standard 3, trial 3, Clinic/Premium no limit (null). A trigger refuses activating one more branch than the plan allows (P0006). Visito's admin changes it in `/admin/plans`. After a downgrade, extra branches keep their data; the booking page and calendar show only as many as the plan allows (main branch first).
- **Staff work in several branches, by day:** every schedule interval (`staff_schedules.location_id`, `staff_schedule_overrides.location_id`) says where; no branch = the main one. One day's intervals may not overlap whatever the branch (one person, one place). A date change replaces the whole day in every branch. A booking anywhere blocks the person everywhere (the existing overlap constraint).
- **Services:** one service list. `service_locations` lets a branch switch a service off or give it its own price (no row = offered at the normal price). Price order: the person's own price → branch price → variant → service. Branch prices apply to services without variants; variants keep their prices.
- **Booking page:** one page per business; with more than one branch the client chooses the branch first. Each branch has its own link `/book/{business}?branch={slug}` and QR code, which skips that step.
- **Rooms/chairs and closed days** belong to a branch (`resources.location_id`, `closures.location_id`; none = main branch / whole business).
- Bookings store the branch; reminders and the manage page show that branch's address and phone.

**Consequences.** The engine takes the branch and keeps only its intervals (`EngineData.locationId`, unit tests "branches"). Admin calendar, new booking and reports get a branch switch when there is more than one branch. One-branch businesses see no change.
