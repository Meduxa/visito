import "server-only";
import { fromZonedTime } from "date-fns-tz";
import { addDaysStr, workingRanges } from "@/features/booking/engine/availability";
import { loadEngineData } from "@/features/booking/load-data";
import { getBranchInfo } from "@/features/branches/queries";
import { ymdIn } from "@/lib/date-format";
import { localized } from "@/lib/i18n-text";
import type { createClient } from "@/lib/supabase/server";
import { DEFAULT_TZ } from "@/lib/time";
import { computeReport, type RBooking, type RPayment, type RStaff } from "./compute";

type Db = Awaited<ReturnType<typeof createClient>>;

// Reads with the signed-in user's client: RLS decides what they may see (e.g.
// payments are hidden from admins when the owner switched revenue off).
export async function buildReport(
  db: Db,
  tenantId: string,
  // branchId: one branch only (decision 032); otherwise every branch together
  opts: { from: string; to: string; staffId?: string | null; branchId?: string | null; locale: string },
) {
  const { data: tenant } = await db.from("tenants").select("timezone").eq("id", tenantId).single();
  const tz = tenant?.timezone ?? DEFAULT_TZ;
  const start = fromZonedTime(`${opts.from}T00:00`, tz).toISOString();
  const end = fromZonedTime(`${addDaysStr(opts.to, 1)}T00:00`, tz).toISOString();
  const branches = (await getBranchInfo(db, tenantId)).usable;
  const branch = branches.length > 1 ? branches.find((b) => b.id === opts.branchId) : undefined;
  // bookings without a branch (made before branches existed) belong to the main one
  const inBranch = (loc: string | null | undefined) => !branch || (loc ?? branches[0]?.id) === branch.id;

  const [bookings, payments, staffRows, categories, engine] = await Promise.all([
    db
      .from("bookings")
      .select(
        "id, status, source, client_id, location_id, starts_at, booking_items(staff_id, service_id, name_snapshot, price_minor_snapshot, starts_at, ends_at, services(category_id))",
      )
      .eq("tenant_id", tenantId)
      .gte("starts_at", start)
      .lt("starts_at", end),
    db
      .from("payments")
      .select("booking_id, method, amount_minor, tip_minor, created_at, bookings(location_id)")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("created_at", start)
      .lt("created_at", end),
    db
      .from("staff")
      .select("id, display_name, commission_pct, active")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    db.from("service_categories").select("id, name_i18n").eq("tenant_id", tenantId),
    // working time: per branch, so intervals in every branch count once
    Promise.all(
      (branch ? [branch] : branches.length > 1 ? branches : [undefined]).map((b) =>
        loadEngineData(db, tenantId, opts.from, opts.to, { locationId: b?.id }),
      ),
    ),
  ]);

  const only = opts.staffId ?? null;
  const rBookings: RBooking[] = (bookings.data ?? [])
    .filter((b) => inBranch(b.location_id))
    .map((b) => ({
      id: b.id,
      status: b.status,
      source: b.source,
      clientId: b.client_id,
      date: ymdIn(b.starts_at, tz),
      items: b.booking_items
        .filter((i) => !only || i.staff_id === only)
        .map((i) => ({
          staffId: i.staff_id,
          serviceKey: i.service_id ?? i.name_snapshot,
          serviceName: i.name_snapshot,
          categoryId: (i.services as unknown as { category_id: string | null } | null)?.category_id ?? null,
          priceMinor: i.price_minor_snapshot,
          minutes: Math.round((Date.parse(i.ends_at) - Date.parse(i.starts_at)) / 60_000),
        })),
    }))
    .filter((b) => b.items.length > 0);
  const bookingIds = new Set(rBookings.map((b) => b.id));

  const rPayments: RPayment[] = (payments.data ?? [])
    .filter((p) => !only || bookingIds.has(p.booking_id))
    .filter(
      (p) =>
        !branch || inBranch((p.bookings as unknown as { location_id: string | null } | null)?.location_id),
    )
    .map((p) => ({
      date: ymdIn(p.created_at, tz),
      method: p.method,
      amountMinor: p.amount_minor,
      tipMinor: p.tip_minor,
      bookingId: p.booking_id,
    }));

  // working minutes per person from their real schedule (date changes, time off excluded)
  const rStaff: RStaff[] = (staffRows.data ?? [])
    .filter(
      (s) =>
        (!only || s.id === only) &&
        (s.active || rBookings.some((b) => b.items.some((i) => i.staffId === s.id))),
    )
    .map((s) => {
      let minutes = 0;
      for (const e of engine) {
        const data = e.staff.find((x) => x.id === s.id);
        if (data)
          for (let d = opts.from; d <= opts.to; d = addDaysStr(d, 1))
            for (const [a, b] of workingRanges(data, d, e)) {
              const off = data.timeOff.reduce(
                (m, [x, y]) => m + Math.max(0, Math.min(b, y) - Math.max(a, x)),
                0,
              );
              minutes += (b - a - off) / 60_000;
            }
      }
      return {
        id: s.id,
        name: s.display_name,
        commissionPct: Number(s.commission_pct),
        workingMinutes: Math.round(minutes),
      };
    });

  // every visit date of the clients seen, for new/returning and retention
  const clientIds = [...new Set(rBookings.map((b) => b.clientId).filter((c): c is string => !!c))];
  const clientVisits: Record<string, string[]> = {};
  for (let i = 0; i < clientIds.length; i += 300) {
    const { data } = await db
      .from("bookings")
      .select("client_id, starts_at")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .in("client_id", clientIds.slice(i, i + 300));
    for (const v of data ?? []) (clientVisits[v.client_id!] ??= []).push(ymdIn(v.starts_at, tz));
  }

  return computeReport({
    bookings: rBookings,
    payments: rPayments,
    staff: rStaff,
    categories: Object.fromEntries(
      (categories.data ?? []).map((c) => [c.id, localized(c.name_i18n, opts.locale)]),
    ),
    clientVisits,
    from: opts.from,
    to: opts.to,
    today: ymdIn(new Date().toISOString(), tz),
  });
}

/** May this member see money (payments) at all? Mirrors the database rule can_see_money. */
export async function canSeeMoney(db: Db, tenantId: string, role: string) {
  if (role === "owner") return true;
  if (role !== "admin") return false;
  const { data } = await db
    .from("tenant_settings")
    .select("admins_see_revenue")
    .eq("tenant_id", tenantId)
    .single();
  return !!data?.admins_see_revenue;
}
