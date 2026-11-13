import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { parseTnetCallback, tnetOutcome, tnetPhone, tnetProvider, verifyTnetWebhook } from "./tnet";

// A pretend TNET: answers per path from a script and records every request.
type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | "timeout";
function fakeTnet(script: Record<string, Reply[]>) {
  const calls: { method: string; path: string; headers: Record<string, string>; body: unknown }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url));
    const path = u.pathname.replace(/^\/v1/, "");
    calls.push({
      method: init?.method ?? "GET",
      path,
      headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const key = Object.keys(script).find((k) =>
      k.endsWith("*") ? path.startsWith(k.slice(0, -1)) : path === k,
    );
    const reply = key ? (script[key].length > 1 ? script[key].shift()! : script[key][0]) : { status: 404 };
    if (reply === "timeout") {
      const e = new Error("timeout");
      e.name = "TimeoutError";
      throw e;
    }
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status, headers: reply.headers });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const cfg = {
  baseUrl: "https://sms.example.test/v1/",
  clientId: "cid-1",
  secretHash: "s3cret",
  sender: "Visito",
};
const KEY = "0F5E9B3A-1C2D-4E5F-8A9B-0C1D2E3F4A5B";
const sms = { to: "+995555123456", text: "გამარჯობა", kind: "service" as const, idempotencyKey: KEY };
const LOGIN_OK: Reply = { status: 201, body: { data: { access_token: "tok-1", expires_in: 300 } } };
const SENT: Reply = {
  status: 200,
  body: { data: { sms_id: 7, message_id: "A1B2C3D4-1234-4567-89AB-0123456789AB" } },
};

describe("helpers", () => {
  it("phone: E.164 → digits without +", () => {
    expect(tnetPhone("+995555123456")).toBe("995555123456");
    expect(tnetPhone("+491701234567")).toBe("491701234567");
    expect(tnetPhone("555123456")).toBeNull();
    expect(tnetPhone("+1234")).toBeNull();
  });
  it("delivery codes", () => {
    expect(tnetOutcome("DELIVRD")).toBe("delivered");
    expect(tnetOutcome("undeliv")).toBe("failed");
    expect(tnetOutcome("EXPIRED")).toBe("failed");
    expect(tnetOutcome("ACCEPTD")).toBeNull();
    expect(tnetOutcome(null)).toBeNull();
  });
});

