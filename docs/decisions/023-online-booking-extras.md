# 023 — Online booking extras: hide prices, upcoming-visit limit, embed code

**Context.** Visage and EasyWeek both offer these, and Visito didn't (docs/competitors). Levan asked for them on 2026-11-09.

**Decision.**
- **Hide prices.** The switch is `tenant_settings.online_show_prices` (default on). When it's off, the server sends the booking page services with no prices (zeroed in `getPublicBusiness`), so hidden prices never reach the browser. The client's own manage link still shows the visit total.
- **Upcoming-visit limit.** The setting is `tenant_settings.online_max_upcoming`, from 0 to 20 (0 = no limit).
  - It counts the client's future visits that are pending or confirmed, however they were booked.
  - Only online booking enforces it: `public_create_booking` raises P0006. The team can still book more from the calendar.
  - The function locks the client row first, so two bookings at the same moment can't both slip under the limit.
- **Embed code.**
  - The page is `/{locale}/embed/{slug}`: the same booking flow, without the website parts (cover, team, gallery, map).
  - It is the **only** address other sites may frame: CSP `frame-ancestors *` and no `X-Frame-Options`. Every other page keeps `frame-ancestors 'none'` + `DENY` (next.config.ts).
  - Inside the frame, the "change or cancel" link and the legal links open a new tab, because those pages can't be framed.
  - Settings → Online booking shows two snippets to copy: an iframe, and a button that links to the booking page.

**Consequences.**
- A framed booking form could in principle be overlaid by a hostile site (clickjacking). We accept that: the form only creates a booking, protected by the SMS code and rate limits, and nothing signed-in can be framed.
- Tests: `supabase/tests/rls_online_limits.test.ts` and `e2e/online-extras.spec.ts`.
