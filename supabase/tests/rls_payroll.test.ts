import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTenant, type TestTenant } from "./helpers";

// Payroll (decision 025): pay tables are for the owner, and for admins while
// "admins see revenue" is on — and only while the business's plan includes
// payroll. Staff never read them; other businesses never see them.
type W = { t: TestTenant; staffId: string; adjId: string; payoutId: string };

const TABLES = ["staff_pay", "staff_pay_rates", "pay_adjustments", "payouts"] as const;

async function world(label: string): Promise<W> {
  const t = await createTenant(label, "salon");
  const db = admin();
  const staffId = (
    await db
      .from("staff")
      .insert({ tenant_id: t.id, display_name: `Pay ${label}` })
      .select("id")
      .single()
  ).data!.id;
  const category = (
    await db
      .from("service_categories")
      .insert({ tenant_id: t.id, name_i18n: { ka: "თმა" } })
      .select("id")
      .single()
  ).data!.id;
  await db.from("staff_pay").insert({ tenant_id: t.id, staff_id: staffId, salary_minor: 50000 });
  await db
    .from("staff_pay_rates")
    .insert({ tenant_id: t.id, staff_id: staffId, category_id: category, pct: 40 });
  const adjId = (
    await db
      .from("pay_adjustments")
      .insert({ tenant_id: t.id, staff_id: staffId, month: "2026-11-01", kind: "bonus", amount_minor: 2000 })
      .select("id")
      .single()
  ).data!.id;
  const payoutId = (
    await db
      .from("payouts")
      .insert({
        tenant_id: t.id,
        staff_id: staffId,
        month: "2026-11-01",
        amount_minor: 10000,
        method: "cash",
        paid_on: "2026-11-30",
      })
      .select("id")
      .single()
  ).data!.id;
  return { t, staffId, adjId, payoutId };
}

let a: W;
let b: W;

beforeAll(async () => {
  [a, b] = await Promise.all([world("paya"), world("payb")]);
}, 120_000);
afterAll(cleanup, 60_000);

const count = async (db: TestTenant["owner"]["db"], table: (typeof TABLES)[number], tenant: string) =>
  (await db.from(table).select("tenant_id").eq("tenant_id", tenant)).data?.length ?? 0;

describe("payroll RLS", () => {
  it("the owner reads and writes their own pay tables (trial includes payroll)", async () => {
    for (const table of TABLES) expect(await count(a.t.owner.db, table, a.t.id)).toBe(1);
    const add = await a.t.owner.db
      .from("pay_adjustments")
      .insert({
        tenant_id: a.t.id,
        staff_id: a.staffId,
        month: "2026-11-01",
        kind: "deduction",
        amount_minor: 500,
        note: "late",
      })
      .select("id")
      .single();
    expect(add.error).toBeNull();
    const del = await a.t.owner.db.from("pay_adjustments").delete().eq("id", add.data!.id).select("id");
    expect(del.data).toHaveLength(1);
  });

  it("another business sees nothing and cannot write in", async () => {
    for (const table of TABLES) expect(await count(b.t.owner.db, table, a.t.id)).toBe(0);
    const ins = await b.t.owner.db.from("payouts").insert({
      tenant_id: a.t.id,
      staff_id: a.staffId,
      month: "2026-11-01",
      amount_minor: 1,
      method: "cash",
      paid_on: "2026-11-30",
    });
    expect(ins.error).not.toBeNull();
    const upd = await b.t.owner.db
      .from("payouts")
      .update({ amount_minor: 1 })
      .eq("id", a.payoutId)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);
    const del = await b.t.owner.db.from("pay_adjustments").delete().eq("id", a.adjId).select("id");
    expect(del.data ?? []).toHaveLength(0);
    // own staff id with the other business's tenant: the foreign key refuses it
    const cross = await b.t.owner.db
      .from("staff_pay")
      .insert({ tenant_id: b.t.id, staff_id: a.staffId, salary_minor: 1 });
    expect(cross.error).not.toBeNull();
  });

  it("staff never read or write pay", async () => {
    for (const table of TABLES) expect(await count(a.t.staff.db, table, a.t.id)).toBe(0);
    const ins = await a.t.staff.db.from("pay_adjustments").insert({
      tenant_id: a.t.id,
      staff_id: a.staffId,
      month: "2026-11-01",
      kind: "bonus",
      amount_minor: 100000,
    });
    expect(ins.error).not.toBeNull();
    const upd = await a.t.staff.db
      .from("staff_pay")
      .update({ salary_minor: 9 })
      .eq("staff_id", a.staffId)
      .select();
    expect(upd.data ?? []).toHaveLength(0);
  });

  it("admins only while they may see revenue", async () => {
    expect(await count(a.t.adminUser.db, "payouts", a.t.id)).toBe(1);
    await admin().from("tenant_settings").update({ admins_see_revenue: false }).eq("tenant_id", a.t.id);
    try {
      for (const table of TABLES) expect(await count(a.t.adminUser.db, table, a.t.id)).toBe(0);
      const ins = await a.t.adminUser.db.from("payouts").insert({
        tenant_id: a.t.id,
        staff_id: a.staffId,
        month: "2026-11-01",
        amount_minor: 1,
        method: "cash",
        paid_on: "2026-11-30",
      });
      expect(ins.error).not.toBeNull();
    } finally {
      await admin().from("tenant_settings").update({ admins_see_revenue: true }).eq("tenant_id", a.t.id);
    }
  });

  it("a plan without payroll locks the tables (rows are kept)", async () => {
    await admin().from("tenants").update({ plan: "start" }).eq("id", b.t.id);
    const { data: has } = await b.t.owner.db.rpc("tenant_has_feature", {
      p_tenant: b.t.id,
      p_feature: "payroll",
    });
    expect(has).toBe(false);
    for (const table of TABLES) expect(await count(b.t.owner.db, table, b.t.id)).toBe(0);
    const ins = await b.t.owner.db.from("staff_pay_rates").insert({
      tenant_id: b.t.id,
      staff_id: b.staffId,
      service_id: null,
      category_id: null,
      pct: 10,
    });
    expect(ins.error).not.toBeNull();
    // back on a plan with payroll: everything is there again
    await admin().from("tenants").update({ plan: "pro" }).eq("id", b.t.id);
    for (const table of TABLES) expect(await count(b.t.owner.db, table, b.t.id)).toBe(1);
  });

  it("every change is in the audit log", async () => {
    const { data } = await admin()
      .from("audit_log")
      .select("action")
      .eq("tenant_id", a.t.id)
      .like("action", "payroll.%");
    const actions = (data ?? []).map((r) => r.action);
    expect(actions).toContain("payroll.payouts.insert");
    expect(actions).toContain("payroll.pay_adjustments.delete");
  });

  it("anonymous visitors get nothing", async () => {
    for (const table of TABLES) {
      const { data } = await anon().from(table).select("tenant_id");
      expect(data ?? []).toHaveLength(0);
    }
    const { error } = await anon().rpc("tenant_has_feature", { p_tenant: a.t.id, p_feature: "payroll" });
    expect(error).not.toBeNull();
  });
});