describe("TNET send", () => {
  it("logs in once, sends JSON with the sender title and a lower-case Idempotency-Key", async () => {
    const api = fakeTnet({ "/sms/login": [LOGIN_OK], "/sms/messages": [SENT] });
    const p = tnetProvider(cfg, api.impl);
    const r = await p.send(sms);
    expect(r).toEqual({ ok: true, providerRef: "a1b2c3d4-1234-4567-89ab-0123456789ab" });
    expect(api.calls.map((c) => c.path)).toEqual(["/sms/login", "/sms/messages"]);
    expect(api.calls[0].body).toEqual({ client_id: "cid-1", secret_hash: "s3cret", device_name: "visito" });
    const send = api.calls[1];
    expect(send.headers.authorization).toBe("Bearer tok-1");
    expect(send.headers["idempotency-key"]).toBe(KEY.toLowerCase());
    expect(send.body).toEqual({ phone: "995555123456", title: "Visito", message: "გამარჯობა", priority: 1 });
    // secrets never in the address
    expect(api.calls.every((c) => !c.path.includes("s3cret"))).toBe(true);
  });

  it("reuses the token; logs in again only when it is about to expire", async () => {
    let t = 0;
    const api = fakeTnet({ "/sms/login": [LOGIN_OK], "/sms/messages": [SENT] });
    const p = tnetProvider(cfg, api.impl, () => t);
    await p.send(sms);
    t = 200_000;
    await p.send(sms);
    expect(api.calls.filter((c) => c.path === "/sms/login")).toHaveLength(1);
    t = 280_000; // 300 s life − 30 s margin passed
    await p.send(sms);
    expect(api.calls.filter((c) => c.path === "/sms/login")).toHaveLength(2);
  });

  it("concurrent sends share one login", async () => {
    const api = fakeTnet({ "/sms/login": [LOGIN_OK], "/sms/messages": [SENT] });
    const p = tnetProvider(cfg, api.impl);
    await Promise.all([p.send(sms), p.send(sms), p.send(sms)]);
    expect(api.calls.filter((c) => c.path === "/sms/login")).toHaveLength(1);
  });

  it("a business's approved sender name replaces the default; promotions get priority 0", async () => {
    const api = fakeTnet({ "/sms/login": [LOGIN_OK], "/sms/messages": [SENT] });
    await tnetProvider(cfg, api.impl).send({ ...sms, senderName: "Orchidea", kind: "marketing" });
    expect(api.calls[1].body).toMatchObject({ title: "Orchidea", priority: 0 });
  });

  it("401 on send → new token, same key, one more try", async () => {
    const api = fakeTnet({
      "/sms/login": [LOGIN_OK, { status: 201, body: { data: { access_token: "tok-2", expires_in: 300 } } }],
      "/sms/messages": [{ status: 401, body: { statusCode: 401 } }, SENT],
    });
    const r = await tnetProvider(cfg, api.impl).send(sms);
    expect(r.ok).toBe(true);
    const sends = api.calls.filter((c) => c.path === "/sms/messages");
    expect(sends.map((c) => c.headers.authorization)).toEqual(["Bearer tok-1", "Bearer tok-2"]);
    expect(new Set(sends.map((c) => c.headers["idempotency-key"])).size).toBe(1);
  });

  it("a timeout is retried once with the same key; success then counts", async () => {
    const api = fakeTnet({ "/sms/login": [LOGIN_OK], "/sms/messages": ["timeout", SENT] });
    const r = await tnetProvider(cfg, api.impl).send(sms);
    expect(r.ok).toBe(true);
    const sends = api.calls.filter((c) => c.path === "/sms/messages");
    expect(sends).toHaveLength(2);
    expect(sends[0].headers["idempotency-key"]).toBe(sends[1].headers["idempotency-key"]);
  });

  it("timeout then 409 (key already used): uncertain, never retried later", async () => {
    const api = fakeTnet({
      "/sms/login": [LOGIN_OK],
      "/sms/messages": ["timeout", { status: 409, body: { statusCode: 409 } }],
    });
    const r = await tnetProvider(cfg, api.impl).send(sms);
    expect(r).toMatchObject({ ok: false, error: { code: "uncertain", retryable: false } });
  });

  it("two timeouts: uncertain, not retried", async () => {
    const api = fakeTnet({ "/sms/login": [LOGIN_OK], "/sms/messages": ["timeout"] });
    const r = await tnetProvider(cfg, api.impl).send(sms);
    expect(r.error).toMatchObject({ code: "uncertain", retryable: false });
    expect(api.calls.filter((c) => c.path === "/sms/messages")).toHaveLength(2);
  });

  it("errors map to codes; only rate limits and login trouble are retried by the queue", async () => {
    const cases: [Reply, string, boolean][] = [
      [
        { status: 400, body: { statusMessage: "The sender address is not configured for this client." } },
        "sender",
        false,
      ],
      [{ status: 400, body: { statusMessage: "Bad" } }, "rejected", false],
      [{ status: 403, body: {} }, "not_permitted", false],
      [{ status: 422, body: { message: "The phone field is required." } }, "invalid", false],
      [{ status: 429, body: {} }, "rate_limited", true],
      [{ status: 503, body: {} }, "uncertain", false],
    ];
    for (const [reply, code, retryable] of cases) {
      const api = fakeTnet({ "/sms/login": [LOGIN_OK], "/sms/messages": [reply] });
      const r = await tnetProvider(cfg, api.impl).send(sms);
      expect(r.error, code).toMatchObject({ code, retryable });
    }
  });

  it("login failures: wrong credentials not retried; rate limit retried; nothing was sent", async () => {
    const bad = fakeTnet({ "/sms/login": [{ status: 422, body: {} }] });
    expect((await tnetProvider(cfg, bad.impl).send(sms)).error).toMatchObject({
      code: "invalid_credentials",
      retryable: false,
    });
    const busy = fakeTnet({ "/sms/login": [{ status: 429, body: {} }] });
    expect((await tnetProvider(cfg, busy.impl).send(sms)).error).toMatchObject({
      code: "rate_limited",
      retryable: true,
    });
    expect(bad.calls.some((c) => c.path === "/sms/messages")).toBe(false);
  });

  it("refuses bad input without calling TNET", async () => {
    const api = fakeTnet({});
    const p = tnetProvider(cfg, api.impl);
    expect((await p.send({ ...sms, to: "555123456" })).error?.code).toBe("destination");
    expect((await p.send({ ...sms, idempotencyKey: "not-a-uuid" })).error?.code).toBe("bad_key");
    expect((await tnetProvider({ ...cfg, sender: " " }, api.impl).send(sms)).error?.code).toBe("sender");
    expect(api.calls).toHaveLength(0);
  });
});

