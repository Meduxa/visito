// Demo data for the dev project: one salon and one dental clinic, each with an
// owner, an administrator and a staff member. Safe to re-run: it removes the
// previous demo data first. Never run against production.
//
//   npm run db:seed
//
// Demo sign-ins (dev only), password for all of them: Demo-Visito-2026
//   salon.owner@demo.test   salon.admin@demo.test   salon.staff@demo.test
//   dental.owner@demo.test  dental.admin@demo.test  dental.doctor@demo.test
//   platform.admin@demo.test  (platform admin area /admin, no business of its own)
//
// Services, staff schedules and clients are added to this seed in Phase 1.

import { createClient } from "@supabase/supabase-js";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { assertDevProject } from "./dev-project.mts";

const DEMO_PASSWORD = "Demo-Visito-2026";
const PLATFORM_ADMIN = "platform.admin@demo.test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  process.exit(1);
}
try {
  assertDevProject(url, "Demo seeding");
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

type Role = "owner" | "admin" | "staff";

// one distinct colour per demo salon service (calendar "Colour: service")
const SERVICE_COLORS: Record<string, string> = {
  "ქალის თმის შეჭრა": "teal",
  "კაცის თმის შეჭრა": "blue",
  დავარცხნა: "sky",
  "შეღებვა X პროდუქტით": "violet",
  "აფრიკული ნაწნავები": "indigo",
  "მანიკური გელ-ლაქით": "pink",
  "კლასიკური მანიკური": "rose",
  პედიკური: "orange",
  "წარბის კორექცია": "amber",
  "წამწამების ლამინირება": "green",
};

const tenants = [
  {
    slug: "orchidea",
    name: "სალონი ორქიდეა",
    type: "salon",
    people: [
      { email: "salon.owner@demo.test", name: "ნინო ბერიძე", role: "owner" },
      { email: "salon.admin@demo.test", name: "მარიამ კაპანაძე", role: "admin" },
      { email: "salon.staff@demo.test", name: "ანა გელაშვილი", role: "staff" },
    ],
  },
  {
    slug: "demo-dental",
    name: "დენტალ სმაილი",
    type: "dental",
    people: [
      { email: "dental.owner@demo.test", name: "გიორგი ლომიძე", role: "owner" },
      { email: "dental.admin@demo.test", name: "თამარ ჩხეიძე", role: "admin" },
      { email: "dental.doctor@demo.test", name: "დავით მაისურაძე", role: "staff" },
    ],
  },
] as const satisfies readonly {
  slug: string;
  name: string;
  type: "salon" | "dental";
  people: readonly { email: string; name: string; role: Role }[];
}[];

function check<T>(
  label: string,
  result: { data: T; error: { message: string } | null },
): NonNullable<T> | null {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? null;
}

function must<T>(label: string, result: { data: T; error: { message: string } | null }): NonNullable<T> {
  const data = check(label, result);
  if (data === null) throw new Error(`${label}: no data returned`);
  return data;
}

async function removePreviousDemo() {
  const slugs = tenants.map((t) => t.slug);
  check("delete demo tenants", await db.from("tenants").delete().in("slug", slugs));

  const emails = new Set<string>([...tenants.flatMap((t) => t.people.map((p) => p.email)), PLATFORM_ADMIN]);
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email && emails.has(u.email)) await db.auth.admin.deleteUser(u.id);
    }
    if (data.users.length < 200) break;
  }
}

async function existingUserId(email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) return u.id;
    if (data.users.length < 200) return null;
  }
}

