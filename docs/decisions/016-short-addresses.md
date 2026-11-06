# 016 — Short addresses: {slug}.visito.ge

**Context.** Salons share their booking link on Instagram, on the wall and by phone; `visito.ge/book/teka` is long. Levan asked for `teka.visito.ge` before the pilot (2026-10-27).

**Decision.**
- One setting, `SITE_DOMAIN` (server-only, read at run time): `visito.ge` in production, empty = off; on the laptop it defaults to `localhost:3000` (Chrome opens `orchidea.localhost:3000`).
- `proxy.ts` sees `{slug}.{SITE_DOMAIN}`: `/`, `/en`, `/ru` show that business's website (a rewrite — the address stays short); legal pages and manage/unsubscribe links work there too; anything else (sign-in, the app) goes to the main site. Unknown names give "not found".
- The existing `/book/[slug]` links keep working, so links already shared never break.
- Names we use ourselves (`www`, `app`, `admin`, `api`, …) can't be taken as a business address — refused by sign-up and by a database check (`tenants_slug_not_reserved`, list kept in sync with `src/lib/site.ts`).
- Settings shows and the QR code encodes the short address when it is on.

**Consequence.** Going live needs a wildcard domain `*.visito.ge` on Netlify (wildcard certificate; see `docs/go-live.md`) and `SITE_DOMAIN=visito.ge`. On the laptop the "go to the main site" redirect is skipped, because Next.js keeps redirects to `localhost` on the current host.
