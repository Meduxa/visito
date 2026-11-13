import "server-only";
import { SMS_SALON_TOOLS } from "@/lib/pilot";
import { getSmsProvider } from "@/integrations/sms";
import { createAdminClient } from "@/lib/supabase/admin";
import { countSegments } from "./segments";

// Every SMS goes through the queue in the database (sms_messages): one key =
// one message, credits reserved when it is picked up, refunded on failure,
// and a log row the business can see. Codes are stored blanked out.

export type QueueInput = {
  tenantId: string;
  to: string;
  text: string; // what the phone receives
  storedText?: string; // what the log shows (SMS codes are blanked out)
  kind: "service" | "marketing";
  type:
    | "otp"
    | "confirmed"
    | "pending"
    | "reminder"
    | "rescheduled"
    | "cancelled"
    | "manual"
    | "marketing"
    | "review";
  key: string;
  clientId?: string | null;
  bookingId?: string | null;
  sendAfter?: Date;
  createdBy?: string | null;
};

type Claimed = {
  id: string;
  tenant_id: string;
  to_phone: string;
  body: string;
  kind: "service" | "marketing";
};

export async function queueSms(m: QueueInput): Promise<string | null> {
  const { data, error } = await createAdminClient().rpc("sms_enqueue", {
    p_tenant: m.tenantId,
    p_to: m.to,
    p_body: m.storedText ?? m.text,
    p_kind: m.kind,
    p_type: m.type,
    p_key: m.key,
    p_segments: Math.min(10, countSegments(m.text).segments),
    p_client: m.clientId ?? (null as unknown as string),
    p_booking: m.bookingId ?? (null as unknown as string),
    // "now" is the database's clock; a computer's clock may run a little ahead
    p_send_after: m.sendAfter && m.sendAfter.getTime() > Date.now() ? m.sendAfter.toISOString() : undefined,
    p_created_by: m.createdBy ?? (null as unknown as string),
  });
  if (error) {
    console.error("sms enqueue failed", error.code);
    return null;
  }
  return data as string;
}

// The business's own sender name once the provider approved it; otherwise the default.
// During the pilot always the default (Visito's), decision 033.
async function senderName(tenantId: string) {
  if (!SMS_SALON_TOOLS) return undefined;
  const { data } = await createAdminClient()
    .from("tenant_settings")
    .select("sms_sender_name, sms_sender_status")
    .eq("tenant_id", tenantId)
    .single();
  return data?.sms_sender_status === "approved" ? (data.sms_sender_name ?? undefined) : undefined;
}

async function deliver(m: Claimed, text?: string): Promise<boolean> {
  const db = createAdminClient();
  let provider: ReturnType<typeof getSmsProvider>;
  try {
    provider = getSmsProvider();
  } catch {
    // no SMS company connected (production before one is chosen): not sent, credits back
    await db.rpc("sms_finish", {
      p_id: m.id,
      p_ok: false,
      p_provider: "none",
      p_ref: "",
      p_error: "no_provider",
      p_retry: false,
    });
    return false;
  }
  let ok = false;
  try {
    const r = await provider.send({
      to: m.to_phone,
      text: text ?? m.body,
      kind: m.kind,
      senderName: await senderName(m.tenant_id),
      idempotencyKey: m.id,
    });
    ok = r.ok;
    await db.rpc("sms_finish", {
      p_id: m.id,
      p_ok: r.ok,
      p_provider: provider.name,
      p_ref: r.providerRef ?? "",
      p_error: (r.error?.code ?? null) as string,
      p_retry: r.error?.retryable ?? false,
    });
    if (r.ok && r.delivered)
      await db.rpc("sms_delivery", {
        p_provider: provider.name,
        p_ref: r.providerRef ?? "",
        p_delivered: true,
      });
  } catch (e) {
    console.error("sms send failed", e instanceof Error ? e.message : "unknown");
    await db.rpc("sms_finish", {
      p_id: m.id,
      p_ok: false,
      p_provider: provider.name,
      p_ref: "",
      p_error: "exception",
      p_retry: true,
    });
  }
  return ok;
}

/** Queue and send right away (codes, confirmations). false = not sent (e.g. no credits). */
export async function sendNow(m: QueueInput): Promise<boolean> {
  const id = await queueSms(m);
  if (!id) return false;
  const { data } = await createAdminClient().rpc("sms_claim", { p_limit: 1, p_only: id });
  const claimed = (data ?? []) as Claimed[];
  if (!claimed.length) return false; // already sent before, skipped, or no credits
  return deliver(claimed[0], m.text);
}

/** The background job: everything due in the queue. */
export async function processQueue(limit = 50) {
  const { data } = await createAdminClient().rpc("sms_claim", { p_limit: limit });
  let sent = 0;
  for (const m of (data ?? []) as Claimed[]) if (await deliver(m)) sent++;
  return { picked: (data ?? []).length, sent };
}

/**
 * Delivery reports for providers that are asked rather than calling back (sender.ge):
 * messages sent in the last 24 hours and still waiting are checked; after that
 * they stay "sent".
 */
export async function checkDeliveries(limit = 50) {
  let provider: ReturnType<typeof getSmsProvider>;
  try {
    provider = getSmsProvider();
  } catch {
    return { checked: 0, delivered: 0, failed: 0 };
  }
  if (!provider.getStatus) return { checked: 0, delivered: 0, failed: 0 };
  const db = createAdminClient();
  const now = Date.now();
  const { data } = await db
    .from("sms_messages")
    .select("provider_ref")
    .eq("provider", provider.name)
    .eq("status", "sent")
    .not("provider_ref", "is", null)
    .gte("sent_at", new Date(now - 24 * 3_600_000).toISOString())
    .lte("sent_at", new Date(now - 60_000).toISOString()) // give the network a minute
    .order("sent_at")
    .limit(limit);
  let delivered = 0;
  let failed = 0;
  for (const { provider_ref } of data ?? []) {
    const status = await provider.getStatus(provider_ref!);
    if (status !== "delivered" && status !== "failed") continue;
    await db.rpc("sms_delivery", {
      p_provider: provider.name,
      p_ref: provider_ref!,
      p_delivered: status === "delivered",
      p_error: status === "failed" ? "undelivered" : undefined,
    });
    if (status === "delivered") delivered++;
    else failed++;
  }
  return { checked: (data ?? []).length, delivered, failed };
}