async function seed() {
  await removePreviousDemo();

  // a demo platform admin (for /admin); real admins: npm.cmd run platform-admin -- <email>
  const { data: pa, error: paError } = await db.auth.admin.createUser({
    email: PLATFORM_ADMIN,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Platform Admin", locale: "ka" },
  });
  // The account survives when someone signed up a business with it (it then owns that
  // business and cannot be deleted): keep it, reset its password, leave the business alone.
  const adminId = pa.user?.id ?? (paError ? await existingUserId(PLATFORM_ADMIN) : null);
  if (!adminId) throw new Error(`create ${PLATFORM_ADMIN}: ${paError?.message}`);
  if (!pa.user) {
    const { error } = await db.auth.admin.updateUserById(adminId, { password: DEMO_PASSWORD });
    if (error) throw new Error(`platform admin password: ${error.message}`);
  }
  check(
    "platform admin",
    await db
      .from("platform_admins")
      .upsert({ user_id: adminId }, { onConflict: "user_id", ignoreDuplicates: true }),
  );

  for (const t of tenants) {
    const userIds: Record<string, string> = {};
    for (const p of t.people) {
      const { data, error } = await db.auth.admin.createUser({
        email: p.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: p.name, locale: "ka" },
      });
      // an account that also owns another business (someone signed one up with it) cannot be
      // deleted: keep it and reset its password; that other business is left alone
      const id = data.user?.id ?? (error ? await existingUserId(p.email) : null);
      if (!id) throw new Error(`create ${p.email}: ${error?.message}`);
      if (!data.user) {
        const { error: pwError } = await db.auth.admin.updateUserById(id, { password: DEMO_PASSWORD });
        if (pwError) throw new Error(`password ${p.email}: ${pwError.message}`);
      }
      userIds[p.email] = id;
    }

    const owner = t.people.find((p) => p.role === "owner")!;
    const tenant = must(
      `tenant ${t.slug}`,
      await db
        .from("tenants")
        .insert({ slug: t.slug, name: t.name, type: t.type, created_by: userIds[owner.email] })
        .select("id")
        .single(),
    );

    check(
      `memberships ${t.slug}`,
      await db
        .from("memberships")
        .insert(t.people.map((p) => ({ tenant_id: tenant.id, user_id: userIds[p.email], role: p.role }))),
    );
    check(
      `audit ${t.slug}`,
      await db.from("audit_log").insert({
        tenant_id: tenant.id,
        action: "tenant.seeded",
        entity: "tenant",
        entity_id: tenant.id,
      }),
    );
    // demo businesses get plenty of SMS credits (real ones start with 50 trial SMS)
    check(
      `sms credits ${t.slug}`,
      await db.rpc("sms_topup", { p_tenant: tenant.id, p_segments: 5000, p_note: "demo" }),
    );
    const staffUser = t.people.find((p) => p.role === "staff")!;
    const counts = await seedCatalog(tenant.id, t.type, userIds[staffUser.email]);
    console.log(
      `✓ ${t.name} (${t.type}) — /book/${t.slug} — ${t.people.length} logins, ${counts.services} services, ${counts.staff} staff, ${counts.clients} clients, ${counts.bookings} bookings`,
    );
  }
}

// ---------------------------------------------------------------------------
// Phase 1 demo data: categories, services (incl. the spec's examples), staff
// with schedules and services, resources (dental), clients with consents.
// ---------------------------------------------------------------------------

type Svc = [
  name: string,
  priceGel: number,
  minutes: number,
  extra?: { type?: "from" | "range"; max?: number; buffer?: number },
];

const CATALOG: Record<"salon" | "dental", { category: string; services: Svc[] }[]> = {
  salon: [
    {
      category: "თმა",
      services: [
        ["ქალის თმის შეჭრა", 55, 45],
        ["შეღებვა X პროდუქტით", 80, 120, { buffer: 15 }],
        ["დავარცხნა", 25, 30, { type: "from" }],
        ["აფრიკული ნაწნავები", 250, 240, { type: "range", max: 300 }],
        ["კაცის თმის შეჭრა", 25, 30],
      ],
    },
    {
      category: "ფრჩხილები",
      services: [
        ["მანიკური გელ-ლაქით", 45, 75],
        ["კლასიკური მანიკური", 20, 40],
        ["პედიკური", 50, 60],
      ],
    },
    {
      category: "წარბები და წამწამები",
      services: [
        ["წარბის კორექცია", 20, 20],
        ["წამწამების ლამინირება", 100, 60],
      ],
    },
  ],
  dental: [
    {
      category: "კონსულტაცია",
      services: [["სტომატოლოგის კონსულტაცია", 30, 30]],
    },
    {
      category: "ჰიგიენა",
      services: [
        ["პროფესიონალური წმენდა", 120, 60, { buffer: 10 }],
        ["გათეთრება", 400, 90, { type: "from" }],
      ],
    },
    {
      category: "თერაპია",
      services: [
        ["კარიესის მკურნალობა", 80, 60, { type: "range", max: 150, buffer: 10 }],
        ["არხის მკურნალობა", 250, 90, { type: "from", buffer: 10 }],
      ],
    },
  ],
};