describe("TNET status", () => {
  it("reads the stored status", async () => {
    const api = fakeTnet({
      "/sms/login": [LOGIN_OK],
      "/sms/*": [
        { status: 200, body: { data: { lifecycle_status: "delivered", delivery_status: "DELIVRD" } } },
        { status: 200, body: { data: { lifecycle_status: "submitted", delivery_status: null } } },
        { status: 200, body: { data: { lifecycle_status: "failed", delivery_status: null } } },
        { status: 404, body: {} },
      ],
    });
    const p = tnetProvider(cfg, api.impl);
    const ref = "a1b2c3d4-1234-4567-89ab-0123456789ab";
    expect(await p.getStatus!(ref)).toBe("delivered");
    expect(await p.getStatus!(ref)).toBe("pending");
    expect(await p.getStatus!(ref)).toBe("failed");
    expect(await p.getStatus!(ref)).toBe("unknown");
    expect(await p.getStatus!("not-a-uuid")).toBe("unknown");
  });
});

describe("TNET delivery callback", () => {
  const secret = "a".repeat(64);
  const body = JSON.stringify({
    group_id: null,
    message_id: "A1B2C3D4-1234-4567-89AB-0123456789AB",
    delivery_status: "DELIVRD",
    delivery_status_date: "2026-11-12T10:00:00+00:00",
    phone_number: "995555123456",
  });
  const sign = (ts: string, raw = body, key = secret) =>
    `v1=${createHmac("sha256", key).update(`${ts}.${raw}`).digest("hex")}`;
  const now = 1_800_000_000;

  it("accepts a correctly signed, fresh callback", () => {
    const ts = String(now - 10);
    expect(verifyTnetWebhook(body, ts, sign(ts), secret, now)).toBe(true);
  });

  it("refuses unsigned, wrong, changed, stale, or malformed callbacks — and an empty secret", () => {
    const ts = String(now);
    expect(verifyTnetWebhook(body, null, null, secret, now)).toBe(false);
    expect(verifyTnetWebhook(body, ts, sign(ts, body, "b".repeat(64)), secret, now)).toBe(false);
    expect(verifyTnetWebhook(body.replace("DELIVRD", "UNDELIV"), ts, sign(ts), secret, now)).toBe(false);
    expect(verifyTnetWebhook(body, String(now - 301), sign(String(now - 301)), secret, now)).toBe(false);
    expect(verifyTnetWebhook(body, String(now + 301), sign(String(now + 301)), secret, now)).toBe(false);
    expect(verifyTnetWebhook(body, ts, sign(ts).toUpperCase(), secret, now)).toBe(false);
    expect(verifyTnetWebhook(body, ts, sign(ts).replace("v1=", "v2="), secret, now)).toBe(false);
    expect(verifyTnetWebhook(body, ts, sign(ts, body, ""), "", now)).toBe(false);
  });

  it("parses the report (message id lower-cased, outcome mapped)", () => {
    expect(parseTnetCallback(body)).toEqual({
      messageId: "a1b2c3d4-1234-4567-89ab-0123456789ab",
      outcome: "delivered",
      code: "DELIVRD",
    });
    expect(parseTnetCallback("{not json")).toBeNull();
    expect(parseTnetCallback(JSON.stringify({ message_id: "x" }))).toBeNull();
  });
});
