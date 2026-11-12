import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createTenant, type TestTenant } from "./helpers";

// Decisions 028–031: ready services, time-off requests, reviews, card billing.
let a: TestTenant;
let b: TestTenant;
let aStaff: string; // the staff member's own profile
let aOther: string; // another specialist of A

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

beforeAll(async () => {
  [a, b] = await Promise.all([createTenant("rza", "salon"), createTenant("rzb", "salon")]);
  const db = admin();
  aStaff = (await db.from("staff").insert({ tenant_id: a.id, display_name: "Me" }).select("id").single())
    .data!.id;
  aOther = (await db.from("staff").insert({ tenant_id: a.id, display_name: "Other" }).select("id").single())
    .data!.id;
  await db.from("memberships").update({ staff_id: aStaff }).eq("tenant_id", a.id).eq("user_id", a.staff.id);
}, 120_000);
afterAll(cleanup, 60_000);

describe("ready services (028)", () => {
  const rows = [
    {
      category: { ka: "თმა", en: "Hair", ru: "Волосы" },
      name: { ka: "შეჭრა", en: "Haircut", ru: "Стрижка" },
      price_minor: 3000,
      price_type: "fixed",
      duration_min: 30,
    },
    {
      category: { ka: "თმა", en: "Hair", ru: "Волосы" },
      name: { ka: "შეღებვა", en: "Colour", ru: "Окрашивание" },
      price_minor: 8000,
      price_type: "from",
      duration_min: 90,
    },
  ];
  it("owner adds them in three languages; adding again changes nothing", async () => {
    const r = await a.owner.db.rpc("add_template_services", { p_tenant: a.id, p_rows: rows });
    expect(r.data).toBe(2);
    expect((await a.owner.db.rpc("add_template_services", { p_tenant: a.id, p_rows: rows })).data).toBe(0);
    const { data } = await admin().from("services").select("name_i18n, price_type").eq("tenant_id", a.id);
    expect(data!.map((s) => (s.name_i18n as { en: string }).en).sort()).toEqual(["Colour", "Haircut"]);
    const cats = await admin().from("service_categories").select("id").eq("tenant_id", a.id);
    expect(cats.data).toHaveLength(1);
  });
  it("staff and other businesses cannot", async () => {
    expect(
      (await a.staff.db.rpc("add_template_services", { p_tenant: a.id, p_rows: rows })).error,
    ).not.toBeNull();
    expect(
      (await b.owner.db.rpc("add_template_services", { p_tenant: a.id, p_rows: rows })).error,
    ).not.toBeNull();
  });
});

describe("time-off requests (029)", () => {
  let reqId: string;
  it("staff ask for their own profile only; managers see it, other businesses don't", async () => {
    const r = await a.staff.db.rpc("request_time_off", {
      p_tenant: a.id,
      p_starts: daysFromNow(10),
      p_ends: daysFromNow(12),
      p_reason: "vacation",
      p_note: "sea",
      p_staff: aOther, // ignored for staff: always their own profile
    });
    expect(r.error).toBeNull();
    reqId = r.data!;
    const row = await admin().from("time_off_requests").select("staff_id, status").eq("id", reqId).single();
    expect(row.data).toEqual({ staff_id: aStaff, status: "pending" });
    expect((await a.owner.db.from("time_off_requests").select("id").eq("id", reqId)).data).toHaveLength(1);
    expect((await a.staff.db.from("time_off_requests").select("id").eq("id", reqId)).data).toHaveLength(1);
    expect((await b.owner.db.from("time_off_requests").select("id").eq("id", reqId)).data).toHaveLength(0);
    expect((await anon().from("time_off_requests").select("id")).data ?? []).toHaveLength(0);
  });
  it("nobody writes the table directly", async () => {
    const ins = await a.owner.db.from("time_off_requests").insert({
      tenant_id: a.id,
      staff_id: aStaff,
      starts_at: daysFromNow(1),
      ends_at: daysFromNow(2),
    });
    expect(ins.error).not.toBeNull();
    const upd = await a.owner.db
      .from("time_off_requests")
      .update({ status: "approved" })
      .eq("id", reqId)
      .select();
    expect(upd.error ?? upd.data?.length === 0).toBeTruthy();
  });
  it("staff and other businesses cannot decide; the owner approves and the time off appears once", async () => {
    expect((await a.staff.db.rpc("decide_time_off", { p_id: reqId, p_approve: true })).error).not.toBeNull();
    expect((await b.owner.db.rpc("decide_time_off", { p_id: reqId, p_approve: true })).error).not.toBeNull();
    const ok = await a.adminUser.db.rpc("decide_time_off", { p_id: reqId, p_approve: true, p_note: "ok" });
    expect(ok.error).toBeNull();
    const off = await admin().from("time_off").select("staff_id, reason").eq("id", ok.data!).single();
    expect(off.data).toEqual({ staff_id: aStaff, reason: "vacation" });
    expect((await a.owner.db.rpc("decide_time_off", { p_id: reqId, p_approve: false })).error).not.toBeNull();
  });
  it("a pending request can be withdrawn by the person who asked, not by another business", async () => {
    const r = await a.staff.db.rpc("request_time_off", {
      p_tenant: a.id,
      p_starts: daysFromNow(20),
      p_ends: daysFromNow(21),
      p_reason: "other",
      p_note: "",
    });
    expect((await b.owner.db.rpc("cancel_time_off_request", { p_id: r.data! })).error).not.toBeNull();
    expect((await a.staff.db.rpc("cancel_time_off_request", { p_id: r.data! })).error).toBeNull();
    const row = await admin().from("time_off_requests").select("status").eq("id", r.data!).single();
    expect(row.data!.status).toBe("cancelled");
  });
});

