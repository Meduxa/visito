import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTenant, type TestTenant } from "./helpers";

// Clients section (decision 024): the client_list view adds visit numbers and
// an automatic group to every client. It reads with the caller's own rights
// (security_invoker) and returns money only to people who may see revenue.
type W = {
  t: TestTenant;
  staffMine: string;
  regular: string; // 2 completed (100 + 50 ₾), 1 upcoming, 1 cancelled — booked with another specialist
  mine: string; // 1 completed with the staff member's own specialist profile
  atRisk: string; // last visit 100 days ago
  lost: string; // last visit 200 days ago
  vip: string; // 5 recent visits
};

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const phone = () => `+99559${Math.floor(1e6 + Math.random() * 8e6)}`;

async function world(label: string): Promise<W> {
  const t = await createTenant(label, "salon");
  const db = admin();
  const staff = async (name: string) =>
    (await db.from("staff").insert({ tenant_id: t.id, display_name: name }).select("id").single()).data!.id;
  const staffMine = await staff(`Mine ${label}`);
  const staffOther = await staff(`Other ${label}`);
  await db
    .from("memberships")
    .update({ staff_id: staffMine })
    .eq("tenant_id", t.id)
    .eq("user_id", t.staff.id);
  const service = (
    await db
      .from("services")
      .insert({ tenant_id: t.id, name_i18n: { ka: "შეჭრა" }, price_minor: 5000, duration_min: 60 })
      .select("id")
      .single()
  ).data!.id;
  const client = async (name: string) =>
    (
      await db
        .from("clients")
        .insert({ tenant_id: t.id, first_name: name, phone_e164: phone() })
        .select("id")
        .single()
    ).data!.id;

  // a visit `days` ago (negative: in the future), with one item for that specialist
  const visit = async (
    clientId: string,
    days: number,
    status: string,
    totalMinor: number,
    staffId = staffOther,
  ) => {
    const start = daysAgo(days);
    const end = new Date(new Date(start).getTime() + 3_600_000).toISOString();
    const b = await db
      .from("bookings")
      .insert({
        tenant_id: t.id,
        client_id: clientId,
        starts_at: start,
        ends_at: end,
        status,
        total_minor: totalMinor,
        created_at: daysAgo(Math.max(days, 0) + 1),
      })
      .select("id")
      .single();
    if (b.error) throw new Error(`booking: ${b.error.message}`);
    const i = await db.from("booking_items").insert({
      tenant_id: t.id,
      booking_id: b.data.id,
      service_id: service,
      staff_id: staffId,
      name_snapshot: "შეჭრა",
      price_type_snapshot: "fixed",
      price_minor_snapshot: totalMinor,
      duration_min_snapshot: 60,
      starts_at: start,
      ends_at: end,
      blocked_until: end,
      active: !["completed", "cancelled_by_client", "cancelled_by_business", "no_show"].includes(status),
    });
    if (i.error) throw new Error(`item: ${i.error.message}`);
  };

  const regular = await client(`Regular ${label}`);
  await visit(regular, 40, "completed", 10000);
  await visit(regular, 10, "completed", 5000);
  await visit(regular, -5, "confirmed", 5000);
  await visit(regular, 20, "cancelled_by_client", 5000);
  const mine = await client(`Mine ${label}`);
  await visit(mine, 3, "completed", 7000, staffMine);
  const atRisk = await client(`AtRisk ${label}`);
  await visit(atRisk, 150, "completed", 5000);
  await visit(atRisk, 100, "completed", 5000);
  const lost = await client(`Lost ${label}`);
  await visit(lost, 200, "completed", 5000);
  const vip = await client(`Vip ${label}`);
  for (const d of [50, 40, 30, 20, 10]) await visit(vip, d, "completed", 4000);
  return { t, staffMine, regular, mine, atRisk, lost, vip };
}

let A: W;
let B: W;
beforeAll(async () => {
  A = await world("cla");
  B = await world("clb");
  // the staff member may see only their own clients
  await admin().from("tenant_settings").update({ staff_sees_all_clients: false }).eq("tenant_id", A.t.id);
}, 120_000);
afterAll(async () => {
  await cleanup();
});

const row = async (user: TestTenant["owner"], id: string) => {
  const { data, error } = await user.db.from("client_list").select("*").eq("id", id);
  expect(error).toBeNull();
  return data?.[0] ?? null;
};

describe("client_list numbers", () => {
  it("owner sees visits, last/next visit, cancellations, spent and average", async () => {
    const r = await row(A.t.owner, A.regular);
    expect(r).toMatchObject({
      visits: 2,
      cancellations: 1,
      spent_minor: 15000,
      average_minor: 7500,
      segment: "regular",
    });
    expect(new Date(r!.last_visit_at!).getTime()).toBeLessThan(Date.now());
    expect(new Date(r!.next_visit_at!).getTime()).toBeGreaterThan(Date.now());
  });

  it("groups: new, regular, VIP, at risk, lost", async () => {
    const seg = async (id: string) => (await row(A.t.owner, id))!.segment;
    expect(await seg(A.mine)).toBe("new");
    expect(await seg(A.regular)).toBe("regular");
    expect(await seg(A.vip)).toBe("vip");
    expect(await seg(A.atRisk)).toBe("at_risk");
    expect(await seg(A.lost)).toBe("lost");
  });

  it("admins get no money when the owner hides revenue from them", async () => {
    expect((await row(A.t.adminUser, A.regular))!.spent_minor).toBe(15000);
    await admin().from("tenant_settings").update({ admins_see_revenue: false }).eq("tenant_id", A.t.id);
    try {
      const r = await row(A.t.adminUser, A.regular);
      expect(r).toMatchObject({ visits: 2, spent_minor: null, average_minor: null });
    } finally {
      await admin().from("tenant_settings").update({ admins_see_revenue: true }).eq("tenant_id", A.t.id);
    }
  });

  it("staff see only their own clients, and no money", async () => {
    const mine = await row(A.t.staff, A.mine);
    expect(mine).toMatchObject({ visits: 1, spent_minor: null, average_minor: null });
    expect(await row(A.t.staff, A.regular)).toBeNull();
  });
});

describe("client_list isolation", () => {
  it("another business sees none of these clients", async () => {
    for (const u of [B.t.owner, B.t.adminUser, B.t.staff]) {
      const { data } = await u.db.from("client_list").select("id").in("id", [A.regular, A.vip, A.mine]);
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("a business's own list holds only its own clients", async () => {
    const { data } = await A.t.owner.db.from("client_list").select("tenant_id");
    expect(new Set((data ?? []).map((r) => r.tenant_id))).toEqual(new Set([A.t.id]));
  });

  it("anon sees nothing", async () => {
    const { data } = await anon().from("client_list").select("id").limit(5);
    expect(data ?? []).toHaveLength(0);
  });

  it("anon cannot ask whether someone may see revenue", async () => {
    const { error } = await anon().rpc("can_see_revenue", { p_tenant: A.t.id });
    expect(error).not.toBeNull();
  });
});