const STAFF = {
  salon: [
    { name: "ანა გელაშვილი", position: "უფროსი სტილისტი", type: "master", color: "violet", linkLogin: true },
    { name: "ეკა მაჭავარიანი", position: "სტილისტი", type: "master", color: "teal", linkLogin: false },
    { name: "სოფო ნოზაძე", position: "მანიკურის ოსტატი", type: "master", color: "pink", linkLogin: false },
    { name: "გიორგი მელაძე", position: "კოლორისტი", type: "master", color: "green", linkLogin: false },
    { name: "ლევან ქავთარაძე", position: "ბარბერი", type: "master", color: "sky", linkLogin: false },
    { name: "ნიკა ჯავახიშვილი", position: "სტილისტი", type: "master", color: "orange", linkLogin: false },
  ],
  dental: [
    {
      name: "დავით მაისურაძე",
      position: "სტომატოლოგი-თერაპევტი",
      type: "doctor",
      color: "blue",
      linkLogin: true,
    },
    { name: "ნათია ბერიძე", position: "ჰიგიენისტი", type: "doctor", color: "green", linkLogin: false },
  ],
} as const;

const FIRST = [
  "ნინო",
  "მარიამ",
  "ანა",
  "თამარ",
  "ეკა",
  "სალომე",
  "ნათია",
  "ქეთი",
  "ლიკა",
  "მაკა",
  "გიორგი",
  "დავით",
  "ლევან",
  "ირაკლი",
  "ნიკა",
];
const LAST = [
  "ბერიძე",
  "კაპანაძე",
  "გელაშვილი",
  "ლომიძე",
  "ჩხეიძე",
  "მაისურაძე",
  "ნოზაძე",
  "ხარაძე",
  "წიკლაური",
  "ჯაფარიძე",
];

