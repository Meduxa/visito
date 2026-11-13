# TNET SMS API: analysis and how Visito uses it (2026-11-12)

The source is TNET's "SMS API: Integration reference" (23 pages; Levan's copy is in `Visito workspace\Sms TNET\SMS API Guide.pdf`). Decision 027 records the choices.

## 1. What the API offers

| Area | Endpoint | Token | Use in Visito |
|---|---|---|---|
| Login, client token | `POST /sms/login` | none | **Yes.** The token lives `expires_in` s (300). It is kept in memory and renewed 30 s early. |
| Login, company token | `POST /login` | none | Not yet (campaigns and imports only). |
| One SMS | `POST /sms/messages` | client | **Yes. Every SMS goes here:** codes, confirmations, reminders, manual SMS, promotions. |
| Bulk promotion | `POST /sms/bulk` | client | Not now (see §4, consent). |
| Contact import | `POST /contacts/import` | company | No. It would re-subscribe people who opted out. |
| Senders list | `GET /senders` | company | Later, to check a business's sender name. |
| Campaigns (estimate, create, details, statistics) | `/campaigns…` | company | Not now. A possible step 2 for large promotions. |
| Message status | `GET /sms/{message_id}/status` | client | **Yes:** a backup check for messages still waiting. |
| Delivery reports | POST to our HTTPS address | HMAC signature | **Yes:** `/api/webhooks/sms/tnet`. |

## 2. Important rules from the guide, and what Visito does

| Rule in the guide | Visito |
|---|---|
| `client_id`, `secret_hash` and `base_url` come from TNET; secrets stay out of logs and code | Server-only environment values `TNET_*`; nothing is logged; requests don't follow redirects. |
| Login: 5 a minute; no refresh token; 429 means wait | One token per server instance, shared by all sends at once; a 429 is retried later by the SMS queue. |
| The sender title must match exactly, case included; an unknown title → 400 | The default comes from `TNET_SENDER`; a business's own name is used only once Visito's admin approved it (that means it was registered at TNET). A 400 shows "sender name not registered" in the log. |
| Phone: 9–15 digits, no "+" | `+995555123456` → `995555123456`. International numbers are allowed (coverage depends on the account). |
| Text: plain JSON, not URL-encoded | Sent as is. |
| `priority` 0/1 | Service SMS 1 (codes and reminders first), promotions 0. |
| **Idempotency-Key** (a UUID, 5 minutes): a repeat answers 409 and does not send again | The key = our message's ID (`sms_messages.id`), always lower-case. A timeout or 5xx is retried **once, right away, with the same key**, inside the 5 minutes. |
| 409 does not say whether the first attempt was accepted; after 5 minutes the same key sends again | If still uncertain: the message is marked **"uncertain", not sent again** (credits returned). The queue's own retry comes after 2+ minutes and could fall outside the guard, so a double SMS is possible there. As with sender.ge: a missing SMS is better than a double one. |
| 401 happens before the key is reserved, so a retry is allowed | Log in again, one more try with the same key. |
| Success = queued, not delivered | The message is "sent"; "delivered" comes only from a delivery report. |
| Reports: HMAC-SHA256 over `timestamp.rawBody`, header `v1=…`, 300 s window, constant-time compare, separate secret, no unsigned fallback | Exactly that (`verifyTnetWebhook`). The raw body is checked before parsing; failure → 401, nothing changes. |
| Reports may repeat or come out of order | Only a "sent" message changes. A repeated or late report cannot change it twice or overwrite "delivered". |
| Answer 2xx only after storing | 200 after the database update; a database error → 500, so TNET sends it again. |
| `DELIVRD` = delivered; keep other codes | `UNDELIV`, `EXPIRED`, `REJECTD`, `DELETED` → "not delivered (CODE)" in the log. Intermediate codes are acknowledged and ignored. |
| Status endpoint reads stored state, 404 for unknown | Backup check in the SMS job for messages sent 1 min – 24 h ago. 404 = unknown, the message stays "sent". |
| Segments: GSM 160/153, Unicode 70/67 (Georgian is Unicode) | Our counter already uses exactly these numbers. |
| No balance endpoint | The platform admin page shows "balance not available" for TNET. |

## 3. What changed in the code

- `src/integrations/sms/providers/tnet.ts`: the adapter (login and token reuse, send, status, signature check, report parsing). It has 26 tests with a pretend TNET.
- `src/app/api/webhooks/sms/tnet/route.ts`: delivery reports, with 5 tests.
- `src/integrations/sms/index.ts` and `src/lib/server-env.ts`: `SMS_PROVIDER=tnet` plus `TNET_BASE_URL`, `TNET_CLIENT_ID`, `TNET_SECRET_HASH`, `TNET_SENDER` and `TNET_WEBHOOK_SECRET`.
- The message log has plain-language error labels in ka/en/ru.
- `.env.example` and `docs/go-live.md` are updated.
- The sender.ge adapter stays as a backup (`SMS_PROVIDER=senderge`). Nothing else in the app changed: the queue, credits, consent, quiet hours, templates and the unsubscribe link work as before.

## 4. Open questions for TNET (before switching on)

1. **Promotions.** The guide says the single endpoint is for transactional SMS and promotions should go through bulk or campaigns. But bulk sends only to people with consent stored **in TNET's contact list**. Visito keeps consent itself (who, when, how) and adds its own unsubscribe link.
   - May Visito send promotions one by one through `/sms/messages` with `priority: 0`?
   - If not, Visito would use a campaign with `numbers_import`, where consent is our responsibility. That is a larger change: one campaign per promotion, and the results come back per campaign.
2. **One sender title per business.** Can each salon have its own sender title under Visito's single client, or does every title need registering? How long does registration take, and what does it cost?
3. **Prices.** The price per segment for Georgian Unicode, and any volume discounts.
4. **Callback.** Register `https://visito.ge/api/webhooks/sms/tnet` and send the 64-character signing secret through a secure channel.
5. **Token lifetime.** Is `expires_in` always 300 s? Netlify runs several server instances, and each logs in for itself, which is fine at 5 logins a minute.
6. **Test account.** A sandbox or test sender, so Visito can be tried before going live.

## 5. Switching on (after TNET's answers)

1. Get the `TNET_*` values from TNET onboarding.
2. Put them on Netlify as secrets, then set `SMS_PROVIDER=tnet`.
3. Send a test SMS from Settings → SMS, then check the log: "sent", then "delivered" once the report arrives.
4. Send one test with a wrong sender title. The log should say "sender name not registered".
