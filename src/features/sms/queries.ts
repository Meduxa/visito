import "server-only";
import { createClient } from "@/lib/supabase/server";
import { trimSeconds } from "@/lib/time";
import type { TemplateType } from "./render";

export type SmsOverview = {
  balance: number;
  lowBalance: number;
  locale: string;
  settings: {
    senderName: string;
    senderStatus: "none" | "pending" | "approved" | "rejected";
    reminder24h: boolean;
    reminder2h: boolean;
    quietStart: string;
    quietEnd: string;
    onConfirm: boolean;
    onReschedule: boolean;
    onCancel: boolean;
    reviewAsk: boolean; // review request after a visit (decision 030)
  };
  templates: { type: TemplateType; locale: string; body: string }[]; // the business's own texts only
  sentThisMonth: number;
};

export async function getSmsOverview(tenantId: string): Promise<SmsOverview> {
  const db = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [{ data: s }, { data: balance }, { data: templates }, { data: tenant }, { count }] =
    await Promise.all([
      db.from("tenant_settings").select("*").eq("tenant_id", tenantId).single(),
      db.rpc("sms_balance", { p_tenant: tenantId }, { get: true }),
      db.from("sms_templates").select("type, locale, body").eq("tenant_id", tenantId),
      db.from("tenants").select("locale_default").eq("id", tenantId).single(),
      db
        .from("sms_messages")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["sent", "delivered"])
        .gte("created_at", monthStart.toISOString()),
    ]);
  return {
    balance: (balance as number) ?? 0,
    lowBalance: s?.sms_low_balance ?? 10,
    locale: tenant?.locale_default ?? "ka",
    settings: {
      senderName: s?.sms_sender_name ?? "",
      senderStatus: (s?.sms_sender_status ?? "none") as SmsOverview["settings"]["senderStatus"],
      reminder24h: s?.reminder_24h ?? false,
      reminder2h: s?.reminder_2h ?? true,
      quietStart: trimSeconds(s?.quiet_start ?? "22:00"),
      quietEnd: trimSeconds(s?.quiet_end ?? "09:00"),
      onConfirm: s?.sms_on_confirm ?? true,
      onReschedule: s?.sms_on_reschedule ?? true,
      onCancel: s?.sms_on_cancel ?? true,
      reviewAsk: s?.reviews_ask ?? false,
    },
    templates: (templates ?? []) as SmsOverview["templates"],
    sentThisMonth: count ?? 0,
  };
}

export const LOG_PAGE = 50;
export const LOG_STATUSES = ["all", "queued", "sent", "failed"] as const;
export type LogStatus = (typeof LOG_STATUSES)[number];

export async function getSmsLog(tenantId: string, status: LogStatus, page: number) {
  const db = await createClient();
  let q = db
    .from("sms_messages")
    .select(
      "id, created_at, sent_at, to_phone, body, type, kind, status, segments, error_code, clients(first_name, last_name)",
      {
        count: "exact",
      },
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(page * LOG_PAGE, page * LOG_PAGE + LOG_PAGE - 1);
  // "sent" includes delivered; "failed" includes skipped (no consent)
  if (status === "queued") q = q.in("status", ["queued", "sending"]);
  if (status === "sent") q = q.in("status", ["sent", "delivered"]);
  if (status === "failed") q = q.in("status", ["failed", "skipped"]);
  const { data, count } = await q;
  return {
    total: count ?? 0,
    rows: (data ?? []).map((m) => {
      const c = m.clients as unknown as { first_name: string; last_name: string | null } | null;
      return {
        id: m.id,
        at: m.created_at,
        to: m.to_phone,
        client: c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : null,
        body: m.body,
        type: m.type,
        kind: m.kind,
        status: m.status,
        segments: m.segments,
        error: m.error_code,
      };
    }),
  };
}
