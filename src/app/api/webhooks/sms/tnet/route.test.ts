import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The TNET delivery-report endpoint (decision 027): signature first, then one
// database update per final report; anything unsigned changes nothing.
const rpc = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/server-env", () => ({ serverEnv: () => ({ TNET_WEBHOOK_SECRET: SECRET }) }));

const SECRET = "f".repeat(64);
const { POST } = await import("./route");

const report = (status: string) =>
  JSON.stringify({
    group_id: null,
    message_id: "A1B2C3D4-1234-4567-89AB-0123456789AB",
    delivery_status: status,
    delivery_status_date: "2026-11-12T10:00:00+00:00",
    phone_number: "995555123456",
  });

function request(body: string, opts: { secret?: string; ts?: number } = {}) {
  const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
  const sig = `v1=${createHmac("sha256", opts.secret ?? SECRET)
    .update(`${ts}.${body}`)
    .digest("hex")}`;
  return new Request("https://visito.ge/api/webhooks/sms/tnet", {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-timestamp": ts, "x-webhook-signature": sig },
    body,
  });
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
});

describe("POST /api/webhooks/sms/tnet", () => {
  it("a signed 'delivered' report marks the message delivered", async () => {
    const res = await POST(request(report("DELIVRD")));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("sms_delivery", {
      p_provider: "tnet",
      p_ref: "a1b2c3d4-1234-4567-89ab-0123456789ab",
      p_delivered: true,
      p_error: undefined,
    });
  });

  it("a failed report keeps TNET's own code", async () => {
    await POST(request(report("UNDELIV")));
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_delivered: false, p_error: "undelivered:UNDELIV" });
  });

  it("unsigned, wrongly signed or stale reports are refused and change nothing", async () => {
    const plain = new Request("https://visito.ge/api/webhooks/sms/tnet", {
      method: "POST",
      body: report("DELIVRD"),
    });
    expect((await POST(plain)).status).toBe(401);
    expect((await POST(request(report("DELIVRD"), { secret: "0".repeat(64) }))).status).toBe(401);
    expect((await POST(request(report("DELIVRD"), { ts: Math.floor(Date.now() / 1000) - 600 }))).status).toBe(
      401,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a report that is not final yet is acknowledged without changes", async () => {
    expect((await POST(request(report("ACCEPTD")))).status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a database failure answers 500 so TNET sends the report again", async () => {
    rpc.mockResolvedValue({ error: { code: "XX000" } });
    expect((await POST(request(report("DELIVRD")))).status).toBe(500);
  });
});
