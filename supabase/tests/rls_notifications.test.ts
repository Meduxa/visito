import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTenant, type TestTenant } from "./helpers";

// In-app notifications (decision 019): online bookings (stored, written by the
// server-only booking function) and overdue bookings that still need a status
// (computed). Owner/admin see all, staff only their own specialist's.
type W = {
  t: TestTenant;
  staffMine: string;
  staffOther: string;
  service: string;
  client: string;
  onlineMine: string;
  onlineOther: string;
  overdueMine: string;
  overdueOther: string;
};

const phone = () => `+99557${Math.floor(1e6 + Math.random() * 8e6)}`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const future = (hhmm: string) => `2031-04-0${1 + Math.floor(Math.random() * 8)}T${hhmm}:00+04:00`;

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
  await db.from("tenant_settings").update({ online_otp_required: false }).eq("tenant_id", t.id);
  const service = (
    await db
      .from("services")
      .insert({ tenant_id: t.id, name_i18n: { ka: "შეჭრა" }, price_minor: 5000, duration_min: 60 })
      .select("id")
      .single()
  ).data!.id;
  await db.from("staff_services").insert([
    { tenant_id: t.id, staff_id: staffMine, service_id: service },
    { tenant_id: t.id, staff_id: staffOther, service_id: service },
  ]);
  const client = (
    await db
      .from("clients")
      .insert({ tenant_id: t.id, first_name: "Nino", last_name: "Overdue", phone_e164: phone() })
      .select("id")
      .single()
  ).data!.id;

  // online bookings, exactly the way the booking page's server makes them
  const online = async (staffId: string, start: string) => {
    const { data, error } = await db.rpc("public_create_booking", {
      p_tenant: t.id,
      p_first_name: "Online",
      p_last_name: label,
      p_phone: phone(),
      p_email: "",
      p_comment: "",
      p_items: [{ service_id: service, staff_id: staffId, starts_at: start }],
      p_marketing_sms: false,
      p_marketing_email: false,
      p_locale: "ka",
      p_manage_token_hash: randomBytes(16).toString("hex"),
      p_otp_pass_hash: null as unknown as string,
    });
    if (error) throw new Error(`public_create_booking: ${error.message}`);
    return (data as { booking_id: string }).booking_id;
  };
  const onlineMine = await online(staffMine, future("10:00"));
  const onlineOther = await online(staffOther, future("12:00"));

  // a visit that ended an hour ago (booked two days ago), status never set
  const past = async (
    staffId: string,
    o: { status?: string; createdAt?: string; endsHoursAgo?: number } = {},
  ) => {
    const end = hoursAgo(o.endsHoursAgo ?? 1);
    const start = new Date(new Date(end).getTime() - 3_600_000).toISOString();
    const b = (
      await db
        .from("bookings")
        .insert({
          tenant_id: t.id,
          client_id: client,
          starts_at: start,
          ends_at: end,
          status: o.status ?? "confirmed",
          created_at: o.createdAt ?? hoursAgo(48),
        })
        .select("id")
        .single()
    ).data!.id;
    await db.from("booking_items").insert({
      tenant_id: t.id,
      booking_id: b,
      service_id: service,
      staff_id: staffId,
      name_snapshot: "შეჭრა",
      price_type_snapshot: "fixed",
      price_minor_snapshot: 5000,
      duration_min_snapshot: 60,
      starts_at: start,
      ends_at: end,
      blocked_until: end,
      active: o.status !== "no_show",
    });
    return b;
  };
  const overdueMine = await past(staffMine, { endsHoursAgo: 2 });
  const overdueOther = await past(staffOther, { endsHoursAgo: 3 });
  await past(staffOther, { status: "completed", endsHoursAgo: 4 }); // done: no notification
  await past(staffOther, { createdAt: hoursAgo(0), endsHoursAgo: 5 }); // entered afterwards: not "missed"
  await past(staffOther, { endsHoursAgo: 24 * 40 }); // older than 30 days

  return { t, staffMine, staffOther, service, client, onlineMine, onlineOther, overdueMine, overdueOther };
}

let A: W;
let B: W;
beforeAll(async () => {
  A = await world("ntfa");
  B = await world("ntfb");
});
afterAll(async () => {
  await cleanup();
});

const list = async (user: TestTenant["owner"], tenant: string) => {
  const { data, error } = await user.db.rpc("my_notifications", { p_tenant: tenant, p_limit: 50 });
  expect(error).toBeNull();
  return data ?? [];
};
const keys = (rows: { kind: string; booking_id: string }[]) =>
  rows.map((r) => `${r.kind}:${r.booking_id}`).sort();
const unread = async (user: TestTenant["owner"], tenant: string) =>
  (await user.db.rpc("my_notifications_unread", { p_tenant: tenant })).data;

