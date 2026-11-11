import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTenant, type TestTenant } from "./helpers";

// Online booking extras (decision 023): the "show prices" switch and the limit on
// upcoming visits per client. The limit is enforced by the server-only booking
// function; the switches are tenant settings guarded by the usual RLS.
type W = { t: TestTenant; staff: string; service: string };

const phone = () => `+99558${Math.floor(1e6 + Math.random() * 8e6)}`;
let hour = 8;
const nextStart = () =>
  `2031-05-0${1 + Math.floor(Math.random() * 8)}T${String(hour++).padStart(2, "0")}:00:00+04:00`;

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
  const service = (
    await db
      .from("services")
      .insert({ tenant_id: t.id, name_i18n: { ka: "შეჭრა" }, price_minor: 5000, duration_min: 30 })
      .select("id")
      .single()
  ).data!.id;
  await db.from("staff_services").insert({ tenant_id: t.id, staff_id: staff, service_id: service });
  await db.from("tenant_settings").update({ online_otp_required: false }).eq("tenant_id", t.id);
  return { t, staff, service };
}

// exactly the way the booking page's server calls it
const book = (w: W, clientPhone: string) =>
  admin().rpc("public_create_booking", {
    p_tenant: w.t.id,
    p_first_name: "Limit",
    p_last_name: "Test",
    p_phone: clientPhone,
    p_email: "",
    p_comment: "",
    p_items: [{ service_id: w.service, staff_id: w.staff, starts_at: nextStart() }],
    p_marketing_sms: false,
    p_marketing_email: false,
    p_locale: "ka",
    p_manage_token_hash: randomBytes(16).toString("hex"),
    p_otp_pass_hash: null as unknown as string,
  });

const setLimit = (w: W, n: number) =>
  admin().from("tenant_settings").update({ online_max_upcoming: n }).eq("tenant_id", w.t.id);

let A: W;
let B: W;
beforeAll(async () => {
  A = await world("lima");
  B = await world("limb");
});
afterAll(async () => {
  await cleanup();
});

describe("upcoming-visit limit for online bookings", () => {
  it("0 means no limit", async () => {
    await setLimit(A, 0);
    const p = phone();
    for (let i = 0; i < 3; i++) expect((await book(A, p)).error).toBeNull();
  });

  it("with a limit of 2 the third upcoming visit is refused (P0006)", async () => {
    await setLimit(A, 2);
    const p = phone();
    expect((await book(A, p)).error).toBeNull();
    expect((await book(A, p)).error).toBeNull();
    const third = await book(A, p);
    expect(third.error?.code).toBe("P0006");
    // another client is not affected
    expect((await book(A, phone())).error).toBeNull();
  });

  it("cancelled visits don't count", async () => {
    await setLimit(A, 1);
    const p = phone();
    const first = await book(A, p);
    expect(first.error).toBeNull();
    expect((await book(A, p)).error?.code).toBe("P0006");
    const id = (first.data as { booking_id: string }).booking_id;
    const cancel = await admin().from("bookings").update({ status: "cancelled_by_client" }).eq("id", id);
    expect(cancel.error).toBeNull();
    expect((await book(A, p)).error).toBeNull();
  });

  it("one business's limit doesn't touch another's", async () => {
    await setLimit(A, 1);
    await setLimit(B, 0);
    const p = phone();
    expect((await book(A, p)).error).toBeNull();
    expect((await book(B, p)).error).toBeNull();
    expect((await book(B, p)).error).toBeNull();
  });
});

describe("who can change the online switches", () => {
  const read = async (w: W) =>
    (
      await admin()
        .from("tenant_settings")
        .select("online_show_prices, online_max_upcoming")
        .eq("tenant_id", w.t.id)
        .single()
    ).data!;

  it("owner and admin of the business can", async () => {
    for (const u of [A.t.owner, A.t.adminUser]) {
      const { error } = await u.db
        .from("tenant_settings")
        .update({ online_show_prices: false, online_max_upcoming: 3 })
        .eq("tenant_id", A.t.id);
      expect(error).toBeNull();
    }
    expect(await read(A)).toEqual({ online_show_prices: false, online_max_upcoming: 3 });
  });

  it("staff cannot, and nobody from another business can", async () => {
    const before = await read(B);
    for (const u of [B.t.staff, A.t.owner, A.t.adminUser]) {
      await u.db
        .from("tenant_settings")
        .update({ online_show_prices: !before.online_show_prices, online_max_upcoming: 7 })
        .eq("tenant_id", B.t.id);
    }
    expect(await read(B)).toEqual(before);
  });

  it("another business's owner cannot read them", async () => {
    const { data } = await A.t.owner.db
      .from("tenant_settings")
      .select("online_max_upcoming")
      .eq("tenant_id", B.t.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("anon cannot read them", async () => {
    const { data } = await anon()
      .from("tenant_settings")
      .select("online_max_upcoming")
      .eq("tenant_id", A.t.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("the limit stays between 0 and 20", async () => {
    const { error } = await A.t.owner.db
      .from("tenant_settings")
      .update({ online_max_upcoming: 21 })
      .eq("tenant_id", A.t.id);
    expect(error).not.toBeNull();
  });
});
