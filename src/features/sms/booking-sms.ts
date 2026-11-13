import "server-only";
import { getTranslations } from "next-intl/server";
import { hmac, newToken } from "@/features/public-booking/security";
import { shortDate, ymdIn } from "@/lib/date-format";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderSms, sendTime, type SmsVars, type TemplateType } from "./render";
import { queueSms, sendNow } from "./send";
import { smsText } from "./texts";

// Service messages about bookings (no marketing consent needed): confirmation,
// reminder, moved, cancelled, in the business's language. Texts: see texts.ts.

// decision 033: the business's text (when allowed) → Visito's → built-in
const template = (tenantId: string, type: TemplateType, locale: string) => smsText(tenantId, type, locale);

async function manageLink(bookingId: string) {
  const token = newToken();
  await createAdminClient().rpc("add_manage_token", { p_booking: bookingId, p_token_hash: hmac(token) });
  return `${publicEnv.NEXT_PUBLIC_APP_URL}/m/${token}`;
}

type Kind = "confirmed" | "pending" | "rescheduled" | "cancelled";
const SWITCH = {
  confirmed: "sms_on_confirm",
  pending: "sms_on_confirm",
  rescheduled: "sms_on_reschedule",
  cancelled: "sms_on_cancel",
} as const;

/**
 * Tells the client about their booking. `immediate` = the client is waiting for it
 * (online booking), so quiet hours do not apply. Never throws: a failed SMS must not
 * undo a booking change.
 */
export async function notifyBooking(
  bookingId: string,
  type: Kind,
  opts: { immediate?: boolean; manageToken?: string; createdBy?: string | null } = {},
): Promise<boolean> {
  try {
    const db = createAdminClient();
    const { data: b } = await db
      .from("bookings")
      .select(
        "id, tenant_id, location_id, starts_at, client_id, clients(first_name, phone_e164, anonymized_at), booking_items(name_snapshot, sort_order, staff(display_name))",
      )
      .eq("id", bookingId)
      .single();
    const client = b?.clients as unknown as {
      first_name: string;
      phone_e164: string | null;
      anonymized_at: string | null;
    } | null;
    if (!b || !client?.phone_e164 || client.anonymized_at) return false;
    const [{ data: tenant }, { data: s }, { data: loc }] = await Promise.all([
      db.from("tenants").select("name, timezone, locale_default").eq("id", b.tenant_id).single(),
      db.from("tenant_settings").select("*").eq("tenant_id", b.tenant_id).single(),
      // the booking's own branch (decision 032); older bookings: the main one
      b.location_id
        ? db.from("locations").select("address, phone, is_primary").eq("id", b.location_id).maybeSingle()
        : db
            .from("locations")
            .select("address, phone, is_primary")
            .eq("tenant_id", b.tenant_id)
            .eq("is_primary", true)
            .maybeSingle(),
    ]);
    if (!tenant || !s || !s[SWITCH[type]]) return false;

    const now = new Date();
    const start = new Date(b.starts_at);
    if (start <= now) return false;
    const when = opts.immediate
      ? now
      : sendTime(now, tenant.timezone, { start: s.quiet_start, end: s.quiet_end }, start);
    if (!when) return false;

    const locale = tenant.locale_default;
    const body = await template(b.tenant_id, type, locale);
    const items = [
      ...(b.booking_items as unknown as {
        name_snapshot: string;
        sort_order: number;
        staff: { display_name: string } | null;
      }[]),
    ].sort((x, y) => x.sort_order - y.sort_order);
    const t = await getTranslations({ locale });
    const vars: SmsVars = {
      client_name: client.first_name,
      business_name: tenant.name,
      service: items.map((i) => i.name_snapshot).join(", "),
      staff: [...new Set(items.map((i) => i.staff?.display_name ?? ""))].filter(Boolean).join(", "),
      date: shortDate(t, ymdIn(b.starts_at, tenant.timezone)),
      time: start.toLocaleTimeString("en-GB", {
        timeZone: tenant.timezone,
        hour: "2-digit",
        minute: "2-digit",
      }),
      address: loc?.address ?? "",
      phone: (loc && !loc.is_primary ? (loc.phone ?? s.phone) : (s.phone ?? loc?.phone)) ?? "",
    };
    if (body.includes("{manage_link}") && type !== "cancelled")
      vars.manage_link = opts.manageToken
        ? `${publicEnv.NEXT_PUBLIC_APP_URL}/m/${opts.manageToken}`
        : await manageLink(bookingId);

    const message = {
      tenantId: b.tenant_id,
      to: client.phone_e164,
      text: renderSms(body, vars),
      kind: "service" as const,
      type,
      // a moved booking gets a new message for each new time
      key: `${type}:${bookingId}${type === "rescheduled" ? `:${Math.floor(start.getTime() / 1000)}` : ""}`,
      clientId: b.client_id,
      bookingId,
      sendAfter: when,
      createdBy: opts.createdBy ?? null,
    };
    return when <= now ? await sendNow(message) : (await queueSms(message)) !== null;
  } catch (e) {
    console.error("notifyBooking failed", e instanceof Error ? e.message : "unknown");
    return false;
  }
}

type DueRow = {
  tenant_id: string;
  booking_id: string;
  client_id: string;
  offset_min: number;
  starts_at: string;
  phone: string;
  first_name: string;
  business: string;
  timezone: string;
  locale: string;
  address: string | null;
  business_phone: string | null;
  quiet_start: string;
  quiet_end: string;
  services: string | null;
  staff: string | null;
};

/** Queues every reminder that is due now (run by the background job every 5 minutes on Netlify, every minute on the laptop). */
export async function enqueueDueReminders() {
  const { data, error } = await createAdminClient().rpc("sms_due_reminders");
  if (error) throw new Error(`reminders: ${error.code}`);
  let queued = 0;
  const now = new Date();
  for (const r of (data ?? []) as DueRow[]) {
    const start = new Date(r.starts_at);
    const when = sendTime(now, r.timezone, { start: r.quiet_start, end: r.quiet_end }, start);
    if (!when) continue; // inside quiet hours until after the visit
    const body = await template(r.tenant_id, "reminder", r.locale);
    const t = await getTranslations({ locale: r.locale });
    const vars: SmsVars = {
      client_name: r.first_name,
      business_name: r.business,
      service: r.services ?? "",
      staff: r.staff ?? "",
      date: shortDate(t, ymdIn(r.starts_at, r.timezone)),
      time: start.toLocaleTimeString("en-GB", { timeZone: r.timezone, hour: "2-digit", minute: "2-digit" }),
      address: r.address ?? "",
      phone: r.business_phone ?? "",
    };
    if (body.includes("{manage_link}")) vars.manage_link = await manageLink(r.booking_id);
    const id = await queueSms({
      tenantId: r.tenant_id,
      to: r.phone,
      text: renderSms(body, vars),
      kind: "service",
      type: "reminder",
      key: `reminder:${r.offset_min}:${r.booking_id}:${Math.floor(start.getTime() / 1000)}`,
      clientId: r.client_id,
      bookingId: r.booking_id,
      sendAfter: when,
    });
    if (id) queued++;
  }
  return { queued };
}
