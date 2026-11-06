import { describe, expect, it, vi } from "vitest";
import { resendProvider } from "./resend";

const email = { to: "a@example.test", subject: "Hi", text: "Hello", idempotencyKey: "invite:1" };

describe("resend provider", () => {
  it("sends with the key, sender and idempotency key, and returns the id", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
    const r = await resendProvider({
      apiKey: "re_test",
      from: "Visito <hi@x.ge>",
      fetch,
    }).sendTransactional(email);
    expect(r).toEqual({ ok: true, providerRef: "em_1" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer re_test");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("invite:1");
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: "Visito <hi@x.ge>",
      to: ["a@example.test"],
      subject: "Hi",
    });
  });

  it("tells temporary failures from permanent ones", async () => {
    const send = (status: number) =>
      resendProvider({
        apiKey: "k",
        from: "f",
        fetch: async () => new Response("{}", { status }),
      }).sendTransactional(email);
    expect((await send(429)).error).toMatchObject({ code: "http_429", retryable: true });
    expect((await send(503)).error?.retryable).toBe(true);
    expect((await send(422)).error).toMatchObject({ code: "http_422", retryable: false });
    const down = await resendProvider({
      apiKey: "k",
      from: "f",
      fetch: async () => {
        throw new Error("offline");
      },
    }).sendTransactional(email);
    expect(down.error).toMatchObject({ code: "network", retryable: true });
  });
});
