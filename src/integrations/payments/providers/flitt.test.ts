import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { flittProvider, flittSignature, flittSignatureV2, verifyFlitt } from "./flitt";

// Flitt's own public test merchant (docs.flitt.com/api/testing): 1549901 / "test".
const cfg = { merchantId: "1549901", secretKey: "test" };

function fakeFlitt(response: unknown) {
  const calls: { url: string; body: { request: Record<string, unknown> } }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ response }), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("Flitt signature", () => {
  // The docs' worked example builds the string
  // "test|1000|GEL|1549901|Test payment|TestOrder2|http://myshop/callback/" — its SHA-1 is
  // cd0edb71…; the signature printed next to it (91ea7da4…) does not match its own
  // string, so we check against the documented string (same rule as the official SDK).
  it("builds exactly the string of Flitt's worked example", () => {
    expect(
      flittSignature(
        {
          server_callback_url: "http://myshop/callback/",
          order_id: "TestOrder2",
          currency: "GEL",
          merchant_id: 1549901,
          order_desc: "Test payment",
          amount: 1000,
        },
        "test",
      ),
    ).toBe(
      createHash("sha1")
        .update("test|1000|GEL|1549901|Test payment|TestOrder2|http://myshop/callback/")
        .digest("hex"),
    );
  });

  it("skips empty values and the signature fields; keeps 0", () => {
    const a = flittSignature({ b: "x", a: "", c: 0, signature: "zz", response_signature_string: "yy" }, "k");
    const b = flittSignature({ b: "x", c: 0 }, "k");
    expect(a).toBe(b);
  });
});

describe("Flitt checkout", () => {
  it("one-time payment: protocol 1.0, signed, returns the hosted page", async () => {
    const api = fakeFlitt({
      response_status: "success",
      checkout_url: "https://pay.flitt.com/merchants/x/default/index.html?token=t",
    });
    const r = await flittProvider(cfg, api.impl).createCheckout({
      orderId: "0f5e9b3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      amountMinor: 3500,
      description: "Visito: 1000 SMS",
      returnUrl: "https://visito.ge/api/billing/return",
      callbackUrl: "https://visito.ge/api/webhooks/flitt",
      lang: "en",
    });
    expect(r).toEqual({ ok: true, url: "https://pay.flitt.com/merchants/x/default/index.html?token=t" });
    expect(api.calls[0].url).toBe("https://pay.flitt.com/api/checkout/url/");
    const req = api.calls[0].body.request;
    expect(req).toMatchObject({ amount: 3500, currency: "GEL", merchant_id: 1549901, lang: "en" });
    expect(req.signature).toBe(flittSignature(req, "test"));
  });

  it("monthly plan: protocol 2.0 with recurring_data, signed over the base64 data", async () => {
    const order = { checkout_url: "https://pay.flitt.com/x", payment_id: "1" }; // as Flitt answers 2.0 (no response_status)
    const data = Buffer.from(JSON.stringify({ order })).toString("base64");
    const api = fakeFlitt({ version: "2.0", data, signature: flittSignatureV2(data, "test") });
    const r = await flittProvider(cfg, api.impl).createCheckout({
      orderId: "o1",
      amountMinor: 8900,
      description: "Visito Standard",
      returnUrl: "https://visito.ge/r",
      callbackUrl: "https://visito.ge/c",
      monthly: true,
    });
    expect(r).toEqual({ ok: true, url: "https://pay.flitt.com/x" });
    const req = api.calls[0].body.request as { version: string; data: string; signature: string };
    expect(req.version).toBe("2.0");
    expect(req.signature).toBe(flittSignatureV2(req.data, "test"));
    const sent = JSON.parse(Buffer.from(req.data, "base64").toString()).order;
    expect(sent).toMatchObject({
      order_id: "o1",
      amount: 8900,
      subscription: "Y",
      recurring_data: { amount: 8900, every: 1, period: "month" },
    });
    expect(sent.lang).toBeUndefined(); // Georgian is Flitt's default page
  });

  it("a failure answer is not a payment page", async () => {
    const api = fakeFlitt({ response_status: "failure", error_code: 1008, error_message: "x" });
    const r = await flittProvider(cfg, api.impl).createCheckout({
      orderId: "o",
      amountMinor: 1,
      description: "d",
      returnUrl: "https://a",
      callbackUrl: "https://b",
    });
    expect(r).toEqual({ ok: false, error: "1008" });
  });
});

describe("Flitt callbacks", () => {
  const approved = {
    order_id: "0f5e9b3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
    merchant_id: 1549901,
    amount: "3500",
    actual_amount: "3500",
    currency: "GEL",
    order_status: "approved",
    response_status: "success",
    payment_id: 805243692,
    masked_card: "444455XXXXXX1111",
    parent_order_id: "",
    rectoken: "",
  };
  const sign = (o: Record<string, unknown>) => ({ ...o, signature: flittSignature(o, "test") });

  it("reads a correctly signed protocol 1.0 notice", () => {
    const e = flittProvider(cfg).parseCallback(JSON.stringify(sign(approved)));
    expect(e).toEqual({
      orderId: approved.order_id,
      status: "approved",
      amountMinor: 3500,
      paymentId: "805243692",
      maskedCard: "444455XXXXXX1111",
      parentOrderId: null,
    });
  });

  it("reads a protocol 2.0 notice (monthly charge with its parent order)", () => {
    const order = { ...approved, order_id: "flitt-2", parent_order_id: approved.order_id };
    const data = Buffer.from(JSON.stringify({ order })).toString("base64");
    const e = flittProvider(cfg).parseCallback(
      JSON.stringify({ version: "2.0", data, signature: flittSignatureV2(data, "test") }),
    );
    expect(e).toMatchObject({ orderId: "flitt-2", parentOrderId: approved.order_id, status: "approved" });
  });

  it("refuses a changed amount, a wrong secret, another merchant, or no signature", () => {
    const p = flittProvider(cfg);
    const good = sign(approved);
    expect(p.parseCallback(JSON.stringify({ ...good, amount: "1" }))).toBeNull();
    expect(
      p.parseCallback(JSON.stringify({ ...approved, signature: flittSignature(approved, "other") })),
    ).toBeNull();
    expect(p.parseCallback(JSON.stringify(sign({ ...approved, merchant_id: 999 })))).toBeNull();
    expect(p.parseCallback(JSON.stringify(approved))).toBeNull();
    expect(p.parseCallback("not json")).toBeNull();
    expect(
      verifyFlitt({ version: "2.0", data: "e30=", signature: "0".repeat(40) }, "test", "1549901"),
    ).toBeNull();
  });

  it("an unknown status is kept as null (nothing is granted)", () => {
    const e = flittProvider(cfg).parseCallback(JSON.stringify(sign({ ...approved, order_status: "weird" })));
    expect(e?.status).toBeNull();
  });
});
