import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { memberContext } from "@/lib/action-context";
import { DEFAULT_TZ } from "@/lib/time";

// The bell's list (decision 019). Who sees what is decided in the database
// (my_notifications): owner/admin everything, staff only their own profile's.
// Served by GET /api/notifications so polling never queues behind buttons
// (decision 006).

export type NotificationKind = "online_booking" | "needs_action";

export type NotificationItem = {
  kind: NotificationKind;
  bookingId: string;
  at: string;
  read: boolean;
  /** booking start, tenant-local */
  date: string;
  dayMonth: string;
  time: string;
  client: string | null;
  services: string;
  staff: string;
};

export type NotificationFeed = { unread: number; items: NotificationItem[] };

export async function loadNotifications(): Promise<NotificationFeed | null> {
  const ctx = await memberContext({ read: true });
  if (!ctx) return null;
  const tenantId = ctx.tenant.tenantId;
  const [tenant, list, unread] = await Promise.all([
    ctx.supabase.from("tenants").select("timezone").eq("id", tenantId).single(),
    ctx.supabase.rpc("my_notifications", { p_tenant: tenantId, p_limit: 30 }),
    ctx.supabase.rpc("my_notifications_unread", { p_tenant: tenantId }),
  ]);
  if (list.error || unread.error) {
    console.error("notifications load", list.error?.code ?? unread.error?.code);
    return null;
  }
  const tz = tenant.data?.timezone ?? DEFAULT_TZ;
  return {
    unread: unread.data ?? 0,
    items: (list.data ?? []).map((n) => ({
      kind: n.kind as NotificationKind,
      bookingId: n.booking_id,
      at: n.at,
      read: n.is_read,
      date: formatInTimeZone(n.starts_at, tz, "yyyy-MM-dd"),
      dayMonth: formatInTimeZone(n.starts_at, tz, "dd.MM"),
      time: formatInTimeZone(n.starts_at, tz, "HH:mm"),
      client: n.client_name ?? null,
      services: n.services ?? "",
      staff: n.staff ?? "",
    })),
  };
}
