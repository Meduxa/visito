import { describe, expect, it, vi } from "vitest";
import { onlyTo, parseOnlyTo } from "./only-to";
import type { SmsProvider } from "./types";

const real = (): SmsProvider & { send: ReturnType<typeof vi.fn> } => ({
  name: "tnet",
  send: vi.fn(async () => ({ ok: true, providerRef: "ref-1" })),
  getStatus: async () => "delivered",
});
const sms = (to: string) => ({ to, text: "hi", kind: "service" as const, idempotencyKey: "k" });

describe("SMS test mode (SMS_ONLY_TO)", () => {
  it("parses a comma-separated list and ignores junk", () => {
    expect([...parseOnlyTo(" +995 591 31-43-16 , 5913, ,+995555000111")]).toEqual([
      "+995591314316",
      "+995555000111",
    ]);
    expect(parseOnlyTo(undefined).size).toBe(0);
  });

  it("empty list: the provider is used as it is", () => {
    const p = real();
    expect(onlyTo(p, new Set())).toBe(p);
  });

  it("the fake provider is never limited (it sends nothing real)", () => {
    const fake = { ...real(), name: "fake" };
    expect(onlyTo(fake, parseOnlyTo("+995591314316"))).toBe(fake);
  });

  it("listed number: really sent", async () => {
    const p = real();
    const r = await onlyTo(p, parseOnlyTo("+995591314316")).send(sms("+995591314316"));
    expect(r).toEqual({ ok: true, providerRef: "ref-1" });
    expect(p.send).toHaveBeenCalledOnce();
  });

  it("any other number: refused before the provider, never retried", async () => {
    const p = real();
    const wrapped = onlyTo(p, parseOnlyTo("+995591314316"));
    const r = await wrapped.send(sms("+995555123456"));
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ code: "test_mode", retryable: false });
    expect(p.send).not.toHaveBeenCalled();
    expect(wrapped.name).toBe("tnet");
    expect(await wrapped.getStatus!("x")).toBe("delivered");
  });
});
