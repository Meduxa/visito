import "server-only";
import { fromZonedTime } from "date-fns-tz";
import { canSeeMoney } from "@/features/reports/report";
import { localized } from "@/lib/i18n-text";
import type { createClient } from "@/lib/supabase/server";
import type { TenantMembership } from "@/lib/tenant";
import { DEFAULT_TZ } from "@/lib/time";
import { computePayroll, shiftMonth, splitDiscount, type PayItem, type RateSource } from "./compute";

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * May this member use payroll? "hidden": an admin while the owner hides revenue
 * (or staff); "locked": the business's plan does not include payroll. The
 * database enforces the same rule (can_use_payroll).
 */
export async function payrollAccess(db: Db, tenant: TenantMembership): Promise<"ok" | "hidden" | "locked"> {
  if (!(await canSeeMoney(db, tenant.tenantId, tenant.role))) return "hidden";
  const { data } = await db.rpc("tenant_has_feature", { p_tenant: tenant.tenantId, p_feature: "payroll" });
  return data === true ? "ok" : "locked";
}

/** Names of the plans that include payroll, for the "upgrade" message. */
export async function plansWithPayroll(db: Db) {
  const { data } = await db
    .from("plans")
    .select("name")
    .eq("active", true)
    .contains("features", ["payroll"])
    .neq("code", "trial")
    .order("sort_order");
  return (data ?? []).map((p) => p.name);
}

// Reads past PostgREST's page size (1000 rows) — a busy month can have more.
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error("payroll: could not load");
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

export const isMonth = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export async function loadPayroll(db: Db, tenantId: string, month: string, locale: string) {
  const { data: tenant } = await db.from("tenants").select("timezone").eq("id", tenantId).single();
  const tz = tenant?.timezone ?? DEFAULT_TZ;
  const start = fromZonedTime(`${month}-01T00:00`, tz).toISOString();
  const end = fromZonedTime(`${shiftMonth(month, 1)}-01T00:00`, tz).toISOString();
  const monthDate = `${month}-01`;

  const [items, tips, staff, pay, rates, adjustments, payouts, services, categories] = await Promise.all([
    all((a, b) =>
      db
        .from("booking_items")
        .select(
          "id, booking_id, staff_id, service_id, price_minor_snapshot, services(category_id), bookings!inner(status, discount_minor)",
        )
        .eq("tenant_id", tenantId)
        .eq("bookings.status", "completed")
        .gte("starts_at", start)
        .lt("starts_at", end)
        .order("id")
        .range(a, b),
    ),
    all((a, b) =>
      db
        .from("payments")
        .select("id, tip_minor, tip_staff_id")
        .eq("tenant_id", tenantId)
        .eq("status", "paid")
        .gt("tip_minor", 0)
        .not("tip_staff_id", "is", null)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("id")
        .range(a, b),
    ),
    db
      .from("staff")
      .select("id, display_name, active, commission_pct")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    db.from("staff_pay").select("staff_id, salary_minor").eq("tenant_id", tenantId),
    db.from("staff_pay_rates").select("id, staff_id, category_id, service_id, pct").eq("tenant_id", tenantId),
    db
      .from("pay_adjustments")
      .select("id, staff_id, kind, amount_minor, note")
      .eq("tenant_id", tenantId)
      .eq("month", monthDate)
      .order("created_at"),
    db
      .from("payouts")
      .select("id, staff_id, amount_minor, method, paid_on, note")
      .eq("tenant_id", tenantId)
      .eq("month", monthDate),
    db.from("services").select("id, name_i18n").eq("tenant_id", tenantId),
    db.from("service_categories").select("id, name_i18n").eq("tenant_id", tenantId),
  ]);

  // the booking discount is shared over that booking's services
  const byBooking = new Map<string, typeof items>();
  for (const i of items) byBooking.set(i.booking_id, [...(byBooking.get(i.booking_id) ?? []), i]);
  const payItems: PayItem[] = [];
  for (const list of byBooking.values()) {
    const booking = list[0].bookings as unknown as { discount_minor: number };
    const values = splitDiscount(
      list.map((i) => i.price_minor_snapshot),
      booking.discount_minor,
    );
    list.forEach((i, n) =>
      payItems.push({
        staffId: i.staff_id,
        serviceId: i.service_id,
        categoryId: (i.services as unknown as { category_id: string | null } | null)?.category_id ?? null,
        valueMinor: values[n],
      }),
    );
  }

  const salary = new Map((pay.data ?? []).map((p) => [p.staff_id, p.salary_minor]));
  const result = computePayroll({
    staff: (staff.data ?? []).map((s) => ({
      id: s.id,
      name: s.display_name,
      active: s.active,
      defaultPct: Number(s.commission_pct),
      salaryMinor: salary.get(s.id) ?? 0,
    })),
    items: payItems,
    tips: tips.map((p) => ({ staffId: p.tip_staff_id!, tipMinor: p.tip_minor })),
    rates: (rates.data ?? []).map((r) => ({
      staffId: r.staff_id,
      categoryId: r.category_id,
      serviceId: r.service_id,
      pct: Number(r.pct),
    })),
    adjustments: (adjustments.data ?? []).map((a) => ({
      id: a.id,
      staffId: a.staff_id,
      kind: a.kind as "bonus" | "deduction",
      amountMinor: a.amount_minor,
      note: a.note,
    })),
    payouts: (payouts.data ?? []).map((p) => ({
      id: p.id,
      staffId: p.staff_id,
      amountMinor: p.amount_minor,
      method: p.method,
      paidOn: p.paid_on,
      note: p.note,
    })),
  });

  const serviceName = new Map((services.data ?? []).map((s) => [s.id, localized(s.name_i18n, locale)]));
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, localized(c.name_i18n, locale)]));
  /** What a pay line is about: a service or category name; null = the default %. */
  const label = (s: RateSource) =>
    s.kind === "service"
      ? (serviceName.get(s.id) ?? "—")
      : s.kind === "category"
        ? (categoryName.get(s.id) ?? "—")
        : null;

  return {
    ...result,
    staff: result.staff.map((s) => ({ ...s, lines: s.lines.map((l) => ({ ...l, label: label(l.source) })) })),
  };
}

