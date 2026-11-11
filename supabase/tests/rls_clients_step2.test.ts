import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTenant, type TestTenant } from "./helpers";

// Clients step 2 (decision 026): own fields per business, values on the client
// card, group thresholds as a setting, erase and merge include own fields.
let a: TestTenant;
let b: TestTenant;
let aStaffId: string;

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const phone = () => `+99559${Math.floor(1e6 + Math.random() * 8e6)}`;

async function client(t: TestTenant, name: string, custom: Record<string, unknown> = {}) {
  const r = await admin()
    .from("clients")
    .insert({ tenant_id: t.id, first_name: name, phone_e164: phone(), custom: custom as never })
    .select("id")
    .single();
  if (r.error) throw new Error(r.error.message);
  return r.data.id;
}

async function visit(t: TestTenant, clientId: string, days: number) {
  const start = daysAgo(days);
  const b = await admin()
    .from("bookings")
    .insert({
      tenant_id: t.id,
      client_id: clientId,
      starts_at: start,
      ends_at: new Date(new Date(start).getTime() + 3_600_000).toISOString(),
      status: "completed",
    })
    .select("id")
    .single();
  if (b.error) throw new Error(b.error.message);
}

beforeAll(async () => {
  [a, b] = await Promise.all([createTenant("csa", "salon"), createTenant("csb", "salon")]);
  aStaffId = (
    await admin().from("staff").insert({ tenant_id: a.id, display_name: "S" }).select("id").single()
  ).data!.id;
  await admin()
    .from("memberships")
    .update({ staff_id: aStaffId })
    .eq("tenant_id", a.id)
    .eq("user_id", a.staff.id);
}, 120_000);
afterAll(cleanup, 60_000);

describe("own client fields", () => {
  it("owner and admin define fields; staff only read them", async () => {
    const own = await a.owner.db
      .from("client_fields")
      .insert({ tenant_id: a.id, label: "თმის ტიპი", kind: "choice", options: ["მშრალი", "ცხიმიანი"] })
      .select("id")
      .single();
    expect(own.error).toBeNull();
    const adm = await a.adminUser.db
      .from("client_fields")
      .insert({ tenant_id: a.id, label: "ფორმულა", kind: "text" })
      .select("id")
      .single();
    expect(adm.error).toBeNull();
    const staffWrite = await a.staff.db
      .from("client_fields")
      .insert({ tenant_id: a.id, label: "x", kind: "text" });
    expect(staffWrite.error).not.toBeNull();
    const staffRead = await a.staff.db.from("client_fields").select("id").eq("tenant_id", a.id);
    expect(staffRead.data).toHaveLength(2);
    const upd = await a.staff.db
      .from("client_fields")
      .update({ label: "hack" })
      .eq("id", own.data!.id)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);
  });

  it("another business neither sees nor changes them", async () => {
    expect((await b.owner.db.from("client_fields").select("id").eq("tenant_id", a.id)).data).toHaveLength(0);
    const ins = await b.owner.db.from("client_fields").insert({ tenant_id: a.id, label: "x", kind: "text" });
    expect(ins.error).not.toBeNull();
    const del = await b.owner.db.from("client_fields").delete().eq("tenant_id", a.id).select("id");
    expect(del.data ?? []).toHaveLength(0);
    expect((await anon().from("client_fields").select("id")).data ?? []).toHaveLength(0);
  });

  it("a choice field needs options; at most 20 fields", async () => {
    const bad = await b.owner.db
      .from("client_fields")
      .insert({ tenant_id: b.id, label: "x", kind: "choice" });
    expect(bad.error).not.toBeNull();
    const rows = Array.from({ length: 20 }, (_, i) => ({ tenant_id: b.id, label: `f${i}`, kind: "text" }));
    expect((await b.owner.db.from("client_fields").insert(rows)).error).toBeNull();
    const extra = await b.owner.db
      .from("client_fields")
      .insert({ tenant_id: b.id, label: "21", kind: "text" });
    expect(extra.error?.code).toBe("P0006");
  });

  it("removing a field removes its values from every card", async () => {
    const f = (
      await a.owner.db
        .from("client_fields")
        .insert({ tenant_id: a.id, label: "temp", kind: "yesno" })
        .select("id")
        .single()
    ).data!.id;
    const c = await client(a, "Field", { [f]: true, keep: "x" });
    await a.owner.db.from("client_fields").delete().eq("id", f);
    const { data } = await admin().from("clients").select("custom").eq("id", c).single();
    expect(data!.custom).toEqual({ keep: "x" });
  });

  it("erasing a client clears own fields; merging keeps both cards' values", async () => {
    const erased = await client(a, "Erase", { x: "secret" });
    expect((await a.owner.db.rpc("anonymize_client", { p_client: erased })).error).toBeNull();
    expect((await admin().from("clients").select("custom").eq("id", erased).single()).data!.custom).toEqual(
      {},
    );

    const keep = await client(a, "Keep", { x: "keep", y: "k" });
    const drop = await client(a, "Drop", { x: "drop", z: "d" });
    expect((await a.owner.db.rpc("merge_clients", { p_keep: keep, p_remove: drop })).error).toBeNull();
    expect((await admin().from("clients").select("custom").eq("id", keep).single()).data!.custom).toEqual({
      x: "keep",
      y: "k",
      z: "d",
    });
  });
});

describe("group thresholds", () => {
  it("groups follow the business's own numbers; staff cannot change them", async () => {
    const c = await client(a, "Thirty");
    await visit(a, c, 30);
    await visit(a, c, 40);
    const seg = async () =>
      (await a.owner.db.from("client_list").select("segment").eq("id", c).single()).data!.segment;
    expect(await seg()).toBe("regular"); // 30 days < 60

    const set = await a.owner.db
      .from("tenant_settings")
      .update({ segment_at_risk_days: 20, segment_lost_days: 90 })
      .eq("tenant_id", a.id)
      .select("tenant_id");
    expect(set.data).toHaveLength(1);
    expect(await seg()).toBe("at_risk");

    await a.owner.db
      .from("tenant_settings")
      .update({ segment_at_risk_days: 60, segment_lost_days: 180, segment_vip_visits: 2 })
      .eq("tenant_id", a.id);
    expect(await seg()).toBe("vip");

    const staff = await a.staff.db
      .from("tenant_settings")
      .update({ segment_vip_visits: 99 })
      .eq("tenant_id", a.id)
      .select("tenant_id");
    expect(staff.data ?? []).toHaveLength(0);
    // "lost" must come after "at risk"
    const bad = await a.owner.db
      .from("tenant_settings")
      .update({ segment_at_risk_days: 100, segment_lost_days: 90 })
      .eq("tenant_id", a.id);
    expect(bad.error).not.toBeNull();
  });

  it("another business's settings don't change this one's groups", async () => {
    await b.owner.db.from("tenant_settings").update({ segment_vip_visits: 2 }).eq("tenant_id", a.id);
    const { data } = await admin()
      .from("tenant_settings")
      .select("segment_vip_visits")
      .eq("tenant_id", a.id)
      .single();
    expect(data!.segment_vip_visits).toBe(2); // set by a's owner above, untouched by b
    await b.owner.db.from("tenant_settings").update({ segment_vip_visits: 50 }).eq("tenant_id", a.id);
    const after = await admin()
      .from("tenant_settings")
      .select("segment_vip_visits")
      .eq("tenant_id", a.id)
      .single();
    expect(after.data!.segment_vip_visits).toBe(2);
  });
});
