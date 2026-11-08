# 019 — In-app notifications: stored online bookings, computed "needs a status"

**Context.** Levan wants a bell next to the logo (2026-11-07): new online bookings, and visits whose time is over but nobody set a status, so the team never misses anything. Staff should see only their own.

**Decision.**
- **New online booking** is a stored row in `notifications`, written by `public_create_booking` in the same transaction as the booking — that function only the server key can call (decision 007), so no browser can fake one.
- **Booking needs a status** is **not stored**: `notification_feed()` computes it on every read from bookings that ended in the last 30 days and are still pending/confirmed. It disappears the moment anyone sets a status — no job, no cleanup, nothing to go stale. Bookings entered after they had already ended (imports, back-dated entries) are skipped.
- Visibility is decided in the database (`notification_visible`): owner/admin everything; staff only bookings with an item of their own linked profile (even if "staff see all bookings" is on). Details shown: client name, services, specialists, start time — never notes or health data.
- Read state per user in `notification_reads` (kind + booking), written only through `mark_notifications_read`, which accepts only items in the caller's own feed.
- The bell loads `GET /api/notifications` (a read route, like decision 006), every minute, on window focus and when opened; one shared poller for the sidebar and phone-header bells. No push for now.
- A notification opens `/calendar?date=…&booking=…`, which opens that booking's panel.

**Alternatives considered.** Storing "needs action" rows from the minute job (`npm run jobs`) — rejected: it would need a second job to resolve them, would lag by up to a minute, and would not exist at all when the job is not running. Supabase Realtime push — later, if a minute's delay is a problem.

**Consequences.** New kinds that are events (client cancelled or moved via the manage link) are one insert in the right function plus a value in the `kind` check. Computed kinds cost one indexed query per refresh (`bookings_open_by_end`).