export type LoadedPayroll = Awaited<ReturnType<typeof loadPayroll>>;

/** Everything the "pay settings" page edits. */
export async function loadPaySettings(db: Db, tenantId: string, locale: string) {
  const [staff, pay, rates, services, categories] = await Promise.all([
    db
      .from("staff")
      .select("id, display_name, active, commission_pct")
      .eq("tenant_id", tenantId)
      .order("active", { ascending: false })
      .order("sort_order"),
    db.from("staff_pay").select("staff_id, salary_minor").eq("tenant_id", tenantId),
    db
      .from("staff_pay_rates")
      .select("id, staff_id, category_id, service_id, pct")
      .eq("tenant_id", tenantId)
      .order("created_at"),
    db
      .from("services")
      .select("id, name_i18n, category_id, active")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    db.from("service_categories").select("id, name_i18n").eq("tenant_id", tenantId).order("sort_order"),
  ]);
  const salary = new Map((pay.data ?? []).map((p) => [p.staff_id, p.salary_minor]));
  return {
    staff: (staff.data ?? []).map((s) => ({
      id: s.id,
      name: s.display_name,
      active: s.active,
      defaultPct: Number(s.commission_pct),
      salaryMinor: salary.get(s.id) ?? 0,
      rates: (rates.data ?? [])
        .filter((r) => r.staff_id === s.id)
        .map((r) => ({ id: r.id, categoryId: r.category_id, serviceId: r.service_id, pct: Number(r.pct) })),
    })),
    services: (services.data ?? [])
      .filter((s) => s.active)
      .map((s) => ({ id: s.id, name: localized(s.name_i18n, locale), categoryId: s.category_id })),
    categories: (categories.data ?? []).map((c) => ({ id: c.id, name: localized(c.name_i18n, locale) })),
  };
}

export type PaySettings = Awaited<ReturnType<typeof loadPaySettings>>;
