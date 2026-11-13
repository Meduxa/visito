import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTenant, createUser, type TestTenant, type TestUser } from "./helpers";

// Decision 033: Visito's SMS texts — only platform admins read and write them.
let A: TestTenant;
let platform: TestUser;
// a rarely used row, removed again at the end (the dev project's real texts stay)
const row = { type: "cancelled", locale: "ru" } as const;
let before: string | null = null;

beforeAll(async () => {
  A = await createTenant("pst", "salon");
  platform = await createUser("pst-platform");
  await admin().from("platform_admins").insert({ user_id: platform.id });
  before =
    (await admin().from("sms_platform_templates").select("body").match(row).maybeSingle()).data?.body ?? null;
}, 120_000);
afterAll(async () => {
  if (before === null) await admin().from("sms_platform_templates").delete().match(row);
  else
    await admin()
      .from("sms_platform_templates")
      .upsert({ ...row, body: before });
  await admin().from("platform_admins").delete().eq("user_id", platform.id);
  await cleanup();
}, 60_000);

describe("platform SMS texts (033)", () => {
  it("a platform admin writes and reads them", async () => {
    const w = await platform.db
      .from("sms_platform_templates")
      .upsert({ ...row, body: "{business_name}: test" });
    expect(w.error).toBeNull();
    const r = await platform.db.from("sms_platform_templates").select("body").match(row).single();
    expect(r.data?.body).toBe("{business_name}: test");
  });

  it("business owners, staff and anonymous visitors can neither read nor write", async () => {
    for (const db of [A.owner.db, A.staff.db, anon()]) {
      expect((await db.from("sms_platform_templates").select("body")).data ?? []).toEqual([]);
      expect(
        (await db.from("sms_platform_templates").upsert({ ...row, body: "hacked" })).error,
      ).not.toBeNull();
    }
    expect((await admin().from("sms_platform_templates").select("body").match(row).single()).data?.body).toBe(
      "{business_name}: test",
    );
  });

  it("only known messages and languages are accepted", async () => {
    const bad = await platform.db
      .from("sms_platform_templates")
      .insert({ type: "promo", locale: "ka", body: "x" });
    expect(bad.error).not.toBeNull();
  });
});
