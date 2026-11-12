import { createHash, timingSafeEqual } from "node:crypto";
import type { CheckoutInput, PaymentEvent, PaymentProvider, PaymentStatus } from "../types";

// Flitt (TBC Group) hosted checkout — decision 031. Rules taken from Flitt's docs
// (docs.flitt.com: create order, signature, subscriptions, callbacks, testing)
// and its official Node SDK (github.com/flittpayments/node-js-sdk, lib/util.js):
//
// - Protocol 1.0 (one-time payments, status, subscription stop): the body is
//   {"request": {...params, signature}}; signature = sha1(secret | values of all
//   non-empty params sorted by name, joined with "|"), lower-case hex.
// - Protocol 2.0 (subscriptions: nested recurring_data): {"request": {version:"2.0",
//   data: base64(JSON {order: params}), signature: sha1(secret | data)}}; the answer
//   comes back the same way.
// - Callbacks arrive in either form and are verified the same way before use.
// Card data never reaches Visito: the payer types it on Flitt's own page.

const BASE = "https://pay.flitt.com/api";
const TIMEOUT_MS = 20_000;
type Fetch = typeof fetch;

const sha1 = (s: string) => createHash("sha1").update(s, "utf8").digest("hex");
const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Protocol 1.0 signature over flat params (signature fields excluded, empty values skipped). */
export function flittSignature(params: Record<string, unknown>, secret: string): string {
  const values = Object.keys(params)
    .sort()
    .filter((k) => k !== "signature" && k !== "response_signature_string")
    .map((k) => params[k])
    .filter((v) => v !== "" && v !== null && v !== undefined)
    .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)));
  return sha1([secret, ...values].join("|"));
}

/** Protocol 2.0 signature over the base64 data. */
export const flittSignatureV2 = (data: string, secret: string) => sha1(`${secret}|${data}`);

const STATUSES: PaymentStatus[] = ["created", "processing", "approved", "declined", "expired", "reversed"];

function toEvent(o: Record<string, unknown>): PaymentEvent | null {
  const orderId = typeof o.order_id === "string" ? o.order_id : null;
  if (!orderId) return null;
  const status = String(o.order_status ?? "");
  const amount = Number(o.amount); // the amount Visito asked for (actual_amount is 0 until paid)
  return {
    orderId,
    status: (STATUSES as string[]).includes(status) ? (status as PaymentStatus) : null,
    amountMinor: Number.isFinite(amount) && String(o.amount ?? "") !== "" ? Math.round(amount) : null,
    paymentId:
      o.payment_id === undefined || o.payment_id === null || o.payment_id === ""
        ? null
        : String(o.payment_id),
    maskedCard: typeof o.masked_card === "string" && o.masked_card ? o.masked_card.slice(0, 30) : null,
    parentOrderId: typeof o.parent_order_id === "string" && o.parent_order_id ? o.parent_order_id : null,
  };
}

/** Reads a notice or answer in either protocol, after checking its signature. */
export function verifyFlitt(
  body: Record<string, unknown>,
  secret: string,
  merchantId: string,
): Record<string, unknown> | null {
  const sig = typeof body.signature === "string" ? body.signature.toLowerCase() : "";
  if (!/^[0-9a-f]{40}$/.test(sig)) return null;
  if (body.version === "2.0" && typeof body.data === "string") {
    if (!same(flittSignatureV2(body.data, secret), sig)) return null;
    try {
      const decoded = JSON.parse(Buffer.from(body.data, "base64").toString("utf8")) as {
        order?: Record<string, unknown>;
      };
      const o = decoded.order ?? null;
      if (!o || (o.merchant_id !== undefined && String(o.merchant_id) !== merchantId)) return null;
      return o;
    } catch {
      return null;
    }
  }
  if (String(body.merchant_id ?? "") !== merchantId) return null;
  return same(flittSignature(body, secret), sig) ? body : null;
}

export function flittProvider(
  cfg: { merchantId: string; secretKey: string },
  fetchImpl: Fetch = fetch,
): PaymentProvider {
  const merchant = Number(cfg.merchantId);

  const post = async (path: string, request: Record<string, unknown>) => {
    const res = await fetchImpl(`${BASE}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8", accept: "application/json" },
      body: JSON.stringify({ request }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error",
    });
    const json = (await res.json().catch(() => ({}))) as { response?: Record<string, unknown> };
    return json.response ?? {};
  };

  const v1 = (params: Record<string, unknown>) => {
    const p = { ...params, merchant_id: merchant };
    return { ...p, signature: flittSignature(p, cfg.secretKey) };
  };

  return {
    name: "flitt",

    async createCheckout(input: CheckoutInput) {
      const order: Record<string, unknown> = {
        order_id: input.orderId,
        order_desc: input.description.slice(0, 1024),
        amount: input.amountMinor,
        currency: "GEL",
        merchant_id: merchant,
        response_url: input.returnUrl,
        server_callback_url: input.callbackUrl,
        ...(input.lang && input.lang !== "ka" && { lang: input.lang }),
      };
      try {
        let response: Record<string, unknown>;
        if (input.monthly) {
          // protocol 2.0: the nested recurring_data cannot be signed the 1.0 way
          order.subscription = "Y";
          order.recurring_data = {
            amount: input.amountMinor,
            every: 1,
            period: "month",
            quantity: 120, // up to 10 years; the owner can stop it any time
            state: "shown_readonly",
            readonly: "y",
          };
          const data = Buffer.from(JSON.stringify({ order })).toString("base64");
          const r = await post("checkout/url/", {
            version: "2.0",
            data,
            signature: flittSignatureV2(data, cfg.secretKey),
          });
          response =
            typeof r.data === "string"
              ? ((
                  JSON.parse(Buffer.from(r.data, "base64").toString("utf8")) as {
                    order?: Record<string, unknown>;
                  }
                ).order ?? r)
              : r;
        } else {
          response = await post("checkout/url/", v1(order));
        }
        // protocol 2.0 answers carry only {checkout_url, payment_id}, without response_status
        const url = typeof response.checkout_url === "string" ? response.checkout_url : null;
        if (
          !response.error_code &&
          response.response_status !== "failure" &&
          url?.startsWith("https://pay.flitt.com/")
        )
          return { ok: true as const, url };
        return { ok: false as const, error: String(response.error_code ?? "failure") };
      } catch {
        return { ok: false as const, error: "unreachable" };
      }
    },

    async getStatus(orderId: string) {
      try {
        const r = await post("status/order_id/", v1({ order_id: orderId }));
        if (r.response_status !== "success") return null;
        const verified = verifyFlitt(r, cfg.secretKey, cfg.merchantId);
        return verified ? toEvent(verified) : null;
      } catch {
        return null;
      }
    },

    async stopSubscription(orderId: string) {
      try {
        const r = await post("subscription/", v1({ order_id: orderId, action: "stop" }));
        return r.response_status === "success" && (r.status === "disabled" || r.status === undefined);
      } catch {
        return false;
      }
    },

    parseCallback(rawBody: string) {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return null;
      }
      // the 2.0 envelope may sit under "response" or at the top level
      const inner = (body.response as Record<string, unknown> | undefined) ?? body;
      const verified = verifyFlitt(inner, cfg.secretKey, cfg.merchantId);
      return verified ? toEvent(verified) : null;
    },
  };
}
