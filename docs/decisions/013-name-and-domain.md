# 013 — Final name and domain

**Context.** Bookeria was a working name. Alternatives were considered (Saati, Vizito, Moval, Gelit…) and two separate domains for beauty and clinics (2026-10-27/28).

**Decision.** Levan, 2026-10-28: the name stays **Bookeria**, the domain is **bookeria.ge**. One brand for salons and dental clinics; salons get `name.bookeria.ge` (roadmap, before the pilot).

**Consequence.** No rename work. Register bookeria.ge (and ideally the Instagram/Facebook handles) soon; it is needed for Resend email, short salon addresses and going live. Keep the spelling clear in marketing ("b-o-o-k-e-r-i-a"), since heard aloud it may be typed "bukeria" — consider also registering bukeria.ge as a redirect.

**Update 2026-11-06 — renamed to Visito.** Levan bought **visito.ge** (RE:HOST, nameservers on Netlify DNS, HTTPS with a `*.visito.ge` certificate). Every visible name is now Visito (`APP_NAME`, texts in ka/en/ru, wordmark, exports, docs). Internal names stay as they are, so nothing breaks: the GitHub repo, Supabase `visito-dev`, Netlify `visito-ge`, the demo password, the service-worker cache, the HMAC prefix of manage links and calendar UIDs. `bookeria` and `visito` are both reserved short addresses. The new logo mark is still to be chosen (concepts A–E in Figma); until then the calendar mark sits next to the Visito wordmark. Later the same day the project folder was renamed to `Visito`; all checks (types, lint, unit and RLS tests, dev server) still pass.