describe("reviews (030)", () => {
  let bookingId: string;
  const hash = `h-${Date.now()}`;
  beforeAll(async () => {
    const db = admin();
    const client = (
      await db
        .from("clients")
        .insert({
          tenant_id: a.id,
          first_name: "Nino",
          phone_e164: `+99559${Math.floor(1e6 + Math.random() * 8e6)}`,
        })
        .select("id")
        .single()
    ).data!.id;
    const start = new Date(Date.now() - 5 * 3_600_000).toISOString();
    const end = new Date(Date.now() - 4 * 3_600_000).toISOString();
    bookingId = (
      await db
        .from("bookings")
        .insert({ tenant_id: a.id, client_id: client, starts_at: start, ends_at: end, status: "completed" })
        .select("id")
        .single()
    ).data!.id;
    await db.from("booking_items").insert({
      tenant_id: a.id,
      booking_id: bookingId,
      staff_id: aOther,
      name_snapshot: "შეჭრა",
      price_type_snapshot: "fixed",
      price_minor_snapshot: 3000,
      duration_min_snapshot: 60,
      starts_at: start,
      ends_at: end,
      blocked_until: end,
    });
  });

  it("only the server can make a link and submit; a link gives one review", async () => {
    expect(
      (await a.owner.db.rpc("add_review_request", { p_booking: bookingId, p_token_hash: hash })).error,
    ).not.toBeNull();
    expect(
      (await anon().rpc("public_review_submit", { p_token_hash: hash, p_rating: 5, p_comment: "x" })).error,
    ).not.toBeNull();
    expect((await admin().rpc("add_review_request", { p_booking: bookingId, p_token_hash: hash })).data).toBe(
      true,
    );
    expect(
      (await admin().rpc("public_review_submit", { p_token_hash: hash, p_rating: 4, p_comment: "კარგი" }))
        .data,
    ).toBe("ok");
    expect(
      (await admin().rpc("public_review_submit", { p_token_hash: hash, p_rating: 1, p_comment: "again" }))
        .data,
    ).toBe("done");
    expect(
      (await admin().rpc("public_review_submit", { p_token_hash: "nope", p_rating: 5, p_comment: "" })).data,
    ).toBe("not_found");
  });

  it("managers see it; staff only about their own visits; other businesses never", async () => {
    expect((await a.owner.db.from("reviews").select("rating").eq("booking_id", bookingId)).data).toEqual([
      { rating: 4 },
    ]);
    expect((await a.staff.db.from("reviews").select("id").eq("booking_id", bookingId)).data).toHaveLength(0); // aOther's visit
    expect((await b.owner.db.from("reviews").select("id").eq("booking_id", bookingId)).data).toHaveLength(0);
    expect((await anon().from("reviews").select("id")).data ?? []).toHaveLength(0);
  });

  it("owner/admin reply and hide; staff and other businesses cannot; hidden reviews leave the page", async () => {
    const id = (await admin().from("reviews").select("id").eq("booking_id", bookingId).single()).data!.id;
    expect(
      (await a.staff.db.rpc("moderate_review", { p_id: id, p_status: "hidden", p_reply: "" })).error,
    ).not.toBeNull();
    expect(
      (await b.owner.db.rpc("moderate_review", { p_id: id, p_status: "hidden", p_reply: "" })).error,
    ).not.toBeNull();
    expect(
      (await a.owner.db.rpc("moderate_review", { p_id: id, p_status: "published", p_reply: "მადლობა" }))
        .error,
    ).toBeNull();
    let pub = (await admin().rpc("public_reviews", { p_tenant: a.id })).data as {
      count: number;
      items: { reply: string }[];
    };
    expect(pub.count).toBe(1);
    expect(pub.items[0].reply).toBe("მადლობა");
    await a.owner.db.rpc("moderate_review", { p_id: id, p_status: "hidden", p_reply: "მადლობა" });
    pub = (await admin().rpc("public_reviews", { p_tenant: a.id })).data as typeof pub;
    expect(pub.count).toBe(0);
    await admin().from("tenant_settings").update({ reviews_public: false }).eq("tenant_id", a.id);
    expect((await admin().rpc("public_reviews", { p_tenant: a.id })).data).toBeNull();
  });
});

