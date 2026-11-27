import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { getConsentHistory } from "@/features/clients/queries";
import { managerContext, memberContext } from "@/lib/action-context";
import { DEFAULT_TZ } from "@/lib/time";

// Read-only loaders for panels that open in the browser. They are served by
// GET /api/read/[name]/[id] (decision 006), not as server actions: Next.js runs
// a page's server actions one at a time, so loaders queued as actions made
// buttons like "arrived" wait seconds behind them. RLS applies as usual.

const uuid = z.uuid();

// Visits of one client, newest first (RLS: staff see only bookings with them).
export async function clientVisits(clientId: string) {
  const ctx = await memberContext({ read: true });
  if (!ctx || !uuid.safeParse(clientId).success) return [];
  const { data: tenant } = await ctx.supabase
    .from("tenants")
    .select("timezone")
    .eq("id", ctx.tenant.tenantId)
    .single();
  const tz = tenant?.timezone ?? DEFAULT_TZ;
  const { data } = await ctx.supabase
    .from("bookings")
    .select(
      "id, starts_at, status, total_minor, booking_items(name_snapshot, staff_id, sort_order, staff(display_name))",
    )
    .eq("tenant_id", ctx.tenant.tenantId)
    .eq("client_id", clientId)
    .order("starts_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((b) => ({
    id: b.id,
    start: b.starts_at,
    date: formatInTimeZone(b.starts_at, tz, "yyyy-MM-dd"),
    time: formatInTimeZone(b.starts_at, tz, "HH:mm"),
    status: b.status,
    totalMinor: b.total_minor,
    services: [...b.booking_items].sort((x, y) => x.sort_order - y.sort_order).map((i) => i.name_snapshot),
    staff: [
      ...new Set(
        b.booking_items.map(
          (i) => (i.staff as unknown as { display_name: string } | null)?.display_name ?? "",
        ),
      ),
    ].join(", "),
  }));
}

export async function bookingHistory(bookingId: string) {
  const ctx = await memberContext({ read: true });
  if (!ctx || !uuid.safeParse(bookingId).success) return [];
  const { data } = await ctx.supabase
    .from("booking_status_history")
    .select("id, from_status, to_status, reason, changed_at")
    .eq("booking_id", bookingId)
    .order("changed_at", { ascending: false });
  return data ?? [];
}

// Extra items and payments of one booking. Payments come back empty when the
// person may not see money (RLS: owner / admins unless hidden / own bookings).
export async function bookingMoney(bookingId: string) {
  const ctx = await memberContext({ read: true });
  if (!ctx || !uuid.safeParse(bookingId).success) return null;
  const [charges, payments, booking] = await Promise.all([
    ctx.supabase
      .from("booking_charges")
      .select("id, name, price_minor")
      .eq("booking_id", bookingId)
      .order("created_at"),
    ctx.supabase
      .from("payments")
      .select("id, method, amount_minor, tip_minor, status, created_at")
      .eq("booking_id", bookingId)
      .order("created_at"),
    ctx.supabase.from("bookings").select("discount_minor").eq("id", bookingId).maybeSingle(),
  ]);
  return {
    charges: charges.data ?? [],
    payments: payments.data ?? [],
    discountMinor: booking.data?.discount_minor ?? 0,
  };
}

export async function consentHistory(clientId: string) {
  const ctx = await managerContext({ read: true });
  if (!ctx || !uuid.safeParse(clientId).success) return [];
  return getConsentHistory(clientId);
}

export const READS = { clientVisits, bookingHistory, bookingMoney, consentHistory };
export type ReadName = keyof typeof READS;
export type ReadResult<N extends ReadName> = Awaited<ReturnType<(typeof READS)[N]>>;
