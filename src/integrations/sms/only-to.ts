import type { SmsProvider } from "./types";

// Test mode (decision 038): while Visito is tested with a real SMS company, only
// the listed numbers get real SMS. Any other number is refused before the
// provider is called: the log shows "test mode", credits come back, and nothing
// is retried. Empty list = no limit (normal operation).

/** "+995591000000, +995592000000" → a set of E.164 numbers. Invalid entries are ignored. */
export function parseOnlyTo(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((s) => s.replace(/[\s()-]/g, ""))
      .filter((s) => /^\+[1-9]\d{7,14}$/.test(s)),
  );
}

export function onlyTo(provider: SmsProvider, allowed: Set<string>): SmsProvider {
  // the fake provider never sends a real SMS: nothing to protect (keeps tests and demos working)
  if (!allowed.size || provider.name === "fake") return provider;
  return {
    ...provider,
    name: provider.name,
    async send(sms) {
      if (!allowed.has(sms.to.trim()))
        return {
          ok: false,
          error: { code: "test_mode", message: "test mode: number not on the list", retryable: false },
        };
      return provider.send(sms);
    },
  };
}
