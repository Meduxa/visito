# 033 — Pilot: automatic SMS only, texts by Visito

**Context.** Levan signed with TNET (decision 027). For the pilot (November–December 2026) only automatic SMS go out: booking confirmation, request received, moved, cancelled, the 24 h / 2 h reminders and the review request. No marketing SMS, and businesses do not write SMS themselves (Levan, 2026-11-13).

**Decision.**
- One switch, `SMS_SALON_TOOLS` in `src/lib/pilot.ts`, is **off**. While off:
  - **hidden:** the business's sender name, the SMS text editor and the test SMS (Settings → SMS); SMS to one client and to a group (Clients); offering a waitlist time by SMS; the marketing-consent tick boxes on the booking page and the client card, consent pills and history.
  - **kept:** the on/off switch for each automatic SMS, quiet hours, balance and the SMS log. Also kept: the review-request switch in Settings → Reviews (Levan's choice).
  - The server refuses those actions too (`notAllowed`), and ignores marketing consent sent from the booking page. All SMS use Visito's default sender name (`TNET_SENDER`).
- **Texts:** the Visito team edits them in `/admin/sms-texts` (new table `sms_platform_templates`, platform admins only), per message and language. Text order: the business's own text (only when the switch is on) → Visito's text → the built-in default in `messages/*.json` (`texts.ts`).
- Nothing is deleted: businesses' old sender names, texts and consents stay in the database.

**Texts (Levan, 2026-11-13):** short ready texts like competitors' — date and time only, no business name, a green heart 💚. Booking SMS carry no link; the review request keeps its link. Settings → SMS shows each automatic SMS's text beside its switch (review request included).

**Consequences.** Turning the switch on brings every tool back at once. Tests for the hidden tools are skipped while it is off; `rls_platform_sms_texts.test.ts` and the "pilot" e2e test cover the new state. Landing-page wording about marketing SMS is unchanged.
