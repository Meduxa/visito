# 030 — Reviews after a visit

**Context.** Rezervo, Visage and EasyWeek all collect ratings after a visit. Visito had none.

**Decision.**
- **Settings → Reviews** (`tenant_settings`) has three switches:
  - ask after a visit by SMS: off by default, because each request costs one SMS
  - the delay: 1–48 h after the visit ends
  - show reviews on the booking page: on by default
- **Sending.** The SMS job runs `reviews_due` and sends one SMS per finished visit, within 3 days, only to clients with a phone. The link is `/r/{token}`; the key is stored only as an HMAC, works for 30 days and is made at most once per visit.
  - It is a service message about the visit itself, so no marketing consent is needed.
  - Quiet hours apply.
  - SMS type `review`.
- **The client's page:**
  - 1–5 stars and an optional comment, one review per visit
  - rate limited
  - available only through the server (`public_review_submit`, service role)
  - the client is told that their first name and comment may be shown
- **Who sees reviews.** RLS: owner/admin see all reviews and reply or hide them (`moderate_review`, audit-logged). Staff see reviews of their own visits.
- **Booking page.** It shows the average, the count and the 6 latest published reviews with a comment. Clients appear by first name only; hidden reviews never show (`public_reviews`).

**Consequence.**
- A rating cannot be edited after it is sent.
- Disputing a review (Rezervo's "contested") is not built; hiding a review covers it for now.
