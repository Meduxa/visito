import { describe, expect, it, vi } from "vitest";
import { senderGeDestination, senderGeProvider } from "./senderge";

// A pretend sender.ge: records the requests and answers with the given status and body.
function fakeApi(status: number, body: unknown) {
  const calls: { url: string; fields: Record<string, string> }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), fields: Object.fromEntries(new URLSearchParams(String(init?.body))) });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const sms = { to: "+995555123456", text: "გამარჯობა", kind: "service" as const, idempotencyKey: "k1" };

describe("senderGeDestination", () => {
  it("sends Georgian mobiles as 9 digits", () => {
    expect(senderGeDestination("+995555123456")).toBe("555123456");
    expect(senderGeDestination("+995322123456")).toBeNull(); // landline
    expect(senderGeDestination("+491701234567")).toBeNull(); // not Georgian
  });
});

describe("sender.ge send", () => {
  it("posts the key in the body (not the address), informational for service SMS", async () => {
    const api = fakeApi(200, { data: [{ messageId: "123KUx", statusId: 1, qnt: 2 }] });
    const r = await senderGeProvider("secret-key", api.impl).send(sms);
    expect(r).toEqual({ ok: true, providerRef: "123KUx", segments: 2 });
    expect(api.calls[0].url).toBe("https://sender.ge/api/send.php");
    expect(api.calls[0].url).not.toContain("secret-key");
    expect(api.calls[0].fields).toEqual({
      apikey: "secret-key",
      smsno: "2",
      destination: "555123456",
      content: "გამარჯობა",
    });
  });

  it("promotions go as promotional (smsno=1)", async () => {
    const api = fakeApi(200, { data: [{ messageId: "m2", statusId: 1, qnt: 1 }] });
    await senderGeProvider("k", api.impl).send({ ...sms, kind: "marketing" });
    expect(api.calls[0].fields.smsno).toBe("1");
  });

  it("never calls sender.ge for a number it cannot reach", async () => {
    const api = fakeApi(200, {});
    const r = await senderGeProvider("k", api.impl).send({ ...sms, to: "+491701234567" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ code: "destination", retryable: false });
    expect(api.calls).toHaveLength(0);
  });

  it.each([
    [401, { message: "invalid apikey" }, "invalid_key", false],
    [402, { message: "overdraft" }, "no_balance", false],
    [403, { message: "destination incorrect" }, "destination", false],
    [403, { message: "sms subscription has been canceled" }, "unsubscribed", false],
    [429, { message: "daily test limit reached (50 segments)" }, "test_limit", true],
    [503, { message: "Service Unavailable" }, "unavailable", true],
  ])("HTTP %i → %s", async (status, body, code, retryable) => {
    const r = await senderGeProvider("k", fakeApi(status, body).impl).send(sms);
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ code, retryable });
  });

  it("a timeout is not retried (the SMS may already be on its way)", async () => {
    const timeout = vi.fn(async () => {
      throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    }) as unknown as typeof fetch;
    const r = await senderGeProvider("k", timeout).send(sms);
    expect(r.error).toMatchObject({ code: "timeout", retryable: false });
  });

  it("a refused connection is retried", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const r = await senderGeProvider("k", down).send(sms);
    expect(r.error).toMatchObject({ code: "network", retryable: true });
  });
});

describe("sender.ge delivery status and balance", () => {
  it.each([
    [0, "pending"],
    [1, "delivered"],
    [2, "failed"],
  ] as const)("statusId %i → %s", async (statusId, expected) => {
    const api = fakeApi(200, {
      data: [{ destination: "555123456", statusId, timestamp: "2026-11-01 12:00:00" }],
    });
    expect(await senderGeProvider("k", api.impl).getStatus!("m1")).toBe(expected);
    expect(api.calls[0].url).toBe("https://sender.ge/api/callback.php");
    expect(api.calls[0].fields).toEqual({ apikey: "k", messageId: "m1" });
  });

  it("an unknown message is 'unknown', not failed", async () => {
    const api = fakeApi(403, { message: "no record found" });
    expect(await senderGeProvider("k", api.impl).getStatus!("m1")).toBe("unknown");
  });

  it("balance in tetri", async () => {
    const api = fakeApi(200, { data: { balance: "123.45", overdraft: "0.00" } });
    expect(await senderGeProvider("k", api.impl).getBalance!()).toEqual({ balanceMinor: 12345 });
    expect(
      await senderGeProvider("k", fakeApi(404, { message: "user not found" }).impl).getBalance!(),
    ).toBeNull();
  });
});
