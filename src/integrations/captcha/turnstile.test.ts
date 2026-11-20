import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

const reply = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("verifyTurnstile", () => {
  it("accepts a token Cloudflare confirms, sending secret, token and IP", async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile({ secret: "s", token: "t", ip: "1.2.3.4", fetch: f })).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const sent = init.body as URLSearchParams;
    expect([sent.get("secret"), sent.get("response"), sent.get("remoteip")]).toEqual(["s", "t", "1.2.3.4"]);
  });

  it("refuses a token Cloudflare rejects (used, expired, forged)", async () => {
    expect(await verifyTurnstile({ secret: "s", token: "t", fetch: reply({ success: false }) })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("refuses a missing token without asking Cloudflare", async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile({ secret: "s", token: "", fetch: f })).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(await verifyTurnstile({ secret: "s", token: null, fetch: f })).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it("reports Cloudflare being down separately (network error or 5xx)", async () => {
    const broken = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await verifyTurnstile({ secret: "s", token: "t", fetch: broken })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await verifyTurnstile({ secret: "s", token: "t", fetch: reply({}, 503) })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
