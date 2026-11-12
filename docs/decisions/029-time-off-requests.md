# 029 — Staff ask for time off, managers approve

**Context.** In Visito only an owner or admin could enter time off. Rezervo lets staff send requests that a manager approves.

**Decision.**
- **The table** `time_off_requests` holds: specialist, period, reason (vacation / sick / other), note, status, decision, and the resulting `time_off`.
  - Everyone reads through RLS: managers see all requests, staff see only their own profile's.
  - Nobody writes the table directly.
- **Functions:**
  - `request_time_off`: the profile always comes from the membership. A manager may name another profile.
  - `decide_time_off`: owner/admin only. Approving creates the `time_off`. A request can be decided only once.
  - `cancel_time_off_request`: the requester or a manager, while the request is pending.
  - `time_off_conflicts`: the number of bookings in the period, shown before approving.
  - Every step is in the audit log.
- **Screens:**
  - "My day" → "My time off": ask for whole days, see each request's status, withdraw a pending one.
  - Staff page → "Time-off requests" (owner/admin): approve or decline, with a warning about existing bookings.

**Consequence.**
- Approving does not move existing bookings; the manager moves them.
- At most 10 open requests per specialist.
