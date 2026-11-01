# 018 — sender.ge is the SMS company

**Context.** Levan registered at sender.ge (2026-11-01). Decision 008 left one adapter to write.

**Decision.**
- Adapter `src/integrations/sms/providers/senderge.ts`, switched on with `SMS_PROVIDER=senderge` + `SMS_API_KEY` (server only; Netlify secret). POST form fields to `https://sender.ge/api/{send,callback,getBalance}.php`; the key travels in the body, never in the address or logs; 15 s timeout.
- Service SMS (codes, confirmations, reminders, notes to one client) go as **informational** (`smsno=2`); promotions as **promotional** (`smsno=1`). Georgian mobiles only (`+9955…` → 9 digits); other numbers fail without calling sender.ge.
- Errors: wrong key, empty balance, refused number, opted out → not retried; daily test limit, 503, refused connection → retried by the queue; **timeout → not retried** (the SMS may already be on its way and cannot be looked up without its id — a missing SMS is better than a double one).
- No delivery callback: the SMS job asks `callback.php` for messages sent 1 min – 24 h ago (statusId 0 waiting, 1 delivered, 2 undelivered). The send answer's `statusId: 1` is not trusted as "delivered".
- The platform admin's SMS page shows Bookeria's sender.ge balance.

**Prices** (sender.ge/tariffs, VAT incl., per SMS by monthly volume): 2.5 tetri up to 1,999; 2 up to 4,999; 1.5 up to 9,999; 1 up to 29,999; lower above. Test accounts: 50 segments a day.

**Open (ask sender.ge).** Sender name "Bookeria" (Brand Names is locked in the panel — registration, time, price); whether each business can have its own sender name (the API has no sender field, so today all SMS go out under the account's name and the business name is in the text); what sender.ge adds to promotional SMS (we already add our unsubscribe link); characters per Georgian SMS part.

**Consequence.** Real SMS need only the two settings. Dev and tests keep the fake provider; e2e never calls sender.ge.
