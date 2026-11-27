// Removing someone from the team (test plan #66): after the owner removes a
// member, that person can no longer read anything of the business; admins and
// staff cannot remove anyone; the owner cannot remove themselves.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTenant, type TestTenant } from "./helpers";

let A: TestTenant;

beforeAll(async () => {
  A = await createTenant("rm", "salon");
});

afterAll(async () => {
  await cleanup();
});

describe("removing a team member", () => {
  it("admin and staff cannot remove anyone, the owner not themselves", async () => {
    for (const user of [A.adminUser, A.staff]) {
      await user.db.from("memberships").delete().eq("tenant_id", A.id).eq("user_id", A.owner.id);
    }
    await A.owner.db.from("memberships").delete().eq("tenant_id", A.id).eq("user_id", A.owner.id);
    const { data } = await admin().from("memberships").select("id").eq("tenant_id", A.id);
    expect(data?.length).toBe(3);
  });

  it("a removed member loses access, and it is audited", async () => {
    const before = await A.staff.db.from("tenants").select("id").eq("id", A.id);
    expect(before.data?.length).toBe(1);

    const { data: removed } = await A.owner.db
      .from("memberships")
      .delete()
      .eq("tenant_id", A.id)
      .eq("user_id", A.staff.id)
      .select("id");
    expect(removed?.length).toBe(1);

    const after = await A.staff.db.from("tenants").select("id").eq("id", A.id);
    expect(after.data ?? []).toEqual([]);
    const clients = await A.staff.db.from("clients").select("id").eq("tenant_id", A.id);
    expect(clients.data ?? []).toEqual([]);

    const { data: log } = await A.owner.db
      .from("audit_log")
      .select("action")
      .eq("tenant_id", A.id)
      .eq("action", "membership.removed");
    expect(log?.length).toBe(1);
  });
});
