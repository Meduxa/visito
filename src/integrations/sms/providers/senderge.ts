import type { SmsDeliveryStatus, SmsProvider, SmsSendInput, SmsSendResult } from "../types";

// sender.ge (decision 018). Three POST endpoints with form fields; the API key goes
// in the body, never in the address, and is never logged. Georgian mobiles only:
// the number is sent as 9 digits without +995.
// smsno=2 → informational (codes, confirmations, reminders);
// smsno=1 → promotional (sender.ge handles its own opt-out for these).

const BASE = "https://sender.ge/api";
const TIMEOUT_MS = 15_000;

type Fetch = typeof fetch;

/** +995555123456 → 555123456; anything that is not a Georgian mobile → null. */
export function senderGeDestination(e164: string): string | null {
  const m = e164.match(/^\+995(5\d{8})$/);
  return m ? m[1] : null;
}

const fail = (code: string, message: string, retryable: boolean): SmsSendResult => ({
  ok: false,
  error: { code, message, retryable },
});

export function senderGeProvider(apiKey: string, fetchImpl: Fetch = fetch): SmsProvider {
  const post = async (endpoint: string, fields: Record<string, string>) => {
    const body = new URLSearchParams({ apikey: apiKey, ...fields });
    const res = await fetchImpl(`${BASE}/${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: unknown; message?: string };
    return { status: res.status, json };
  };

  return {
    name: "senderge",

    async send(sms: SmsSendInput): Promise<SmsSendResult> {
      const destination = senderGeDestination(sms.to);
      if (!destination) return fail("destination", "only Georgian mobile numbers", false);
      let r: Awaited<ReturnType<typeof post>>;
      try {
        r = await post("send.php", {
          smsno: sms.kind === "marketing" ? "1" : "2",
          destination,
          content: sms.text,
        });
      } catch (e) {
        // The request may have reached sender.ge before the connection dropped, and
        // there is no way to look it up without its messageId: retrying could send
        // the SMS twice, so it is not retried. Refused connections are safe to retry.
        const name = e instanceof Error ? e.name : "";
        if (name === "TimeoutError" || name === "AbortError")
          return fail("timeout", "no answer in 15 s", false);
        return fail("network", "sender.ge not reachable", true);
      }
      const msg = (r.json.message ?? "").toLowerCase();
      if (r.status === 200) {
        const row = Array.isArray(r.json.data)
          ? (r.json.data[0] as { messageId?: string; qnt?: number })
          : undefined;
        if (!row?.messageId) return fail("bad_response", "no messageId", false);
        return { ok: true, providerRef: String(row.messageId), segments: Number(row.qnt) || undefined };
      }
      if (r.status === 401) return fail("invalid_key", "sender.ge refused the API key", false);
      if (r.status === 402) return fail("no_balance", "sender.ge balance is empty", false);
      if (r.status === 403 && msg.includes("subscription"))
        return fail("unsubscribed", "the number opted out", false);
      if (r.status === 403) return fail("destination", "sender.ge refused the number", false);
      if (r.status === 429) return fail("test_limit", "daily test limit reached", true);
      if (r.status >= 500) return fail("unavailable", "sender.ge temporarily unavailable", true);
      return fail(`http_${r.status}`, "unexpected answer from sender.ge", false);
    },

    async getStatus(ref: string): Promise<SmsDeliveryStatus> {
      try {
        const r = await post("callback.php", { messageId: ref });
        if (r.status !== 200 || !Array.isArray(r.json.data)) return "unknown";
        const id = Number((r.json.data[0] as { statusId?: number } | undefined)?.statusId);
        return id === 1 ? "delivered" : id === 2 ? "failed" : id === 0 ? "pending" : "unknown";
      } catch {
        return "unknown";
      }
    },

    async getBalance() {
      try {
        const r = await post("getBalance.php", {});
        const balance = (r.json.data as { balance?: string } | undefined)?.balance;
        if (r.status !== 200 || balance === undefined) return null;
        return { balanceMinor: Math.round(Number(balance) * 100) };
      } catch {
        return null;
      }
    },
  };
}
