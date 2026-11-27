import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const owners: Record<string, { user_id: string }[]> = {
  demo: [{ user_id: "u-demo" }],
  real: [{ user_id: "u-real" }],
  mixed: [{ user_id: "u-demo" }, { user_id: "u-real" }],
  orphan: [],
};
const emails: Record<string, string> = { "u-demo": "salon.owner@demo.test", "u-real": "nino@gmail.com" };
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      let tenant = "";
      const q = {
        select: () => q,
        eq: (col: string, v: string) => {
          if (col === "tenant_id") tenant = v;
          return col === "role" ? Promise.resolve({ data: owners[tenant] }) : q;
        },
      };
      return q;
    },
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: emails[id] } } }) } },
  }),
}));

const { isSandboxTenant, isTestEmail } = await import("./sandbox");

describe("demo and test businesses never send real SMS", () => {
  it("recognises the reserved test addresses only", () => {
    for (const e of ["salon.owner@demo.test", "a-b@example.test", "x@example.com", "X@DEMO.TEST"])
      expect(isTestEmail(e)).toBe(true);
    for (const e of ["nino@gmail.com", "info@medic.ge", "a@test.ge", "a@contest.com", "", null])
      expect(isTestEmail(e)).toBe(false);
  });

  it("a business is a demo only when every owner is a test account (or it has none)", async () => {
    expect(await isSandboxTenant("demo")).toBe(true);
    expect(await isSandboxTenant("real")).toBe(false);
    expect(await isSandboxTenant("mixed")).toBe(false);
    expect(await isSandboxTenant("orphan")).toBe(true);
  });
});
