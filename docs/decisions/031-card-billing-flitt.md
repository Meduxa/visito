# 031 — Owners pay Visito by card (Flitt), and buy SMS packs

**Context.** SPEC 4.13 planned "manual invoicing first, automatic recurring billing later through a Georgian gateway". Rezervo charges by card through Flitt (TBC Group). Levan chose Flitt (2026-11-12).

**Decision.**
- **The adapter** `src/integrations/payments` (Flitt) is switched on with `PAYMENTS_PROVIDER=flitt`, `FLITT_MERCHANT_ID` and `FLITT_SECRET_KEY`. These are Visito's own merchant account; the money goes to Visito.
- **Flitt's rules** come from its docs and official Node SDK:
  - **Hosted card page** (`/api/checkout/url`): Visito never sees card data.
  - **Protocol 1.0** (one-time payments, status, stopping a subscription): signed with SHA-1 over the secret plus the non-empty values sorted by name, joined with "|".
  - **Protocol 2.0** (subscriptions, with nested `recurring_data`): base64 data, signed with SHA-1 over the secret plus the data.
  - **Notices** arrive in either protocol and are verified before use. A wrong signature, merchant or amount is refused.
  - Flitt's documented example signature does not match its own example string; we follow the documented rule and the SDK.
- **Plans:** a monthly subscription (`subscription: "Y"`, every 1 month).
  - Each approved charge extends `tenants.paid_until` by a month and sets the plan and status "active".
  - Monthly charges arrive as new orders with `parent_order_id` and are stored under the first payment.
  - The owner can turn automatic payment off (Flitt `subscription stop`); the plan then runs to `paid_until`.
  - The daily job makes a card-paid plan "payment due" 3 days after `paid_until` (`expire_paid_periods`).
- **SMS packs** (`sms_packs`) are one-time purchases. Visito's admin sets them in `/admin/plans`; the starting prices are placeholders: 500 for 20 ₾, 1,000 for 35 ₾, 3,000 for 90 ₾. A paid pack adds SMS credits.
- **Safety:**
  - `billing_start` is owner only and reads the price from the database, never from the browser.
  - `billing_apply` is service role only and grants once, on the first "approved" with the expected amount; anything else becomes "mismatch".
  - The browser's return (`/api/billing/return`) only triggers a signed server-to-server status check.
  - Payments are visible to the owner and Visito's admin; card numbers are stored only masked, as Flitt sends them.

**Consequences.**
- Bank transfer still works: the platform admin sets the plan by hand.
- **Before go-live:**
  - Visito's own Flitt merchant account, with its keys on Netlify
  - Flitt enabling subscriptions for that merchant
  - real SMS pack prices
  - the terms of service: recurring charges, cancellation and refunds
- **Tests:**
  - `providers/flitt.test.ts`: signatures, both protocols, forged notices
  - `rls_rezervo_features.test.ts`: only the owner starts payments, a mismatch grants nothing, packs add SMS once, monthly charges extend the plan
  - `e2e/rezervo-features.spec.ts`: Flitt's real test card page, a signed notice

**Added (2026-11-14), for Flitt's merchant review:** a Payments and refunds page, company details and card marks in the footer (`src/lib/company.ts`), and an explicit tick box agreeing to the monthly charge before the card page opens (checked on the server, kept in the audit log).

**Changed (Levan, 2026-11-12): SMS packs are not offered yet.** Levan first wants to decide how marketing SMS will reach clients. The owner's page and `/admin/plans` show no packs, and `startPayment` accepts only plans. The database part stays (`sms_packs` with placeholder rows, `billing_start` / `billing_apply` support), because an applied migration is never edited. Switching packs on later is UI work only.