describe("who sees what", () => {
  it("owner and admin see every notification of their business, with the four details", async () => {
    const expected = [
      `online_booking:${A.onlineMine}`,
      `online_booking:${A.onlineOther}`,
      `needs_action:${A.overdueMine}`,
      `needs_action:${A.overdueOther}`,
    ].sort();
    for (const user of [A.t.owner, A.t.adminUser]) {
      const rows = await list(user, A.t.id);
      expect(keys(rows)).toEqual(expected);
      const overdue = rows.find((r) => r.booking_id === A.overdueOther)!;
      expect(overdue.client_name).toBe("Nino Overdue");
      expect(overdue.services).toBe("შეჭრა");
      expect(overdue.staff).toBe("Other ntfa");
      expect(overdue.starts_at).toBeTruthy();
      expect(overdue.is_read).toBe(false);
      const online = rows.find((r) => r.booking_id === A.onlineMine)!;
      expect(online.client_name).toBe("Online ntfa");
      expect(online.staff).toBe("Mine ntfa");
      expect(await unread(user, A.t.id)).toBe(4);
    }
  });

  it("newest first: an overdue visit uses its end time, an online booking its creation time", async () => {
    const rows = await list(A.t.owner, A.t.id);
    const times = rows.map((r) => new Date(r.at).getTime());
    expect(times).toEqual([...times].sort((x, y) => y - x));
  });

  it("staff see only notifications for their own specialist profile", async () => {
    const rows = await list(A.t.staff, A.t.id);
    expect(keys(rows)).toEqual([`needs_action:${A.overdueMine}`, `online_booking:${A.onlineMine}`].sort());
    const { data } = await A.t.staff.db.from("notifications").select("booking_id");
    expect((data ?? []).map((r) => r.booking_id)).toEqual([A.onlineMine]);
  });

  it("staff without a linked profile see nothing", async () => {
    await admin()
      .from("memberships")
      .update({ staff_id: null })
      .eq("tenant_id", B.t.id)
      .eq("user_id", B.t.staff.id);
    expect(await list(B.t.staff, B.t.id)).toEqual([]);
    expect(await unread(B.t.staff, B.t.id)).toBe(0);
    await admin()
      .from("memberships")
      .update({ staff_id: B.staffMine })
      .eq("tenant_id", B.t.id)
      .eq("user_id", B.t.staff.id);
  });
});

describe("tenant isolation", () => {
  it("a user of A gets nothing of B", async () => {
    for (const user of [A.t.owner, A.t.adminUser, A.t.staff]) {
      expect(await list(user, B.t.id)).toEqual([]);
      expect(await unread(user, B.t.id)).toBe(0);
      const { data: n } = await user.db.from("notifications").select("tenant_id");
      expect((n ?? []).every((r) => r.tenant_id === A.t.id)).toBe(true);
    }
  });

  it("a user of A cannot mark B's notifications read", async () => {
    const r = await A.t.owner.db.rpc("mark_notifications_read", { p_tenant: B.t.id });
    expect(r.error).not.toBeNull();
    // B's items passed in A's call are ignored: only A's own feed can be marked
    const mixed = await A.t.owner.db.rpc("mark_notifications_read", {
      p_tenant: A.t.id,
      p_items: [{ kind: "online_booking", booking_id: B.onlineMine }],
    });
    expect(mixed.data).toBe(0);
    expect(await unread(B.t.owner, B.t.id)).toBe(4);
  });

  it("nobody writes the tables directly", async () => {
    for (const user of [A.t.owner, A.t.staff]) {
      const ins = await user.db
        .from("notifications")
        .insert({ tenant_id: A.t.id, kind: "online_booking", booking_id: A.overdueMine });
      expect(ins.error).not.toBeNull();
      const insB = await user.db
        .from("notifications")
        .insert({ tenant_id: B.t.id, kind: "online_booking", booking_id: B.overdueMine });
      expect(insB.error).not.toBeNull();
      const read = await user.db
        .from("notification_reads")
        .insert({ user_id: user.id, tenant_id: B.t.id, kind: "online_booking", booking_id: B.onlineMine });
      expect(read.error).not.toBeNull();
      const del = await user.db.from("notifications").delete().eq("tenant_id", B.t.id).select("id");
      expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
    }
    const { count } = await admin()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", B.t.id);
    expect(count).toBe(2);
  });

  it("visitors without sign-in get nothing", async () => {
    const db = anon();
    for (const table of ["notifications", "notification_reads"] as const) {
      const { data, error } = await db.from(table).select("*");
      expect(error !== null || (data ?? []).length === 0, table).toBe(true);
    }
    expect((await db.rpc("my_notifications", { p_tenant: A.t.id })).error).not.toBeNull();
    expect((await db.rpc("my_notifications_unread", { p_tenant: A.t.id })).error).not.toBeNull();
    expect((await db.rpc("mark_notifications_read", { p_tenant: A.t.id })).error).not.toBeNull();
  });
});