describe("card billing (031)", () => {
  it("only the owner starts a payment, at the price stored here", async () => {
    expect(
      (await a.adminUser.db.rpc("billing_start", { p_tenant: a.id, p_kind: "plan", p_code: "pro" })).error,
    ).not.toBeNull();
    expect(
      (await a.staff.db.rpc("billing_start", { p_tenant: a.id, p_kind: "plan", p_code: "pro" })).error,
    ).not.toBeNull();
    expect(
      (await b.owner.db.rpc("billing_start", { p_tenant: a.id, p_kind: "plan", p_code: "pro" })).error,
    ).not.toBeNull();
    expect(
      (await a.owner.db.rpc("billing_start", { p_tenant: a.id, p_kind: "plan", p_code: "trial" })).error,
    ).not.toBeNull();
    const r = await a.owner.db.rpc("billing_start", { p_tenant: a.id, p_kind: "plan", p_code: "pro" });
    expect(r.error).toBeNull();
    const price = (await admin().from("plans").select("price_minor").eq("code", "pro").single()).data!
      .price_minor;
    expect(r.data![0].amount_minor).toBe(price);
  });

  it("an approved callback activates the plan once; a wrong amount grants nothing; monthly charges extend it", async () => {
    const start = (await a.owner.db.rpc("billing_start", { p_tenant: a.id, p_kind: "plan", p_code: "pro" }))
      .data![0];
    // users can never apply a payment themselves
    expect(
      (
        await a.owner.db.rpc("billing_apply", {
          p_order: start.id,
          p_status: "approved",
          p_amount: start.amount_minor,
          p_payment_id: "1",
          p_card: "4444",
        })
      ).error,
    ).not.toBeNull();
    const wrong = await admin().rpc("billing_apply", {
      p_order: start.id,
      p_status: "approved",
      p_amount: 1,
      p_payment_id: "1",
      p_card: "444455XXXXXX1111",
    });
    expect(wrong.data).toBe("mismatch");
    expect((await admin().from("tenants").select("status").eq("id", a.id).single()).data!.status).toBe(
      "trial",
    );

    const again = (await a.owner.db.rpc("billing_start", { p_tenant: a.id, p_kind: "plan", p_code: "pro" }))
      .data![0];
    const ok = await admin().rpc("billing_apply", {
      p_order: again.id,
      p_status: "approved",
      p_amount: again.amount_minor,
      p_payment_id: "2",
      p_card: "444455XXXXXX1111",
    });
    expect(ok.data).toBe("approved");
    const t1 = (
      await admin().from("tenants").select("plan, status, paid_until, autopay").eq("id", a.id).single()
    ).data!;
    expect(t1).toMatchObject({ plan: "pro", status: "active", autopay: true });
    expect(
      (
        await admin().rpc("billing_apply", {
          p_order: again.id,
          p_status: "approved",
          p_amount: again.amount_minor,
          p_payment_id: "2",
          p_card: "",
        })
      ).data,
    ).toBe("already");

    // next month's automatic charge: a new order under the first one
    const child = await admin().rpc("billing_apply", {
      p_order: "flitt-recurring-1",
      p_status: "approved",
      p_amount: again.amount_minor,
      p_payment_id: "3",
      p_card: "",
      p_parent: again.id,
    });
    expect(child.data).toBe("approved");
    const t2 = (await admin().from("tenants").select("paid_until").eq("id", a.id).single()).data!;
    expect(new Date(t2.paid_until!).getTime() - new Date(t1.paid_until!).getTime()).toBeGreaterThan(
      27 * 86_400_000,
    );
    expect(
      (
        await admin().rpc("billing_apply", {
          p_order: "flitt-recurring-1",
          p_status: "approved",
          p_amount: again.amount_minor,
          p_payment_id: "3",
          p_card: "",
          p_parent: again.id,
        })
      ).data,
    ).toBe("duplicate");
  });

  it("an SMS pack adds its SMS once; other businesses see none of it", async () => {
    const sum = async () =>
      ((await admin().from("sms_credit_ledger").select("delta").eq("tenant_id", a.id)).data ?? []).reduce(
        (s, r) => s + r.delta,
        0,
      );
    const before = await sum();
    const p = (
      await a.owner.db.rpc("billing_start", { p_tenant: a.id, p_kind: "sms_pack", p_code: "sms500" })
    ).data![0];
    await admin().rpc("billing_apply", {
      p_order: p.id,
      p_status: "approved",
      p_amount: p.amount_minor,
      p_payment_id: "9",
      p_card: "",
    });
    await admin().rpc("billing_apply", {
      p_order: p.id,
      p_status: "approved",
      p_amount: p.amount_minor,
      p_payment_id: "9",
      p_card: "",
    });
    expect((await sum()) - before).toBe(p.segments);
    expect((await b.owner.db.from("billing_payments").select("id").eq("tenant_id", a.id)).data).toHaveLength(
      0,
    );
    expect(
      (await a.adminUser.db.from("billing_payments").select("id").eq("tenant_id", a.id)).data,
    ).toHaveLength(0);
    expect(
      (await a.owner.db.from("billing_payments").select("id").eq("tenant_id", a.id)).data!.length,
    ).toBeGreaterThan(0);
  });
});
