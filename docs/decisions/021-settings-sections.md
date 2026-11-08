# 021 — Settings in sections; who gets which notification

**Context.** Settings had grown into one long page (website, link, photos, business details, hours, closed days, booking rules, staff access, rooms, support access, account), with Team and SMS as separate menu items. Levan liked the competitor's sectioned Settings and asked for a Notifications section where the business decides who is told about online bookings (2026-11-07).

**Decision.**
- One page per section under `/settings/<section>`, listed in `src/features/settings/sections.ts` (groups, icons, owner-only / dental-only). Each page loads only its own data; the shared layout adds the menu (desktop) or "← Settings" (phone). `/settings` is the home with every section. Existing addresses stay (`/settings/business`, `/settings/sms`, `/settings/team`, `/settings/audit`), so old links and bookmarks work.
- Staff access switches ("staff see all clients/bookings", "admins see revenue") moved from booking rules to Team & access, next to the people they are about; `saveRules` became `saveBookingRules` + `saveAccess`.
- Notifications: four switches on `tenant_settings` (`notify_online_managers`, `notify_online_staff`, `notify_overdue_managers`, `notify_overdue_staff`), default on. `notification_visible(tenant, booking, kind)` checks them in the database, so the bell, the unread count and "mark all read" all agree. "The specialist" is any member linked to a specialist profile on the booking — also an owner/admin who works as a specialist.
- Business-wide switches (like the competitor), not per person. Per-person preferences can come with push notifications.

**Consequences.** A new setting goes into the section where people would look for it; a new section is one entry in `sections.ts`, one page and its texts. The main menu has a single Settings item for managers.