async function seedCatalog(tenantId: string, type: "salon" | "dental", staffLoginUserId: string) {
  const serviceIds: string[] = [];
  for (const [ci, group] of CATALOG[type].entries()) {
    const cat = must(
      "category",
      await db
        .from("service_categories")
        .insert({ tenant_id: tenantId, name_i18n: { ka: group.category }, sort_order: ci + 1 })
        .select("id")
        .single(),
    );
    for (const [si, [name, gel, minutes, extra]] of group.services.entries()) {
      const svc = must(
        `service ${name}`,
        await db
          .from("services")
          .insert({
            tenant_id: tenantId,
            category_id: cat.id,
            name_i18n: { ka: name },
            price_type: extra?.type ?? "fixed",
            price_minor: gel * 100,
            price_max_minor: extra?.max ? extra.max * 100 : null,
            duration_min: minutes,
            buffer_after_min: extra?.buffer ?? 0,
            resource_type: type === "dental" ? "chair" : null,
            color: SERVICE_COLORS[name] ?? null,
            sort_order: ci * 100 + si,
          })
          .select("id")
          .single(),
      );
      serviceIds.push(svc.id);
    }
  }

  const { data: loc } = await db
    .from("locations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_primary", true)
    .single();
  check(
    "settings",
    await db
      .from("tenant_settings")
      .update({ phone: "+995322000000", email: "info@example.test" })
      .eq("tenant_id", tenantId),
  );
  await seedWebsite(tenantId, type);
  check(
    "address",
    await db.from("locations").update({ address: "თბილისი, ჭავჭავაძის გამზ. 1" }).eq("id", loc!.id),
  );

  if (type === "dental") {
    check(
      "resources",
      await db.from("resources").insert(
        ["სავარძელი 1", "სავარძელი 2"].map((name, i) => ({
          tenant_id: tenantId,
          location_id: loc!.id,
          name,
          type: "chair",
          sort_order: i,
        })),
      ),
    );
  }

  const staffIds: string[] = [];
  for (const [i, s] of STAFF[type].entries()) {
    const row = must(
      `staff ${s.name}`,
      await db
        .from("staff")
        .insert({
          tenant_id: tenantId,
          location_id: loc!.id,
          display_name: s.name,
          position: s.position,
          position_type: s.type,
          color: s.color,
          sort_order: i,
        })
        .select("id")
        .single(),
    );
    staffIds.push(row.id);
    // salon team: portraits of made-up people (Figma AI, scripts/seed-assets/team)
    const portrait = type === "salon" ? ["tamar", "eka", "sopo", "giorgi", "levan", "nika"][i] : undefined;
    if (portrait) {
      const { readFile } = await import("node:fs/promises");
      const path = `${tenantId}/${row.id}-demo.jpg`;
      check(
        "staff photo",
        await db.storage
          .from("staff-photos")
          .upload(path, await readFile(`scripts/seed-assets/team/${portrait}.jpg`), {
            contentType: "image/jpeg",
            upsert: true,
          }),
      );
      check("staff photo path", await db.from("staff").update({ photo_path: path }).eq("id", row.id));
    }
    // Mon–Fri 10–19 with a lunch break; first person also works Saturday
    const days = i === 0 ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
    check(
      "schedule",
      await db.from("staff_schedules").insert(
        days.flatMap((d) => [
          { tenant_id: tenantId, staff_id: row.id, weekday: d, start_time: "10:00", end_time: "14:00" },
          { tenant_id: tenantId, staff_id: row.id, weekday: d, start_time: "15:00", end_time: "19:00" },
        ]),
      ),
    );
    // everyone performs every service at the service's own price
    check(
      "staff services",
      await db.from("staff_services").insert(
        serviceIds.map((sid) => ({
          tenant_id: tenantId,
          staff_id: row.id,
          service_id: sid,
          price_minor_override: null as number | null,
        })),
      ),
    );
    if (s.linkLogin) {
      check(
        "link login",
        await db
          .from("memberships")
          .update({ staff_id: row.id })
          .eq("tenant_id", tenantId)
          .eq("user_id", staffLoginUserId),
      );
    }
  }

  // ~30 clients with Georgian names; deterministic so re-seeding looks the same
  const clients = Array.from({ length: 30 }, (_, i) => ({
    tenant_id: tenantId,
    first_name: FIRST[i % FIRST.length],
    last_name: LAST[(i * 7) % LAST.length],
    phone_e164: `+9955${type === "salon" ? "55" : "99"}${String(100000 + i * 3137).padStart(6, "0")}`,
    email: i % 3 === 0 ? `client${i}.${type}@example.test` : null,
    birthday:
      i % 2 === 0
        ? `19${70 + (i % 30)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`
        : null,
    source: (["instagram", "walk_in", "phone", "referral", "facebook"] as const)[i % 5],
    tags: i % 7 === 0 ? ["VIP"] : [],
    important_note: i === 3 ? (type === "dental" ? "ალერგია ლიდოკაინზე" : "ალერგია ამიაკზე") : null,
    preferred_staff_id: i % 4 === 0 ? staffIds[0] : null,
  }));
  const inserted = must("clients", await db.from("clients").insert(clients).select("id"));
  check(
    "consents",
    await db.from("client_consents").insert(
      inserted
        .filter((_, i) => i % 2 === 0)
        .map((c) => ({
          tenant_id: tenantId,
          client_id: c.id,
          channel: "sms",
          granted: true,
          source: "import",
        })),
    ),
  );

  const bookings =
    (await seedBookings(
      tenantId,
      staffIds,
      inserted.map((c) => c.id),
    )) +
    (await seedHistory(
      tenantId,
      staffIds,
      inserted.map((c) => c.id),
    ));
  await seedPay(tenantId, staffIds);
  if (type === "salon") await seedReviewsAndRequests(tenantId);
  if (type === "salon")
    await seedClientFields(
      tenantId,
      inserted.map((c) => c.id),
    );
  return { services: serviceIds.length, staff: staffIds.length, clients: inserted.length, bookings };
}

