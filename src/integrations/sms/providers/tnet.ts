import { createHmac, timingSafeEqual } from "node:crypto";
import type { SmsDeliveryStatus, SmsProvider, SmsSendInput, SmsSendResult } from "../types";

// TNET SMS API (decision 027, analysis docs/plans/tnet-sms.md).
//
// - Auth: POST /sms/login with client_id + secret_hash → a "client token" that
//   lives expires_in seconds (300 in the guide). Kept in memory and reused until
//   30 s before it expires; login is limited to 5 a minute, so concurrent sends
//   share one login. A definite 401 on a send → log in again and retry once (a
//   401 happens before TNET reserves the Idempotency-Key, so this cannot double-send).
// - Send: POST /sms/messages {phone, title, message, priority} with header
//   Idempotency-Key = our sms_messages.id (a UUID). TNET refuses a repeat of the
//   same key for 5 minutes (HTTP 409), so a retry after a timeout cannot send twice.
// - Uncertain outcome (timeout, lost connection, 5xx): retried once right away with
//   the same key — inside the 5-minute guard. If that is uncertain too, or TNET answers
//   409 (the first attempt was reserved, result unknown), the message is NOT retried
//   later: the queue's next try could fall outside the guard and send twice. As with
//   sender.ge (decision 018): a missing SMS is better than a double one.
// - Delivery: TNET calls our webhook (HMAC-signed, see verifyTnetWebhook); the SMS job
//   also asks GET /sms/{message_id}/status for messages still waiting.
// - Secrets never appear in addresses or logs; message text and phone numbers are not logged.

const TIMEOUT_MS = 15_000;
const DEVICE = "visito";

type Fetch = typeof fetch;

export type TnetConfig = {
  baseUrl: string; // supplied by TNET; paths are relative to it
  clientId: string;
  secretHash: string;
  /** default sender title, exactly as TNET configured it (case-sensitive) */
  sender: string;
};

/** E.164 (+995555123456) → TNET's 9–15 digits without + (995555123456). */
export function tnetPhone(e164: string): string | null {
  const m = e164.trim().match(/^\+([1-9]\d{8,14})$/);
  return m ? m[1] : null;
}

/** A network delivery code → our outcome. null = not final yet (keep waiting). */
export function tnetOutcome(code: string | null | undefined): "delivered" | "failed" | null {
  const c = (code ?? "").trim().toUpperCase();
  if (c === "DELIVRD" || c === "DELIVERED") return "delivered";
  if (["UNDELIV", "EXPIRED", "REJECTD", "REJECTED", "DELETED", "FAILED", "UNDELIVERED"].includes(c))
    return "failed";
  return null;
}

const fail = (code: string, message: string, retryable: boolean): SmsSendResult => ({
  ok: false,
  error: { code, message, retryable },
});

type Answer = { status: number; json: Record<string, unknown>; retryAfter: number | null };

