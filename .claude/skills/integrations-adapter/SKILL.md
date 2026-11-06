---
name: integrations-adapter
description: Use when adding or changing any third-party integration in Visito — SMS sending, OTP codes, reminder jobs, marketing email providers, payment gateways, webhooks, API keys. Defines the adapter pattern, secret handling, idempotency, consent rules and testing with fake providers.
---

# Integrations (SMS, email, payments)

Rule: **UI code never talks to a third-party API.** Everything goes through a server-side adapter with a common interface, so a provider can be swapped (e.g. one SMS company for another, one Georgian payment gateway for another) without touching the rest of the app.

## 1. Folder layout

```
src/integrations/
  sms/
    types.ts            # SmsProvider interface + result types
    index.ts            # getSmsProvider() → picks provider from env / tenant settings
    providers/fake.ts   # for dev + tests: stores messages in memory/DB, never sends
    providers/<name>.ts # real provider (e.g. smsoffice)
  email/  (same shape)
  payments/ (same shape)
```

## 2. Interfaces (starting point)

```ts
// sms/types.ts
export interface SmsSendInput {
  to: string;            // E.164, e.g. +9955XXXXXXXX
  sender: string;        // registered sender name of the tenant
  text: string;
  idempotencyKey: string;
}
export interface SmsSendResult {
  ok: boolean;
  providerRef?: string;
  segments: number;
  error?: { code: string; message: string; retryable: boolean };
}
export interface SmsProvider {
  name: string;
  send(input: SmsSendInput): Promise<SmsSendResult>;
  getBalance?(): Promise<number>;
  getStatus?(providerRef: string): Promise<'queued' | 'sent' | 'delivered' | 'failed'>;
}

// email/types.ts
export interface EmailProvider {
  name: string;
  upsertContact(c: { email: string; firstName?: string; tags?: string[]; consent: boolean }): Promise<void>;
  removeContact(email: string): Promise<void>;
  sendCampaign(c: { subject: string; html: string; recipients: string[]; scheduledAt?: Date }): Promise<{ providerCampaignId: string }>;
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string): EmailEvent[];  // delivered, opened, clicked, unsubscribed, bounced
}

// payments/types.ts
export interface PaymentProvider {
  name: string;
  createPayment(p: { tenantId: string; bookingId: string; amountMinor: number; currency: 'GEL'; description: string; returnUrl: string; idempotencyKey: string }): Promise<{ paymentUrl: string; providerRef: string }>;
  refund(p: { providerRef: string; amountMinor: number; idempotencyKey: string }): Promise<{ ok: boolean }>;
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string): PaymentEvent;
}
```

Adapt the interface to the real provider's documentation, but keep the rest of the app depending only on the interface.

## 3. Secrets

- Keys only in env variables / Supabase secrets (`.env.example` lists names, never values).
- Per-tenant credentials (e.g. a salon's own payment merchant account) are stored **encrypted** (Supabase Vault or pgsodium), never in plain `jsonb`, never returned to the browser — the settings UI shows only "connected ✓" and the last 4 characters.
- Some providers put the API key in the URL query string (e.g. SMS HTTP APIs). Then: call only from the server, use **HTTPS**, and **never log the full URL**.

## 4. Sending SMS — the pipeline

1. App code calls `queueMessage({ tenantId, clientId, bookingId, type, locale, vars })`.
2. It renders the template, normalises the phone to E.164, counts segments (Georgian = Unicode/UCS-2: 70 chars single, 67 per part when split; Latin GSM-7: 160 / 153), checks **consent** for marketing types, checks **credits**, and inserts a row in `messages` with a unique `idempotency_key` and status `queued`. If the key already exists → do nothing (never double-send).
3. A worker (Supabase Edge Function triggered by `pg_cron` every minute, or a queue) picks `queued` rows, calls `provider.send()`, stores `providerRef`, `segments`, cost, status `sent` or `failed`, and deducts credits in `sms_credits_ledger` in the same transaction.
4. Retries: only `retryable` errors, max 3 attempts with backoff; then `failed` with the error visible in the message log.
5. Delivery status: via provider webhook (verify signature / secret) or periodic `getStatus` polling.
6. Quiet hours and reminder rules: see the booking-engine skill.

Message types that are **service** (no marketing consent needed): booking confirmation, reminder, reschedule, cancellation, OTP, waitlist offer for a slot the client asked for. Types that are **marketing** (consent required + opt-out text): promotions, birthday greetings, win-back, newsletters.

## 5. OTP codes

- 6 digits, valid 5 minutes, max 5 attempts, max 3 sends per phone per hour and per IP.
- Store only a **hash** of the code.
- Generic error messages (don't reveal whether a phone exists as a client).

## 6. Email marketing rules

- Sync to the provider **only** clients with marketing email consent; remove contacts when consent is withdrawn or the client is deleted/anonymised.
- Every campaign includes an unsubscribe link; the provider's unsubscribe webhook updates `client_consents` immediately and writes `audit_log`.
- Store campaign stats from webhooks; never store email content of other providers' tracking beyond what we show.

## 7. Payments rules

- **Stripe does not currently support businesses registered in Georgia** — the first real provider will be a Georgian gateway (Bank of Georgia, TBC, Flitt or similar), chosen in Phase 8. Read its official documentation fully before coding.
- Each salon/clinic connects **its own merchant account**; money goes directly to them.
- Never trust the browser's "payment success" redirect. Mark a payment as paid **only** after a verified webhook or a server-side status check with the provider.
- Webhooks: verify signature, respond fast (200), process idempotently by `providerRef` + event id, log raw events (without card data) for reconciliation.
- Visito never sees or stores card numbers — use the provider's hosted payment page.

## 8. Testing

- The **fake** provider is the default in development and tests (`SMS_PROVIDER=fake`). It records messages so tests can assert on them.
- Unit tests: template rendering, segment counting (Georgian and Latin), phone normalisation, consent checks, idempotency (same key twice → one message), retry logic, webhook signature verification (valid / invalid / replayed).
- A manual "Send test SMS to my phone" button in settings for the owner, using real credits.
- Before switching a real provider on, write `docs/decisions/NNN-<provider>.md` with: pricing, sender-name registration steps, limits, error codes, webhook format.