// Bookings from 3 days ago to 6 days ahead, Mon–Sat, at times that never
// overlap (10:00, 12:00, 15:00, 17:00 — services up to 105 min incl. break).
async function seedBookings(tenantId: string, staffIds: string[], clientIds: string[]) {
  const { data: services } = await db
    .from("services")
    .select("id, name_i18n, price_type, price_minor, duration_min, buffer_after_min")
    .eq("tenant_id", tenantId);
  const usable = (services ?? []).filter((s) => s.duration_min + s.buffer_after_min <= 105);
  const { data: chairs } = await db
    .from("resources")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("sort_order");
  const tz = "Asia/Tbilisi";
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  let n = 0;

  for (let offset = -3; offset <= 6; offset++) {
    const day = new Date(`${today}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + offset);
    if (day.getUTCDay() === 0) continue; // Sunday
    const date = day.toISOString().slice(0, 10);
    for (const [si, staffId] of staffIds.entries()) {
      if (day.getUTCDay() === 6 && si > 0) continue; // only the first person works Saturdays
      for (const [ti, time] of ["10:00", "12:00", "15:00", "17:00"].entries()) {
        if ((si + ti + offset) % 3 === 2) continue; // leave gaps
        const svc = usable[(si * 3 + ti + offset + 30) % usable.length];
        const start = fromZonedTime(`${date}T${time}`, tz);
        const end = new Date(start.getTime() + svc.duration_min * 60_000);
        const status =
          offset < 0
            ? n % 9 === 0
              ? "no_show"
              : "completed"
            : offset === 0 && time < "13:00"
              ? "completed"
              : "confirmed";
        const b = must(
          "booking",
          await db
            .from("bookings")
            .insert({
              tenant_id: tenantId,
              // the first 20 clients only: the rest stay free to show "at risk" and "lost" (seedHistory)
              client_id: clientIds[(n * 7) % Math.min(clientIds.length, 20)],
              starts_at: start.toISOString(),
              ends_at: end.toISOString(),
              status,
              source: n % 4 === 0 ? "phone" : "admin",
              total_minor: svc.price_minor,
            })
            .select("id")
            .single(),
        );
        check(
          "booking item",
          await db.from("booking_items").insert({
            tenant_id: tenantId,
            booking_id: b.id,
            service_id: svc.id,
            staff_id: staffId,
            resource_id: chairs?.length ? chairs[si % chairs.length].id : null,
            name_snapshot: (svc.name_i18n as { ka: string }).ka,
            price_type_snapshot: svc.price_type,
            price_minor_snapshot: svc.price_minor,
            duration_min_snapshot: svc.duration_min,
            buffer_min_snapshot: svc.buffer_after_min,
            starts_at: start.toISOString(),
            ends_at: end.toISOString(),
            blocked_until: new Date(end.getTime() + svc.buffer_after_min * 60_000).toISOString(),
            active: status !== "no_show",
          }),
        );
        check(
          "history",
          await db
            .from("booking_status_history")
            .insert({ tenant_id: tenantId, booking_id: b.id, to_status: status }),
        );
        n++;
      }
    }
  }
  return n;
}

// A year of earlier, completed visits, so the client groups (decision 024) and
// the visit numbers look like a real business: some clients come every few
// weeks (VIP, regular), some stopped coming (at risk, lost), some are new.
// Starts 5 days ago (seedBookings covers the days around today) and never
// puts one specialist twice in the same hour.
async function seedHistory(tenantId: string, staffIds: string[], clientIds: string[]) {
  const { data: services } = await db
    .from("services")
    .select("id, name_i18n, price_type, price_minor, duration_min, buffer_after_min")
    .eq("tenant_id", tenantId);
  const usable = (services ?? []).filter((s) => s.duration_min + s.buffer_after_min <= 55);
  if (!usable.length || !staffIds.length) return 0;
  const tz = "Asia/Tbilisi";
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  // [days ago of the last visit, number of visits, days between visits]
  type Pattern = [number, number, number];
  const vip: Pattern = [8, 7, 21];
  const regular: Pattern = [20, 3, 28];
  const regular2: Pattern = [12, 2, 30];
  const atRisk: Pattern = [100, 3, 35];
  const lost: Pattern = [240, 2, 40];
  const none: Pattern = [0, 0, 0]; // new: only the visits around today, if any
  // clients already booked around today can't look inactive: they get the busy patterns
  const { data: recent } = await db.from("bookings").select("client_id").eq("tenant_id", tenantId);
  const busy = new Set((recent ?? []).map((r) => r.client_id));
  const quiet = [atRisk, lost, atRisk, lost, none];
  const active = [vip, regular, regular2, vip, regular, none];
  let qi = 0;
  let ai = 0;
  const taken = new Set<string>();
  let n = 0;
  for (const [ci, clientId] of clientIds.entries()) {
    const [last, count, gap] = busy.has(clientId) ? active[ai++ % active.length] : quiet[qi++ % quiet.length];
    for (let k = 0; k < count; k++) {
      const daysAgo = 5 + last + k * gap + (ci % 4);
      const day = new Date(`${today}T12:00:00Z`);
      day.setUTCDate(day.getUTCDate() - daysAgo);
      if (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() - 1); // closed on Sunday
      const date = day.toISOString().slice(0, 10);
      let si = (ci + k) % staffIds.length;
      let hour = 10 + ((ci + k) % 8);
      while (taken.has(`${si}|${date}|${hour}`)) {
        hour = hour >= 18 ? 10 : hour + 1;
        if (hour === 10) si = (si + 1) % staffIds.length;
      }
      taken.add(`${si}|${date}|${hour}`);
      const svc = usable[(ci + k) % usable.length];
      const start = fromZonedTime(`${date}T${String(hour).padStart(2, "0")}:00`, tz);
      const end = new Date(start.getTime() + svc.duration_min * 60_000);
      const b = must(
        "past booking",
        await db
          .from("bookings")
          .insert({
            tenant_id: tenantId,
            client_id: clientId,
            starts_at: start.toISOString(),
            ends_at: end.toISOString(),
            status: "completed",
            source: k % 3 === 0 ? "online" : "admin",
            total_minor: svc.price_minor,
            created_at: new Date(start.getTime() - 3 * 86_400_000).toISOString(),
          })
          .select("id")
          .single(),
      );
      check(
        "past booking item",
        await db.from("booking_items").insert({
          tenant_id: tenantId,
          booking_id: b.id,
          service_id: svc.id,
          staff_id: staffIds[si],
          name_snapshot: (svc.name_i18n as { ka: string }).ka,
          price_type_snapshot: svc.price_type,
          price_minor_snapshot: svc.price_minor,
          duration_min_snapshot: svc.duration_min,
          buffer_min_snapshot: svc.buffer_after_min,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          blocked_until: new Date(end.getTime() + svc.buffer_after_min * 60_000).toISOString(),
        }),
      );
      check(
        "past history",
        await db
          .from("booking_status_history")
          .insert({ tenant_id: tenantId, booking_id: b.id, to_status: "completed" }),
      );
      n++;
    }
  }
  return n;
}

// Payroll (decision 025): pay schemes, one category rate, a bonus and a
// deduction this month, and last month partly paid — so /payroll shows numbers.
// Own client fields (decision 026): a few salon-style fields, filled on some cards.
async function seedClientFields(tenantId: string, clientIds: string[]) {
  const defs = [
    { label: "თმის ტიპი", kind: "choice", options: ["მშრალი", "ნორმალური", "ცხიმიანი"] },
    { label: "ფერის ფორმულა", kind: "text", options: [] },
    { label: "ალერგია", kind: "yesno", options: [] },
    { label: "პატჩ-ტესტი", kind: "date", options: [] },
  ];
  const fields = must(
    "client fields",
    await db
      .from("client_fields")
      .insert(defs.map((d, i) => ({ ...d, tenant_id: tenantId, sort_order: i })))
      .select("id, kind"),
  );
  const [hair, formula, allergy, patch] = fields.map((f) => f.id);
  const types = ["მშრალი", "ნორმალური", "ცხიმიანი"];
  const formulas = ["7/1 + 6% 1:1", "8/0 + 3%", "6/3 + 9%", "9/1 + 6% 1:2"];
  for (const [i, id] of clientIds.slice(0, 12).entries()) {
    const custom: Record<string, string | boolean> = { [hair]: types[i % 3] };
    if (i % 2 === 0) custom[formula] = formulas[i % formulas.length];
    if (i % 5 === 0) custom[allergy] = true;
    if (i % 4 === 0) custom[patch] = `2026-${String(1 + (i % 9)).padStart(2, "0")}-1${i % 9}`;
    check("client custom", await db.from("clients").update({ custom }).eq("id", id));
  }
}

// Reviews and a time-off request (decisions 029, 030): a few rated visits, one
// with the owner's reply, review requests switched on; the demo specialist with a
// login has asked for two days off next month.
async function seedReviewsAndRequests(tenantId: string) {
  check(
    "review settings",
    await db
      .from("tenant_settings")
      .update({ reviews_ask: true, reviews_public: true })
      .eq("tenant_id", tenantId),
  );
  const { data: visits } = await db
    .from("bookings")
    .select("id, client_id, booking_items(staff_id, sort_order)")
    .eq("tenant_id", tenantId)
    .eq("status", "completed")
    .order("starts_at", { ascending: false })
    .limit(7);
  const said: [number, string | null, string | null][] = [
    [5, "ძალიან კმაყოფილი ვარ, ანამ ზუსტად ის გააკეთა, რაც მინდოდა.", "მადლობა, ნინო! მალე გელოდებით 🌸"],
    [5, "სასიამოვნო გარემო და ზუსტად დროზე მიმიღეს.", null],
    [4, "კარგი მომსახურება, ოღონდ ცოტა დამაგვიანდა რიგი.", null],
    [5, null, null],
    [3, "შედეგი კარგია, მაგრამ ფასი ცოტა მაღალია.", "გმადლობთ შეფასებისთვის — გავითვალისწინებთ."],
    [5, "საუკეთესო მანიკური ქალაქში!", null],
  ];
  for (const [i, v] of (visits ?? []).slice(0, said.length).entries()) {
    const [rating, comment, reply] = said[i];
    const items = (v.booking_items as { staff_id: string; sort_order: number }[]).sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    check(
      "review",
      await db.from("reviews").insert({
        tenant_id: tenantId,
        booking_id: v.id,
        client_id: v.client_id,
        staff_id: items[0]?.staff_id ?? null,
        rating,
        comment,
        reply,
        replied_at: reply ? new Date().toISOString() : null,
      }),
    );
  }
  const { data: me } = await db
    .from("memberships")
    .select("staff_id")
    .eq("tenant_id", tenantId)
    .eq("role", "staff")
    .not("staff_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (me?.staff_id) {
    const start = new Date();
    start.setUTCMonth(start.getUTCMonth() + 1, 10);
    start.setUTCHours(-4, 0, 0, 0); // midnight in Tbilisi
    const end = new Date(start.getTime() + 2 * 86_400_000);
    check(
      "time-off request",
      await db.from("time_off_requests").insert({
        tenant_id: tenantId,
        staff_id: me.staff_id,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        reason: "vacation",
        note: "ოჯახური მოგზაურობა",
      }),
    );
  }
}

async function seedPay(tenantId: string, staffIds: string[]) {
  const pct = [40, 35, 30, 45, 30, 35];
  const salary = [60000, 0, 40000, 0, 0, 0];
  for (const [i, id] of staffIds.entries()) {
    check(
      "commission",
      await db
        .from("staff")
        .update({ commission_pct: pct[i % pct.length] })
        .eq("id", id),
    );
    check(
      "staff pay",
      await db
        .from("staff_pay")
        .insert({ tenant_id: tenantId, staff_id: id, salary_minor: salary[i % salary.length] }),
    );
  }
  const { data: cat } = await db
    .from("service_categories")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  if (cat && staffIds[0])
    check(
      "pay rate",
      await db
        .from("staff_pay_rates")
        .insert({ tenant_id: tenantId, staff_id: staffIds[0], category_id: cat.id, pct: 50 }),
    );
  const month = formatInTimeZone(new Date(), "Asia/Tbilisi", "yyyy-MM");
  const [y, m] = month.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  if (staffIds.length >= 2) {
    check(
      "pay adjustments",
      await db.from("pay_adjustments").insert([
        {
          tenant_id: tenantId,
          staff_id: staffIds[0],
          month: `${month}-01`,
          kind: "bonus",
          amount_minor: 10000,
          note: "გეგმის შესრულება",
        },
        {
          tenant_id: tenantId,
          staff_id: staffIds[1],
          month: `${month}-01`,
          kind: "deduction",
          amount_minor: 2000,
          note: "დაგვიანება",
        },
      ]),
    );
    check(
      "payouts",
      // last month: the fixed salary was paid; the % part is still owed
      await db.from("payouts").insert(
        staffIds
          .map((id, i) => ({ id, salary: salary[i % salary.length] }))
          .filter((x) => x.salary > 0)
          .map((x, i) => ({
            tenant_id: tenantId,
            staff_id: x.id,
            month: prev,
            amount_minor: x.salary,
            method: i === 0 ? "transfer" : "cash",
            paid_on: `${month}-05`,
          })),
      ),
    );
  }
}

seed().then(
  () => console.log("Seed complete."),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);

// The business website: a soft abstract cover and logo (drawn here, no stock
// photos), an about text in three languages, a social link and a colour theme.
async function seedWebsite(tenantId: string, type: "salon" | "dental") {
  const sharp = (await import("sharp")).default;
  const [a, b] = type === "salon" ? ["#f4c6cf", "#b5476a"] : ["#c7def4", "#2f6fa8"];
  const { readFile } = await import("node:fs/promises");
  const cover =
    type === "salon"
      ? await readFile("scripts/seed-assets/salon-cover.jpg")
      : await sharp(
          Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="700">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
        <rect width="1600" height="700" fill="url(#g)"/>
        <circle cx="1250" cy="160" r="260" fill="#fff" opacity="0.18"/>
        <circle cx="300" cy="620" r="340" fill="#fff" opacity="0.12"/>
        <circle cx="820" cy="330" r="120" fill="#fff" opacity="0.1"/>
      </svg>`,
          ),
        )
          .jpeg({ quality: 82 })
          .toBuffer();
  const logo =
    type === "salon"
      ? await readFile("scripts/seed-assets/salon-logo.jpg")
      : await sharp(
          Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
        <rect width="400" height="400" fill="${b}"/>
        <circle cx="200" cy="200" r="110" fill="none" stroke="#fff" stroke-width="26"/>
        <circle cx="200" cy="200" r="34" fill="#fff"/>
      </svg>`,
          ),
        )
          .png()
          .toBuffer();
  const up = async (name: string, body: Buffer, contentType: string) => {
    const path = `${tenantId}/${name}`;
    check(
      "website image",
      await db.storage.from("business-photos").upload(path, body, { contentType, upsert: true }),
    );
    return path;
  };
  const about =
    type === "salon"
      ? {
          ka: "სალონი ორქიდეა ვაკეში — თმის მოვლა, მანიკური, პედიკური და მაკიაჟი მშვიდ, ნათელ სივრცეში. გელით ყოველდღე, 10:00-დან 20:00-მდე.",
          en: "Salon Orchid in Vake — hair, nails and make-up in a calm, light-filled space. Open every day, 10:00 to 20:00.",
          ru: "Салон «Орхидея» в Ваке — волосы, ногти и макияж в спокойном светлом пространстве. Ждём вас каждый день с 10:00 до 20:00.",
        }
      : {
          ka: "ოჯახის სტომატოლოგიური კლინიკა — პროფილაქტიკა, მკურნალობა და ჰიგიენა.",
          en: "A family dental clinic — check-ups, treatment and hygiene.",
          ru: "Семейная стоматология — профилактика, лечение и гигиена.",
        };
  check(
    "website",
    await db
      .from("tenant_settings")
      .update({
        site_cover_path: await up("cover-demo.jpg", cover, "image/jpeg"),
        site_logo_path:
          type === "salon"
            ? await up("logo-demo.jpg", logo, "image/jpeg")
            : await up("logo-demo.png", logo, "image/png"),
        site_about: about,
        site_instagram: type === "salon" ? "salon.orchid.demo" : "dental.smile.demo",
        site_theme: type === "salon" ? "rose" : "ocean",
      })
      .eq("tenant_id", tenantId),
  );
}
