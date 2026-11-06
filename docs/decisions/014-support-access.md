# 014 — Support access: view only, with the owner's consent

**Context.** SPEC 4.15: Visito support may look into a business only with the owner's in-app consent, time-limited and logged. Levan chose **view only** (2026-10-28).

**Decision.**
- The owner allows it for 24 h or 3 days (Settings → Business) and can end it at any time; one open consent at a time (`support_grants`).
- A platform admin opens the business from `/admin/t/[id]` ("Open (view only)"); a cookie names the business, re-checked on every request against platform admin + open consent. The app treats the session as an admin of that business in read-only mode, with a banner and a "Leave" button.
- The database enforces "view only": `has_role(..., 'admin')` and `user_tenant_ids()` include support **only inside a READ ONLY transaction** (`support_view()`), which is how the API runs every plain read (GET). PostgreSQL refuses any write in such a transaction, so no policy, function or app bug can turn a support visit into a change. Read-only functions the screens need are called as reads (`rpc(..., { get: true })`).
- Support is never "owner": dental treatment notes and owner-only screens stay hidden.
- Consent given, consent ended and every visit are written to the business's own audit log (shown as "Visito").

**Consequence.** A new screen that reads through a function called as POST will look empty in support view until the call is marked `{ get: true }`. Live calendar updates don't reach the support view (refresh instead).
