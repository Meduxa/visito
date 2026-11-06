// Before-the-pilot items. Needs the dev project seeded (npm run db:seed) and .env.local.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { assertDevProject } from "../scripts/dev-project.mts";

config({ path: ".env.local", quiet: true });

const PASSWORD = "Demo-Bookeria-2026";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assertDevProject(url, "The end-to-end tests");
  return createClient(url!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
}

// A throwaway staff member of the demo salon: signing out "everywhere" must not
// end the sessions of the shared demo accounts other tests are using.
async function tempStaff(tag: string) {
  const db = admin();
  const email = `signout.${tag}.${Date.now()}@demo.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("no user");
  const { data: tenant } = await db.from("tenants").select("id").eq("slug", "demo-salon").single();
  const m = await db
    .from("memberships")
    .insert({ tenant_id: tenant!.id, user_id: data.user.id, role: "staff" });
  if (m.error) throw m.error;
  return { email, remove: () => db.auth.admin.deleteUser(data.user.id) };
}

test("sign out of all devices ends the other device's session too", async ({ browser }, info) => {
  const user = await tempStaff(info.project.name);
  try {
    const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
    const [phone, laptop] = await Promise.all([a.newPage(), b.newPage()]);
    for (const page of [phone, laptop]) {
      await page.goto("/ka/login");
      await page.getByLabel("ელფოსტა").fill(user.email);
      await page.getByLabel("პაროლი").fill(PASSWORD);
      await page.getByRole("button", { name: "შესვლა" }).click();
      await page.waitForURL(/\/ka\/(dashboard|my-day)/);
    }

    await phone
      .getByRole("button", { name: /სალონი ორქიდეა/ })
      .first()
      .click();
    await phone.getByRole("menuitem", { name: "ყველა მოწყობილობიდან გასვლა" }).click();
    await phone.getByRole("button", { name: "ყველგან გასვლა" }).click();
    await phone.waitForURL("**/ka/login");

    // the laptop's next page load finds the session gone
    await laptop.goto("/ka/clients");
    await expect(laptop).toHaveURL(/\/ka\/login/);
    await Promise.all([a.close(), b.close()]);
  } finally {
    await user.remove();
  }
});

// Cancelling a booking shows who on the waitlist wants that time; the manager offers it by SMS.
test("waitlist: offer a freed time by SMS", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop"); // changes shared demo data
  const db = admin();
  const { data: tenant } = await db.from("tenants").select("id, timezone").eq("slug", "demo-salon").single();
  const { data: b } = await db
    .from("bookings")
    .select("id, status, starts_at, clients(id, first_name), booking_items(service_id)")
    .eq("tenant_id", tenant!.id)
    .eq("status", "confirmed")
    .not("client_id", "is", null)
    .gt("starts_at", new Date(Date.now() + 2 * 86_400_000).toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .single();
  const booked = b!.clients as unknown as { id: string; first_name: string };
  const serviceId = b!.booking_items[0]!.service_id!;
  const day = new Date(b!.starts_at).toLocaleDateString("en-CA", { timeZone: tenant!.timezone });
  const { data: waiting } = await db
    .from("clients")
    .select("id, first_name, last_name")
    .eq("tenant_id", tenant!.id)
    .neq("id", booked.id)
    .not("phone_e164", "is", null)
    .is("anonymized_at", null)
    .limit(1)
    .single();
  const { data: entry } = await db
    .from("waitlist")
    .insert({
      tenant_id: tenant!.id,
      client_id: waiting!.id,
      service_id: serviceId,
      date_from: day,
      date_to: day,
    })
    .select("id")
    .single();

  try {
    await page.goto("/ka/login");
    await page.getByLabel("ელფოსტა").fill("salon.owner@demo.test");
    await page.getByLabel("პაროლი").fill(PASSWORD);
    await page.getByRole("button", { name: "შესვლა" }).click();
    await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" });
    await page.goto(`/ka/calendar?view=day&date=${day}`);
    await page.locator(`[role="button"][aria-label*="${booked.first_name}"]`).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "ჯავშნის გაუქმება" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "ჯავშნის გაუქმება" }).click();
    await page.getByRole("button", { name: "ნახვა" }).click();

    const row = page.getByRole("listitem").filter({ hasText: waiting!.first_name });
    await row.getByRole("button", { name: "SMS-ით შეთავაზება" }).click();
    await expect(row.getByRole("button", { name: "შეთავაზება გაიგზავნა" })).toBeDisabled();

    const { data: sms } = await db
      .from("sms_messages")
      .select("status, body")
      .eq("idempotency_key", `waitlist:${entry!.id}:${b!.id}`)
      .single();
    expect(sms!.body).toContain("გათავისუფლდა დრო");
    expect(["sent", "delivered"]).toContain(sms!.status);
  } finally {
    await db.from("waitlist").delete().eq("id", entry!.id);
    await db.from("bookings").update({ status: b!.status }).eq("id", b!.id);
  }
});

// Support access: the owner allows it, Visito opens the business view-only, the owner ends it.
test("support access: owner allows, support views (read-only), owner ends", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop"); // changes shared demo data
  const db = admin();
  const { data: tenant } = await db.from("tenants").select("id").eq("slug", "demo-salon").single();
  const signIn = async (email: string) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto("/ka/login");
    await page.getByLabel("ელფოსტა").fill(email);
    await page.getByLabel("პაროლი").fill(PASSWORD);
    await page.getByRole("button", { name: "შესვლა" }).click();
    await page.waitForURL(/\/ka\/(dashboard|admin)/, { waitUntil: "commit" });
    return page;
  };
  try {
    const owner = await signIn("salon.owner@demo.test");
    await owner.goto("/ka/settings/business");
    await owner.getByRole("button", { name: "ნებართვა 24 საათით" }).click();
    await expect(owner.getByText(/მხარდაჭერას შეუძლია თქვენი ბიზნესის ნახვა/)).toBeVisible();

    const support = await signIn("platform.admin@demo.test");
    await support.goto(`/ka/admin/t/${tenant!.id}`);
    await support.getByRole("button", { name: "გახსნა (მხოლოდ ნახვა)" }).click();
    await support.waitForURL("**/ka/dashboard");
    await expect(support.getByRole("alert").filter({ hasText: "მხარდაჭერის რეჟიმში" })).toBeVisible();
    const { data: c } = await db
      .from("clients")
      .select("first_name, last_name")
      .eq("tenant_id", tenant!.id)
      .not("last_name", "is", null)
      .limit(1)
      .single();
    await support.goto(`/ka/clients?q=${encodeURIComponent(c!.last_name!)}`);
    await expect(support.getByText(c!.last_name!).first()).toBeVisible();
    await support.getByRole("button", { name: "გასვლა" }).first().click();
    await support.waitForURL("**/ka/admin");

    const { data: seen } = await db
      .from("audit_log")
      .select("id")
      .eq("tenant_id", tenant!.id)
      .eq("action", "support.viewed");
    expect(seen!.length).toBeGreaterThan(0);

    await owner.reload();
    await owner.getByRole("button", { name: "წვდომის შეწყვეტა" }).click();
    await owner.getByRole("alertdialog").getByRole("button", { name: "წვდომის შეწყვეტა" }).click();
    await expect(owner.getByRole("button", { name: "ნებართვა 24 საათით" })).toBeVisible();
    await support.goto(`/ka/admin/t/${tenant!.id}`);
    await expect(support.getByRole("button", { name: "გახსნა (მხოლოდ ნახვა)" })).toHaveCount(0);
  } finally {
    await db
      .from("support_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("tenant_id", tenant!.id)
      .is("revoked_at", null);
  }
});

// The business website: the owner edits it in Settings; the public page shows it.
test("website: owner edits cover text, links and colours; the public page shows them", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop"); // changes shared demo data
  const db = admin();
  const { data: tenant } = await db.from("tenants").select("id").eq("slug", "demo-salon").single();
  const { data: before } = await db
    .from("tenant_settings")
    .select("site_about, site_instagram, site_theme")
    .eq("tenant_id", tenant!.id)
    .single();
  const about = `E2E ${Date.now()} — ჩვენ შესახებ`;
  try {
    await page.goto("/ka/login");
    await page.getByLabel("ელფოსტა").fill("salon.owner@demo.test");
    await page.getByLabel("პაროლი").fill(PASSWORD);
    await page.getByRole("button", { name: "შესვლა" }).click();
    await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" });
    await page.goto("/ka/settings/business");
    const card = page
      .locator("[data-slot=card]")
      .filter({ has: page.getByRole("heading", { name: "თქვენი ვებგვერდი" }) });
    await card.getByLabel("ქართული").fill(about);
    await card.getByLabel("Instagram").fill("https://www.instagram.com/test.salon.e2e/?hl=ka");
    await card.getByRole("radio", { name: "ოკეანე" }).click();
    await card.getByRole("button", { name: "შენახვა" }).click();
    await expect(page.getByText("შენახულია").first()).toBeVisible();

    await page.goto("/ka/book/demo-salon");
    await expect(page.getByText(about)).toBeVisible();
    await expect(page.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/test.salon.e2e",
    );
    await expect(page.locator("[data-site-theme=ocean]")).toHaveCount(1);
    // a bad handle is refused with a message, nothing saved
    await page.goto("/ka/settings/business");
    await card.getByLabel("Instagram").fill("https://evil.example/x");
    await card.getByRole("button", { name: "შენახვა" }).click();
    await expect(card.getByText(/პროფილის სახელი/)).toBeVisible();
  } finally {
    await db.from("tenant_settings").update(before!).eq("tenant_id", tenant!.id);
  }
});

test("booking by specialist: choose the person first, the specialist step is skipped", async ({ page }) => {
  await page.goto("/ka/book/demo-salon");
  await page.getByRole("radio", { name: "სპეციალისტით" }).click();
  await page.getByRole("button", { name: /სოფო ნოზაძე/ }).click();
  await expect(page.getByText("ნაბიჯი 1 / 4")).toBeVisible();
  await page.locator("#book").getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "გაგრძელება" }).click();
  await expect(page.getByRole("heading", { name: "თარიღი და დრო" })).toBeVisible();
  await expect(page.getByText("ნაბიჯი 2 / 4")).toBeVisible();
});

test("every website colour theme passes the contrast check", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop"); // changes shared demo data (the dental demo, so it never races the salon tests)
  test.setTimeout(120_000);
  const db = admin();
  const { data: tenant } = await db.from("tenants").select("id").eq("slug", "demo-dental").single();
  const { data: before } = await db
    .from("tenant_settings")
    .select("site_theme")
    .eq("tenant_id", tenant!.id)
    .single();
  const found: string[] = [];
  try {
    for (const theme of ["emerald", "rose", "plum", "ocean", "amber"] as const) {
      await db.from("tenant_settings").update({ site_theme: theme }).eq("tenant_id", tenant!.id);
      await page.goto("/ka/book/demo-dental");
      await page.waitForLoadState("networkidle");
      const r = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      found.push(...r.violations.flatMap((v) => v.nodes.map((n) => `${theme}: ${n.target.join(" ")}`)));
    }
  } finally {
    await db.from("tenant_settings").update(before!).eq("tenant_id", tenant!.id);
  }
  expect(found, found.join("\n")).toEqual([]);
});

// Short addresses: {slug}.SITE_DOMAIN shows that business's website, in any language.
test("short address opens the business website and booking works there", async ({ page }, info) => {
  const port = new URL(info.project.use.baseURL!).port;
  await page.goto(`http://demo-salon.localhost:${port}/`);
  await expect(page.getByRole("heading", { level: 1, name: "სალონი ორქიდეა" })).toBeVisible();
  await page.locator("#book").getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "გაგრძელება" }).click();
  await page.getByRole("radio").first().click(); // anyone
  await expect(page.getByRole("heading", { name: "თარიღი და დრო" })).toBeVisible();
  await expect(page).toHaveURL(`http://demo-salon.localhost:${port}/`);
  await page.goto(`http://demo-salon.localhost:${port}/en`);
  await expect(page.getByRole("link", { name: "Book a visit" })).toBeVisible();
  expect((await page.goto(`http://no-such-salon.localhost:${port}/`))?.status()).toBe(404);
});
