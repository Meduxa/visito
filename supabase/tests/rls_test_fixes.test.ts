import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTenant, type TestTenant } from "./helpers";

// Fixes from the test salon run (migration 20261126090000):
// - a client moving or cancelling with the manage link reaches the bell,
//   only inside its own business;
// - the manage page names the main branch when there are several, knows
//   "from" prices and hidden prices;
// - branch/staff translations stay inside the business (RLS of their tables).

const phone = () => `+99557${Math.floor(1e6 + Math.random() * 8e6)}`;
const day = 1 + Math.floor(Math.random() * 8);
const at = (hhmm: string) => `2031-05-0${day}T${hhmm}:00+04:00`;

type W = { t: TestTenant; staff: string; booking: string; token: string };

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
  await db.from("tenant_settings").update({ online_otp_required: false }).eq("tenant_id", t.id);
  const service = (
    await db
      .from("services")
      .insert({
        tenant_id: t.id,
        name_i18n: { ka: "ფერი" },
        price_type: "from",
        price_minor: 8000,
        duration_min: 60,
      })
      .select("id")
      .single()
  ).data!.id;
  await db.from("staff_services").insert({ tenant_id: t.id, staff_id: staff, service_id: service });
  const token = createHash("sha256").update(randomBytes(16)).digest("hex");
  const { data, error } = await db.rpc("public_create_booking", {
    p_tenant: t.id,
    p_first_name: "Online",
    p_last_name: label,
    p_phone: phone(),
    p_email: "",
    p_comment: "",
    p_items: [{ service_id: service, staff_id: staff, starts_at: at("10:00") }],
    p_marketing_sms: false,
    p_marketing_email: false,
    p_locale: "ka",
    p_manage_token_hash: token,
    p_otp_pass_hash: null as unknown as string,
  });
  if (error) throw new Error(`public_create_booking: ${error.message}`);
  return { t, staff, booking: (data as { booking_id: string }).booking_id, token };
}

let A: W;
let B: W;
beforeAll(async () => {
  A = await world("fixa");
  B = await world("fixb");
}, 120_000);
afterAll(cleanup, 60_000);

const kinds = async (user: TestTenant["owner"], tenant: string) => {
  const { data, error } = await user.db.rpc("my_notifications", { p_tenant: tenant, p_limit: 50 });
  expect(error).toBeNull();
  return (data ?? []).map((r) => `${r.kind}:${r.booking_id}:${r.is_read ? "read" : "new"}`).sort();
};

describe("client changes reach the bell (#19)", () => {
  it("moving with the manage link: the owner is told; another business sees nothing", async () => {
    const { error } = await admin().rpc("public_move_booking", {
      p_token_hash: A.token,
      p_starts_at: at("12:00"),
    });
    expect(error).toBeNull();
    expect(await kinds(A.t.owner, A.t.id)).toContain(`client_moved:${A.booking}:new`);
    expect(await kinds(B.t.owner, A.t.id)).toEqual([]);
    expect((await kinds(B.t.owner, B.t.id)).some((k) => k.startsWith("client_"))).toBe(false);
  });

  it("a second move brings the notice back as unread", async () => {
    await A.t.owner.db.rpc("mark_notifications_read", {
      p_tenant: A.t.id,
      p_items: null as unknown as string,
    });
    expect(await kinds(A.t.owner, A.t.id)).toContain(`client_moved:${A.booking}:read`);
    await admin().rpc("public_move_booking", { p_token_hash: A.token, p_starts_at: at("13:00") });
    expect(await kinds(A.t.owner, A.t.id)).toContain(`client_moved:${A.booking}:new`);
  });

  it("cancelling with the manage link: told, and the online booking shows it is cancelled", async () => {
    const { error } = await admin().rpc("public_cancel_booking", { p_token_hash: A.token });
    expect(error).toBeNull();
    expect(await kinds(A.t.owner, A.t.id)).toContain(`client_cancelled:${A.booking}:new`);
    const { data } = await A.t.owner.db.rpc("my_notifications", { p_tenant: A.t.id, p_limit: 50 });
    const online = (data ?? []).find((r) => r.kind === "online_booking" && r.booking_id === A.booking);
    expect(online?.status).toBe("cancelled_by_client");
  });

  it("staff of another specialist profile are not told", async () => {
    // A's staff login is not linked to the booked specialist
    expect((await kinds(A.t.staff, A.t.id)).some((k) => k.startsWith("client_"))).toBe(false);
  });

  it("nobody writes the new kinds directly", async () => {
    const r = await A.t.owner.db
      .from("notifications")
      .insert({ tenant_id: A.t.id, kind: "client_moved", booking_id: A.booking });
    expect(r.error).not.toBeNull();
  });
});