describe("read state and resolving", () => {
  it("read state is per user", async () => {
    const r = await A.t.owner.db.rpc("mark_notifications_read", {
      p_tenant: A.t.id,
      p_items: [{ kind: "online_booking", booking_id: A.onlineOther }],
    });
    expect(r.data).toBe(1);
    expect(await unread(A.t.owner, A.t.id)).toBe(3);
    expect(await unread(A.t.adminUser, A.t.id)).toBe(4);
    expect((await list(A.t.owner, A.t.id)).find((x) => x.booking_id === A.onlineOther)!.is_read).toBe(true);
    // users see only their own read rows
    const { data } = await A.t.adminUser.db.from("notification_reads").select("user_id");
    expect(data).toEqual([]);
  });

  it("mark all as read", async () => {
    expect((await A.t.adminUser.db.rpc("mark_notifications_read", { p_tenant: A.t.id })).data).toBe(4);
    expect(await unread(A.t.adminUser, A.t.id)).toBe(0);
  });

  it("setting the status resolves a needs-action notification", async () => {
    const { error } = await A.t.staff.db.rpc("set_booking_status", {
      p_booking: A.overdueMine,
      p_status: "completed",
    });
    expect(error).toBeNull();
    const rows = await list(A.t.owner, A.t.id);
    expect(rows.some((r) => r.kind === "needs_action" && r.booking_id === A.overdueMine)).toBe(false);
    expect(rows.some((r) => r.kind === "needs_action" && r.booking_id === A.overdueOther)).toBe(true);
  });
});

describe("Settings → Notifications decide who is told (decision 021)", () => {
  const flags = (v: Partial<Record<"online_m" | "online_s" | "overdue_m" | "overdue_s", boolean>>) => ({
    ...(v.online_m !== undefined && { notify_online_managers: v.online_m }),
    ...(v.online_s !== undefined && { notify_online_staff: v.online_s }),
    ...(v.overdue_m !== undefined && { notify_overdue_managers: v.overdue_m }),
    ...(v.overdue_s !== undefined && { notify_overdue_staff: v.overdue_s }),
  });
  const set = async (v: Parameters<typeof flags>[0]) => {
    const { error } = await B.t.owner.db.from("tenant_settings").update(flags(v)).eq("tenant_id", B.t.id);
    expect(error).toBeNull();
  };
  const kinds = async (user: TestTenant["owner"]) => keys(await list(user, B.t.id));
  afterAll(async () => {
    await admin()
      .from("tenant_settings")
      .update(flags({ online_m: true, online_s: true, overdue_m: true, overdue_s: true }))
      .eq("tenant_id", B.t.id);
  });

  it("owner & admins off for online bookings: they no longer see them, the specialist still does", async () => {
    await set({ online_m: false });
    for (const user of [B.t.owner, B.t.adminUser]) {
      expect((await kinds(user)).some((k) => k.startsWith("online_booking"))).toBe(false);
      expect(await kinds(user)).toContain(`needs_action:${B.overdueOther}`);
      const { data } = await user.db.from("notifications").select("id");
      expect(data).toEqual([]);
    }
    expect(await kinds(B.t.staff)).toContain(`online_booking:${B.onlineMine}`);
    await set({ online_m: true });
  });

  it("specialist off for 'needs a status': staff stop seeing it, owner still does", async () => {
    await set({ overdue_s: false });
    expect(await kinds(B.t.staff)).toEqual([`online_booking:${B.onlineMine}`]);
    expect(await unread(B.t.staff, B.t.id)).toBe(1);
    expect(await kinds(B.t.owner)).toContain(`needs_action:${B.overdueMine}`);
    await set({ overdue_s: true });
  });

  it("everything off: nobody sees anything, and nothing can be marked read", async () => {
    await set({ online_m: false, online_s: false, overdue_m: false, overdue_s: false });
    for (const user of [B.t.owner, B.t.adminUser, B.t.staff]) {
      expect(await list(user, B.t.id)).toEqual([]);
      expect((await user.db.rpc("mark_notifications_read", { p_tenant: B.t.id })).data).toBe(0);
    }
    await set({ online_m: true, online_s: true, overdue_m: true, overdue_s: true });
    expect(await unread(B.t.owner, B.t.id)).toBe(4);
  });

  it("only that business's owner/admin change the switches", async () => {
    // another business's owner, and the business's own staff: no effect
    for (const user of [A.t.owner, B.t.staff]) {
      const r = await user.db
        .from("tenant_settings")
        .update(flags({ online_m: false }))
        .eq("tenant_id", B.t.id)
        .select("tenant_id");
      expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
    }
    const { data } = await admin()
      .from("tenant_settings")
      .select("notify_online_managers")
      .eq("tenant_id", B.t.id)
      .single();
    expect(data!.notify_online_managers).toBe(true);
    // B's admin may
    const ok = await B.t.adminUser.db
      .from("tenant_settings")
      .update(flags({ overdue_m: true }))
      .eq("tenant_id", B.t.id)
      .select("tenant_id");
    expect(ok.data).toHaveLength(1);
  });
});
