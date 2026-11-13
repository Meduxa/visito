import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTenant, type TestTenant } from "./helpers";

// Decision 032: branches — plan limit, per-branch services/prices, tenant isolation.
let a: TestTenant;
let b: TestTenant;
let service: string;
let staff: string;
let branch2: string;
const at = (hhmm: string) => `2033-04-04T${hhmm}:00+04:00`;

beforeAll(async () => {
  [a, b] = await Promise.all([createTenant("bra", "salon"), createTenant("brb", "salon")]);
  const db = admin();
  await db.from("tenants").update({ plan: "pro" }).eq("id", a.id); // Standard: 3 branches
  service = (
    await db
      .from("services")
      .insert({ tenant_id: a.id, name_i18n: { ka: "შეჭრა" }, price_minor: 3000, duration_min: 30 })
      .select("id")
      .single()
  ).data!.id;
  staff = (await db.from("staff").insert({ tenant_id: a.id, display_name: "S" }).select("id").single()).data!
    .id;
  await db.from("staff_services").insert({ tenant_id: a.id, staff_id: staff, service_id: service });
}, 120_000);
afterAll(cleanup, 60_000);

describe("branches (032)", () => {
  it("owner adds branches up to the plan's limit", async () => {
    const r = await a.owner.db
      .from("locations")
      .insert({ tenant_id: a.id, name: "Vake", slug: "vake" })
      .select("id")
      .single();
    expect(r.error).toBeNull();
    branch2 = r.data!.id;
    expect(
      (await a.owner.db.from("locations").insert({ tenant_id: a.id, name: "Saburtalo" })).error,
    ).toBeNull();
    const over = await a.owner.db.from("locations").insert({ tenant_id: a.id, name: "Fourth" });
    expect(over.error?.code).toBe("P0006");
  });

  it("staff and other businesses cannot add or read them", async () => {
    expect((await a.staff.db.from("locations").insert({ tenant_id: a.id, name: "X" })).error).not.toBeNull();
    expect((await b.owner.db.from("locations").insert({ tenant_id: a.id, name: "X" })).error).not.toBeNull();
    expect((await b.owner.db.from("locations").select("id").eq("id", branch2)).data).toHaveLength(0);
  });

  it("branch services: only managers of the business set them; others cannot see them", async () => {
    const rows = [{ service_id: service, offered: true, price_minor: 4500 }];
    expect(
      (await b.owner.db.rpc("set_location_services", { p_location: branch2, p_rows: rows })).error,
    ).not.toBeNull();
    expect(
      (await a.staff.db.rpc("set_location_services", { p_location: branch2, p_rows: rows })).error,
    ).not.toBeNull();
    expect(
      (await a.owner.db.rpc("set_location_services", { p_location: branch2, p_rows: rows })).error,
    ).toBeNull();
    expect((await b.owner.db.from("service_locations").select("id")).data ?? []).toHaveLength(0);
  });

  it("a booking in the branch takes the branch price; another business's branch is refused", async () => {
    const r = await a.owner.db.rpc("create_booking", {
      p_tenant: a.id,
      p_client: null as unknown as string,
      p_items: [{ service_id: service, staff_id: staff, starts_at: at("10:00") }],
      p_location: branch2,
    });
    expect(r.error).toBeNull();
    const bk = await admin().from("bookings").select("location_id, total_minor").eq("id", r.data!).single();
    expect(bk.data).toEqual({ location_id: branch2, total_minor: 4500 });
    const bLoc = (await admin().from("locations").select("id").eq("tenant_id", b.id).single()).data!.id;
    const wrong = await a.owner.db.rpc("create_booking", {
      p_tenant: a.id,
      p_client: null as unknown as string,
      p_items: [{ service_id: service, staff_id: staff, starts_at: at("12:00") }],
      p_location: bLoc,
    });
    expect(wrong.error?.code).toBe("P0002");
  });

  it("a service switched off in the branch cannot be booked there", async () => {
    await a.owner.db.rpc("set_location_services", {
      p_location: branch2,
      p_rows: [{ service_id: service, offered: false }],
    });
    const r = await a.owner.db.rpc("create_booking", {
      p_tenant: a.id,
      p_client: null as unknown as string,
      p_items: [{ service_id: service, staff_id: staff, starts_at: at("14:00") }],
      p_location: branch2,
    });
    expect(r.error?.code).toBe("P0003");
  });
});
