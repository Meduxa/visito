# 027 — TNET is the SMS company

**Context.** Levan chose TNET (2026-11-12) and supplied its "SMS API: Integration reference". sender.ge (decision 018) was never switched on: the sender name was blocked and there was no delivery callback. The analysis is in `docs/plans/tnet-sms.md`.

**Decision.**
- **The adapter** is `src/integrations/sms/providers/tnet.ts`. It is switched on with `SMS_PROVIDER=tnet` plus five server-only values: `TNET_BASE_URL`, `TNET_CLIENT_ID`, `TNET_SECRET_HASH`, `TNET_SENDER` and `TNET_WEBHOOK_SECRET`.
- **Every SMS** goes through `POST /sms/messages` with a client token (`POST /sms/login`). The token is kept in memory and renewed 30 s before it expires; concurrent sends share one login.
  - Service SMS use `priority: 1`, promotions `0`.
  - The sender title is the business's approved name, otherwise `TNET_SENDER`.
- **Idempotency-Key** is our `sms_messages.id`, in lower case.
  - A timeout or 5xx is retried once at once with the same key; TNET then refuses a repeat for 5 minutes.
  - If the outcome is still unknown, or TNET answers 409, the message is "uncertain" and is not retried, so it can never be sent twice.
  - A 401 means: log in again and try once more. A 429 is retried by the queue.
- **Delivery reports** arrive at `POST /api/webhooks/sms/tnet`.
  - HMAC-SHA256 over `timestamp.rawBody`, `v1=` hex, a 300 s window and a constant-time comparison, checked before parsing. There is no unsigned fallback.
  - `DELIVRD` → delivered; final failure codes → `undelivered:CODE`. Only "sent" messages change, so repeats are harmless.
  - The SMS job also asks `GET /sms/{id}/status` as a backup.
- **Not used yet:** bulk SMS, contact import, campaigns and the company token. A contact import would re-subscribe people who opted out.

**Consequences.**
- Nothing else changes: the queue, credits, consent and the unsubscribe link work as before.
- The platform admin sees no provider balance, because TNET has no balance endpoint.
- The sender.ge adapter stays as a backup.
- **To ask TNET before go-live:**
  - whether promotions may go through `/sms/messages`
  - sender titles per business
  - prices
  - registering the callback address and getting the signing secret
  - a test account
- Tests: `providers/tnet.test.ts` (26) and `api/webhooks/sms/tnet/route.test.ts` (5). They never call TNET.