describe("manage page (#23)", () => {
  it("'from' price, hidden prices, and the main branch's name once there are several", async () => {
    const view = async () =>
      (await admin().rpc("public_manage_view", { p_token_hash: B.token })).data as Record<string, unknown>;
    let v = await view();
    expect(v.price_from).toBe(true);
    expect(v.show_prices).toBe(true);
    expect(v.branch).toBeNull(); // one branch: no name needed

    await admin().from("locations").insert({ tenant_id: B.t.id, name: "ვაკე", slug: "vake" });
    await admin().from("tenant_settings").update({ online_show_prices: false }).eq("tenant_id", B.t.id);
    v = await view();
    expect(v.branch).not.toBeNull(); // the main branch, now named
    expect(v.show_prices).toBe(false);
  });
});

describe("translations (#25)", () => {
  it("owner saves English/Russian names; another business can neither read nor change them", async () => {
    const tr = { en: { position: "Stylist" }, ru: { position: "Стилист" } };
    expect(
      (await A.t.owner.db.from("staff").update({ translations: tr }).eq("id", A.staff)).error,
    ).toBeNull();
    expect((await B.t.owner.db.from("staff").select("translations").eq("id", A.staff)).data).toEqual([]);
    await B.t.owner.db.from("staff").update({ translations: {} }).eq("id", A.staff);
    const { data } = await admin().from("staff").select("translations").eq("id", A.staff).single();
    expect(data?.translations).toEqual(tr);
  });

  it("only an object is accepted", async () => {
    const r = await A.t.owner.db
      .from("staff")
      .update({ translations: ["x"] })
      .eq("id", A.staff);
    expect(r.error).not.toBeNull();
  });
});

describe("booking import with branches (#36)", () => {
  it("an imported visit goes to the branch where its specialist works that weekday", async () => {
    const db = admin();
    const { data: loc } = await db
      .from("locations")
      .insert({ tenant_id: B.t.id, name: "Saburtalo", slug: `sab-${Date.now()}` })
      .select("id")
      .single();
    // B's specialist works in the new branch on Mondays (2031-06-02 is a Monday)
    await db.from("staff_schedules").insert({
      tenant_id: B.t.id,
      staff_id: B.staff,
      weekday: 1,
      start_time: "10:00",
      end_time: "19:00",
      location_id: loc!.id,
    });
    const { data: svc } = await db.from("services").select("id").eq("tenant_id", B.t.id).limit(1).single();
    const row = (line: number, starts: string) => ({
      line,
      first_name: "Imported",
      last_name: "",
      phone_e164: "",
      service_id: svc!.id,
      staff_id: B.staff,
      starts_at: starts,
      duration_min: 30,
      price_minor: 1000,
      name: "ფერი",
      status: "confirmed",
    });
    const { error } = await B.t.owner.db.rpc("import_bookings", {
      p_tenant: B.t.id,
      p_rows: [row(1, "2031-06-02T11:00:00+04:00"), row(2, "2031-06-03T11:00:00+04:00")],
    });
    expect(error).toBeNull();
    const { data } = await db
      .from("bookings")
      .select("starts_at, location_id")
      .eq("tenant_id", B.t.id)
      .eq("source", "import")
      .order("starts_at");
    const { data: main } = await db
      .from("locations")
      .select("id")
      .eq("tenant_id", B.t.id)
      .eq("is_primary", true)
      .single();
    expect(data?.map((b) => b.location_id)).toEqual([loc!.id, main!.id]); // Tuesday: no schedule → main
  });

  it("another business cannot import into this one", async () => {
    const { error } = await A.t.owner.db.rpc("import_bookings", { p_tenant: B.t.id, p_rows: [] });
    expect(error).not.toBeNull();
  });
});
