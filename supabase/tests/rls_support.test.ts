import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTenant, createUser, type TestTenant, type TestUser } from "./helpers";

// Support access (SPEC 4.15): view only, only with the owner's consent, time-limited, logged.
let A: TestTenant;
let B: TestTenant;
let D: TestTenant;
let platform: TestUser;
let clientA: string;
let clientD: string;
const server = () => admin();

const addClient = async (t: TestTenant, name: string) =>
  (await server().from("clients").insert({ tenant_id: t.id, first_name: name }).select("id").single()).data!
    .id;
const seeClients = async (u: TestUser, t: TestTenant) =>
  ((await u.db.from("clients").select("id").eq("tenant_id", t.id)).data ?? []).length;
const audit = async (t: TestTenant, action: string) =>
  ((await server().from("audit_log").select("id").eq("tenant_id", t.id).eq("action", action)).data ?? [])
    .length;

beforeAll(async () => {
  A = await createTenant("supA", "salon");
  B = await createTenant("supB", "salon");
  D = await createTenant("supD", "dental");
  platform = await createUser("support");
  await server().from("platform_admins").insert({ user_id: platform.id });
  clientA = await addClient(A, "Ana");
  await addClient(B, "Bela");
  clientD = await addClient(D, "Dato");
});
afterAll(async () => {
  await server().from("platform_admins").delete().eq("user_id", platform.id);
  await cleanup();
});

describe("support access", () => {
  it("without the owner's consent Visito sees nothing and cannot open the view", async () => {
    expect(await seeClients(platform, A)).toBe(0);
    expect((await platform.db.rpc("start_support_view", { p_tenant: A.id })).error?.code).toBe("42501");
  });

  it("only the owner of that business can allow it, for 24 or 72 hours", async () => {
    const grant = (u: TestUser, hours = 24, tenant = A.id) =>
      u.db.rpc("grant_support_access", { p_tenant: tenant, p_hours: hours });
    expect((await grant(A.adminUser)).error?.code).toBe("42501");
    expect((await grant(A.staff)).error?.code).toBe("42501");
    expect((await grant(B.owner)).error?.code).toBe("42501");
    expect((await grant(platform)).error?.code).toBe("42501");
    expect((await grant(A.owner, 5)).error).not.toBeNull();
    expect(
      (
        await A.owner.db
          .from("support_grants")
          .insert({ tenant_id: A.id, expires_at: new Date(Date.now() + 1e9).toISOString() })
      ).error,
    ).not.toBeNull();
    expect((await grant(A.owner)).error).toBeNull();
    expect(await audit(A, "support.granted")).toBe(1);
    // the owner sees the grant; the team and other businesses do not
    expect((await A.owner.db.from("support_grants").select("id").eq("tenant_id", A.id)).data).toHaveLength(1);
    expect((await A.adminUser.db.from("support_grants").select("id")).data).toEqual([]);
    expect((await B.owner.db.from("support_grants").select("id").eq("tenant_id", A.id)).data).toEqual([]);
  });

  it("with consent: Visito views that business only, and the visit is logged", async () => {
    expect((await platform.db.rpc("start_support_view", { p_tenant: A.id })).error).toBeNull();
    expect(await audit(A, "support.viewed")).toBe(1);
    expect(await seeClients(platform, A)).toBe(1);
    expect(await seeClients(platform, B)).toBe(0);
    expect((await platform.db.from("bookings").select("id").eq("tenant_id", B.id)).data).toEqual([]);
    // read functions work when called as a read
    expect((await platform.db.rpc("sms_balance", { p_tenant: A.id }, { get: true })).error).toBeNull();
    expect((await platform.db.rpc("sms_balance", { p_tenant: B.id }, { get: true })).error?.code).toBe(
      "42501",
    );
  });

  it("with consent Visito still cannot change anything", async () => {
    expect(
      (await platform.db.from("clients").insert({ tenant_id: A.id, first_name: "X" })).error,
    ).not.toBeNull();
    await platform.db.from("clients").update({ first_name: "Changed" }).eq("id", clientA);
    expect(
      (await server().from("clients").select("first_name").eq("id", clientA).single()).data!.first_name,
    ).toBe("Ana");
    await platform.db.from("services").delete().eq("tenant_id", A.id);
    expect(
      (await platform.db.rpc("log_audit", { p_tenant: A.id, p_action: "x", p_entity: "x" })).error?.code,
    ).toBe("42501");
    expect((await platform.db.rpc("anonymize_client", { p_client: clientA })).error).not.toBeNull();
    expect((await platform.db.rpc("grant_support_access", { p_tenant: A.id, p_hours: 72 })).error?.code).toBe(
      "42501",
    );
    expect((await platform.db.rpc("revoke_support_access", { p_tenant: A.id })).error?.code).toBe("42501");
    // even a "read" request cannot write
    expect(
      (await platform.db.rpc("log_audit", { p_tenant: A.id, p_action: "x", p_entity: "x" }, { get: true }))
        .error,
    ).not.toBeNull();
    expect(await audit(A, "x")).toBe(0);
  });

  it("dental treatment notes stay hidden from support", async () => {
    expect((await D.owner.db.rpc("grant_support_access", { p_tenant: D.id, p_hours: 24 })).error).toBeNull();
    expect(await seeClients(platform, D)).toBe(1);
    expect(
      (await platform.db.rpc("read_dental_notes", { p_client: clientD }, { get: true })).error,
    ).not.toBeNull();
    expect((await platform.db.from("dental_notes").select("id").eq("tenant_id", D.id)).data ?? []).toEqual(
      [],
    );
  });

  it("the owner can end it at any time; expired access ends by itself", async () => {
    expect((await A.owner.db.rpc("revoke_support_access", { p_tenant: A.id })).error).toBeNull();
    expect(await audit(A, "support.revoked")).toBe(1);
    expect(await seeClients(platform, A)).toBe(0);
    expect((await platform.db.rpc("start_support_view", { p_tenant: A.id })).error?.code).toBe("42501");

    await server()
      .from("support_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("tenant_id", D.id);
    await server()
      .from("support_grants")
      .insert({
        tenant_id: D.id,
        created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        expires_at: new Date(Date.now() - 86_400_000).toISOString(),
      });
    expect(await seeClients(platform, D)).toBe(0);
  });
});
