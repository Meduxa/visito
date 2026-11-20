import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTenant, type TestTenant } from "./helpers";

// "Additional service not added" (decision 037): an online visit whose service
// requires an additional one shows a bell notice until staff add it with
// add_booking_item. A business only ever touches its own visits.
type W = { t: TestTenant; staff: string; colour: string; dry: string; booking: string };

const phone = () => `+99557${Math.floor(1e6 + Math.random() * 8e6)}`;
const day = () => `2031-05-0${1 + Math.floor(Math.random() * 8)}`;

async function world(label: string): Promise<W> {
  const t = await createTenant(label, "salon");
  const db = admin();
  const staff = (
    await db
      .from("staff")
      .insert({ tenant_id: t.id, display_name: `S ${label}` })
      .select("id")
      .single()
  ).data!.id;
  await db.from("memberships").update({ staff_id: staff }).eq("tenant_id", t.id).eq("user_id", t.staff.id);
  await db.from("tenant_settings").update({ online_otp_required: false }).eq("tenant_id", t.id);
  const svc = async (name: string, min: number) =>
    (
      await db
        .from("services")
        .insert({ tenant_id: t.id, name_i18n: { ka: name }, price_minor: 3000, duration_min: min })
        .select("id")
        .single()
    ).data!.id;
  const dry = await svc("დავარცხნა", 30);
  const colour = await svc("შეღებვა", 60);
  await db.from("services").update({ followup_service_id: dry, followup_after_min: 60 }).eq("id", colour);
  await db.from("staff_services").insert([
    { tenant_id: t.id, staff_id: staff, service_id: colour },
    { tenant_id: t.id, staff_id: staff, service_id: dry },
  ]);
  const { data, error } = await db.rpc("public_create_booking", {
    p_tenant: t.id,
    p_first_name: "Online",
    p_last_name: label,
    p_phone: phone(),
    p_email: "",
    p_comment: "",
    p_items: [{ service_id: colour, staff_id: staff, starts_at: `${day()}T10:00:00+04:00` }],
    p_marketing_sms: false,
    p_marketing_email: false,
    p_locale: "ka",
    p_manage_token_hash: randomBytes(16).toString("hex"),
    p_otp_pass_hash: null as unknown as string,
  });
  if (error) throw new Error(`public_create_booking: ${error.message}`);
  return { t, staff, colour, dry, booking: (data as { booking_id: string }).booking_id };
}

let A: W;
let B: W;
beforeAll(async () => {
  A = await world("fua");
  B = await world("fub");
});
afterAll(async () => {
  await cleanup();
});

const followUpKeys = async (user: TestTenant["owner"], tenant: string) => {
  const { data, error } = await user.db.rpc("my_notifications", { p_tenant: tenant, p_limit: 50 });
  expect(error).toBeNull();
  return (data ?? []).filter((r) => r.kind === "needs_followup").map((r) => r.booking_id);
};
const startOf = async (booking: string) =>
  (await admin().from("bookings").select("starts_at").eq("id", booking).single()).data!.starts_at;
const at = (iso: string, plusMin: number) =>
  new Date(new Date(iso).getTime() + plusMin * 60_000).toISOString();

describe("additional service not added", () => {
  it("owner, admin and the specialist see the notice for the online visit", async () => {
    for (const user of [A.t.owner, A.t.adminUser, A.t.staff]) {
      expect(await followUpKeys(user, A.t.id)).toEqual([A.booking]);
    }
  });

  it("a user of A cannot see B's notice or add a service to B's visit", async () => {
    expect(await followUpKeys(A.t.owner, B.t.id)).toEqual([]);
    const { error } = await A.t.owner.db.rpc("add_booking_item", {
      p_tenant: B.t.id,
      p_booking: B.booking,
      p_service: B.dry,
      p_staff: B.staff,
      p_starts_at: at(await startOf(B.booking), 120),
    });
    expect(error).not.toBeNull();
    // nor smuggle B's visit in under A's own tenant
    const { error: e2 } = await A.t.owner.db.rpc("add_booking_item", {
      p_tenant: A.t.id,
      p_booking: B.booking,
      p_service: A.dry,
      p_staff: A.staff,
      p_starts_at: at(await startOf(B.booking), 120),
    });
    expect(e2).not.toBeNull();
    const { count } = await admin()
      .from("booking_items")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", B.booking);
    expect(count).toBe(1);
  });

  it("the overlap rule still applies to the added part", async () => {
    const { error } = await A.t.owner.db.rpc("add_booking_item", {
      p_tenant: A.t.id,
      p_booking: A.booking,
      p_service: A.dry,
      p_staff: A.staff,
      p_starts_at: at(await startOf(A.booking), 30), // inside the colouring
    });
    expect(error?.code).toBe("23P01");
  });

  it("adding it with a gap updates the visit and clears the notice", async () => {
    const start = await startOf(A.booking);
    const { error } = await A.t.adminUser.db.rpc("add_booking_item", {
      p_tenant: A.t.id,
      p_booking: A.booking,
      p_service: A.dry,
      p_staff: A.staff,
      p_starts_at: at(start, 120),
    });
    expect(error).toBeNull();
    const b = (
      await admin().from("bookings").select("starts_at, ends_at, total_minor").eq("id", A.booking).single()
    ).data!;
    expect(new Date(b.starts_at).getTime()).toBe(new Date(start).getTime());
    expect(new Date(b.ends_at).getTime()).toBe(new Date(at(start, 150)).getTime());
    expect(b.total_minor).toBe(6000);
    expect(await followUpKeys(A.t.owner, A.t.id)).toEqual([]);
    expect(await followUpKeys(B.t.owner, B.t.id)).toEqual([B.booking]); // B untouched
  });
});