export function tnetProvider(cfg: TnetConfig, fetchImpl: Fetch = fetch, now = () => Date.now()): SmsProvider {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  let token: { value: string; until: number } | null = null;
  let loggingIn: Promise<string> | null = null;

  const call = async (
    method: "GET" | "POST",
    path: string,
    opts: { body?: unknown; bearer?: string; headers?: Record<string, string> } = {},
  ): Promise<Answer> => {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        accept: "application/json",
        ...(opts.body !== undefined && { "content-type": "application/json" }),
        ...(opts.bearer && { authorization: `Bearer ${opts.bearer}` }),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error",
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const ra = Number(res.headers.get("retry-after"));
    return { status: res.status, json, retryAfter: Number.isFinite(ra) && ra > 0 ? ra : null };
  };

  class LoginError extends Error {
    constructor(
      public code: string,
      public retryable: boolean,
    ) {
      super(code);
    }
  }

  const login = async (): Promise<string> => {
    const r = await call("POST", "/sms/login", {
      body: { client_id: cfg.clientId, secret_hash: cfg.secretHash, device_name: DEVICE },
    });
    const data = r.json.data as { access_token?: string; expires_in?: number } | undefined;
    if ((r.status === 200 || r.status === 201) && data?.access_token) {
      const life = Math.max(60, Number(data.expires_in) || 300);
      token = { value: data.access_token, until: now() + (life - 30) * 1000 };
      return data.access_token;
    }
    if (r.status === 429) throw new LoginError("rate_limited", true);
    if (r.status === 401 || r.status === 403 || r.status === 422)
      throw new LoginError("invalid_credentials", false);
    if (r.status >= 500) throw new LoginError("unavailable", true);
    throw new LoginError(`login_http_${r.status}`, false);
  };

  /** A valid client token; concurrent callers share one login (5 logins a minute at most). */
  const clientToken = async (fresh = false): Promise<string> => {
    if (!fresh && token && token.until > now()) return token.value;
    if (fresh) token = null;
    loggingIn ??= login().finally(() => {
      loggingIn = null;
    });
    return loggingIn;
  };

  const isUncertain = (e: unknown) => {
    const name = e instanceof Error ? e.name : "";
    return name === "TimeoutError" || name === "AbortError" || name === "TypeError";
  };

  return {
    name: "tnet",

    async send(sms: SmsSendInput): Promise<SmsSendResult> {
      const phone = tnetPhone(sms.to);
      if (!phone) return fail("destination", "not a valid international number", false);
      const title = (sms.senderName ?? cfg.sender).trim();
      if (!title) return fail("sender", "no sender title configured", false);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sms.idempotencyKey))
        return fail("bad_key", "idempotency key must be a UUID", false);
      const key = sms.idempotencyKey.toLowerCase(); // one spelling: TNET treats case as different keys
      const body = { phone, title, message: sms.text, priority: sms.kind === "marketing" ? 0 : 1 };

      let bearer: string;
      try {
        bearer = await clientToken();
      } catch (e) {
        if (e instanceof LoginError) return fail(e.code, "TNET login failed", e.retryable);
        return fail("network", "TNET not reachable", true); // nothing was sent yet
      }

      const attempt = (b: string) =>
        call("POST", "/sms/messages", { body, bearer: b, headers: { "idempotency-key": key } });

      let r: Answer | null = null;
      let reloggedIn = false;
      for (let tries = 0; tries < 3; tries++) {
        try {
          r = await attempt(bearer);
        } catch (e) {
          if (!isUncertain(e)) return fail("exception", "TNET call failed", false);
          r = null; // may or may not have reached TNET: try once more with the same key
          if (tries >= 1)
            return fail("uncertain", "no answer from TNET; not retried to avoid a double SMS", false);
          continue;
        }
        if (r.status === 401 && !reloggedIn) {
          // definite rejection before the key is reserved: a new token, same key
          reloggedIn = true;
          try {
            bearer = await clientToken(true);
          } catch (e) {
            if (e instanceof LoginError) return fail(e.code, "TNET login failed", e.retryable);
            return fail("network", "TNET not reachable", true);
          }
          continue;
        }
        if (r.status >= 500 && tries === 0) continue; // outcome unknown: once more, same key
        break;
      }
      if (!r) return fail("uncertain", "no answer from TNET", false);

      const data = r.json.data as { sms_id?: number; message_id?: string } | undefined;
      if (r.status === 200 || r.status === 201) {
        if (!data?.message_id) return fail("bad_response", "no message_id in TNET's answer", false);
        return { ok: true, providerRef: String(data.message_id).toLowerCase() };
      }
      // 409: this key was already used — the first attempt reached TNET, its result is unknown
      if (r.status === 409) return fail("uncertain", "TNET already has this message key", false);
      if (r.status === 400) {
        const msg = String(r.json.statusMessage ?? "").toLowerCase();
        return msg.includes("sender")
          ? fail("sender", "sender title is not configured at TNET", false)
          : fail("rejected", "TNET rejected the message", false);
      }
      if (r.status === 401) return fail("invalid_token", "TNET refused the token", false);
      if (r.status === 403) return fail("not_permitted", "TNET account setup or permissions", false);
      if (r.status === 422) return fail("invalid", "TNET validation failed", false);
      if (r.status === 429) return fail("rate_limited", "TNET rate limit", true);
      if (r.status >= 500) return fail("uncertain", "TNET error; not retried to avoid a double SMS", false);
      return fail(`http_${r.status}`, "unexpected answer from TNET", false);
    },

    async getStatus(ref: string): Promise<SmsDeliveryStatus> {
      if (!/^[0-9a-f-]{36}$/i.test(ref)) return "unknown";
      try {
        let bearer = await clientToken();
        let r = await call("GET", `/sms/${encodeURIComponent(ref.toLowerCase())}/status`, { bearer });
        if (r.status === 401) {
          bearer = await clientToken(true);
          r = await call("GET", `/sms/${encodeURIComponent(ref.toLowerCase())}/status`, { bearer });
        }
        if (r.status !== 200) return "unknown";
        const d = r.json.data as { lifecycle_status?: string; delivery_status?: string | null } | undefined;
        const byCode = tnetOutcome(d?.delivery_status);
        if (byCode) return byCode;
        const life = (d?.lifecycle_status ?? "").toLowerCase();
        if (life === "delivered") return "delivered";
        if (life === "failed" || life === "cancelled") return "failed";
        return "pending";
      } catch {
        return "unknown";
      }
    },
    // TNET's API has no balance endpoint: the platform admin sees no provider balance.
  };
}

// ---------------------------------------------------------------------------
// Delivery callbacks
// ---------------------------------------------------------------------------

export type TnetCallback = {
  messageId: string;
  outcome: "delivered" | "failed" | null;
  code: string;
};

/**
 * TNET's webhook signature (guide §06): X-Webhook-Timestamp (Unix seconds) and
 * X-Webhook-Signature "v1=" + hex(HMAC-SHA256(secret, timestamp + "." + raw body)).
 * The secret is used literally as the key (not decoded). Timestamps more than
 * 300 s away are refused; the comparison is constant-time. Never falls back to unsigned.
 */
export function verifyTnetWebhook(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !timestamp || !signature) return false;
  if (!/^[0-9]{1,12}$/.test(timestamp) || !/^v1=[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) return false;
  const expected = `v1=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The callback body, after the signature was verified. null = not a message report we understand. */
export function parseTnetCallback(rawBody: string): TnetCallback | null {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return null;
  }
  const id = typeof j.message_id === "string" ? j.message_id.trim().toLowerCase() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return null;
  const code = typeof j.delivery_status === "string" ? j.delivery_status.trim() : "";
  return { messageId: id, outcome: tnetOutcome(code), code: code.slice(0, 40) };
}
