# 038 — SMS test mode: real SMS only to listed numbers

**Context.** Levan wants to test the whole app with real TNET SMS to his own phone before launch (2026-11-19). The database also holds demo businesses whose clients have made-up or other people's numbers, and 41 old queued SMS. Switching `SMS_PROVIDER=tnet` alone would text all of them.

**Decision.** New server setting `SMS_ONLY_TO` (comma-separated E.164). When it is set, `getSmsProvider()` wraps the real provider (`src/integrations/sms/only-to.ts`): a listed number is sent normally; any other number is refused before the provider is called, with error `test_mode` (not retried, credits returned, shown in the SMS log as "test mode — this number is not on the test list"). Empty = no limit.

**Consequences.** Safe to switch on TNET on visito.ge or the laptop during testing. Online booking with an unlisted phone cannot receive its SMS code, so test online bookings use a listed number. **At real launch `SMS_ONLY_TO` must be emptied** (`docs/go-live.md`). Tests: `src/integrations/sms/only-to.test.ts`.

**Added (Levan, 2026-11-25): demo and test businesses never send real SMS.** Levan dropped the "only my number" approach. Instead `src/features/sms/sandbox.ts`: a business whose owners all sign in with a reserved test address (`…@demo.test`, `…@example.test`, `example.com`) — the demo salons and every business the automatic tests create — never reaches the real provider; the SMS is logged as "demo or test business — real SMS are never sent" (`demo_business`). Real businesses send normally, so `SMS_ONLY_TO` can stay empty. A test salon owned by a real address (e.g. Gmail) is a real business: its clients must have real numbers you control.
