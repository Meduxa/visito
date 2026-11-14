// Decisions 028–031: ready services, time-off requests, reviews, card billing.
// Needs the seeded dev project and .env.local with Flitt's PUBLIC test merchant
// (PAYMENTS_PROVIDER=flitt, 1549901 / test). No real money moves.
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { expect, test, type Page } from "@playwright/test";
import { assertDevProject } from "../scripts/dev-project.mts";

config({ path: ".env.local", quiet: true });
test.describe.configure({ timeout: 120_000 });

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assertDevProject(url, "The end-to-end tests");
  return createClient(url!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
}

async function signIn(page: Page, email: string) {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" });
}

const tenantId = async (slug = "orchidea") =>
  (await admin().from("tenants").select("id").eq("slug", slug).single()).data!.id as string;

test("ready services: shown next to your own list, added one by one; the new-service form can start from one", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/services");
  // manual adding stays
  await expect(page.getByRole("button", { name: "ახალი სერვისი" }).first()).toBeVisible();
  // the ready services box (collapsed while the business has services)
  await page.getByRole("button", { name: /მზა სერვისები/ }).click();
  await page.getByRole("radio", { name: "ბარბერშოპი" }).click();
  await page.getByRole("button", { name: "წვერის მოწესრიგება — დამატება" }).click();
  await expect(page.getByText("დაემატა: წვერის მოწესრიგება")).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "წვერის მოწესრიგება" }).getByText("უკვე დამატებულია"),
  ).toBeVisible();
  const db = admin();
  const { data } = await db
    .from("services")
    .select("id, name_i18n, price_minor")
    .eq("tenant_id", await tenantId())
    .eq("name_i18n->>ka", "წვერის მოწესრიგება");
  expect(data![0]).toMatchObject({
    price_minor: 2500,
    name_i18n: { en: "Beard trim", ru: "Оформление бороды" },
  });
  await db.from("services").delete().eq("id", data![0].id);
  // the category the ready service brought along, now empty
  await db
    .from("service_categories")
    .delete()
    .eq("tenant_id", await tenantId())
    .eq("name_i18n->>ka", "წვერი");

  // the new-service form: pick a ready one, it fills the fields (nothing is saved here)
  await page.getByRole("button", { name: "ახალი სერვისი" }).first().click();
  const panel = page.getByRole("dialog");
  await panel.getByLabel("მზა სერვისიდან დაწყება (არასავალდებულო)").click();
  await page.getByRole("option", { name: "ფეიდი" }).click();
  await expect(panel.getByRole("textbox").first()).toHaveValue("ფეიდი");
  await expect(panel.locator('input[lang="en"]')).toHaveValue("Fade");
});

test("time off: the specialist asks, the owner approves, the time off appears", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop");
  // leftovers of an interrupted earlier run
  await admin().from("time_off_requests").delete().eq("note", "e2e request");
  const staff = await browser.newPage();
  await signIn(staff, "salon.staff@demo.test");
  await staff.goto("/ka/my-day");
  await expect(staff.getByRole("heading", { name: "ჩემი დასვენება" })).toBeVisible();
  await expect(staff.getByText("ელოდება").first()).toBeVisible(); // the seeded request
  await staff.getByRole("button", { name: "დასვენების მოთხოვნა" }).click();
  const day = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
  await staff.getByLabel("პირველი დღე").fill(day);
  await staff.getByLabel("ბოლო დღე").fill(day);
  await staff.getByRole("textbox", { name: "შენიშვნა", exact: true }).fill("e2e request");
  await staff.getByRole("button", { name: "მოთხოვნის გაგზავნა" }).click();
  await expect(staff.getByText("შენახულია").first()).toBeVisible();

  const owner = await browser.newPage();
  await signIn(owner, "salon.owner@demo.test");
  await owner.goto("/ka/staff");
  const card = owner.getByRole("heading", { name: /დასვენების მოთხოვნები/ }).locator("..");
  const row = card.getByRole("listitem").filter({ hasText: "e2e request" });
  await row.getByRole("button", { name: "დამტკიცება" }).click();
  await expect(card.getByRole("listitem").filter({ hasText: "e2e request" })).toHaveCount(0);

  await staff.reload();
  await expect(staff.getByRole("listitem").filter({ hasText: "დამტკიცდა" }).first()).toBeVisible();
  const db = admin();
  const { data } = await db
    .from("time_off_requests")
    .select("id, time_off_id")
    .eq("note", "e2e request")
    .single();
  expect(data!.time_off_id).not.toBeNull();
  await db.from("time_off").delete().eq("id", data!.time_off_id!);
  await db.from("time_off_requests").delete().eq("id", data!.id);
});

test("reviews: the client rates by the SMS link; the owner replies; the booking page shows them", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  const db = admin();
  const tid = await tenantId();
  // a finished visit without a review, and its private link (made the way the SMS job does)
  const { data: visit } = await db
    .from("bookings")
    .select("id")
    .eq("tenant_id", tid)
    .eq("status", "completed")
    .not("client_id", "is", null)
    .order("starts_at", { ascending: true })
    .limit(1)
    .single();
  await db.from("reviews").delete().eq("booking_id", visit!.id);
  await db.from("review_requests").delete().eq("booking_id", visit!.id);
  const token = randomBytes(24).toString("base64url");
  const hash = createHmac("sha256", process.env.SUPABASE_SECRET_KEY!).update(`visito:${token}`).digest("hex");
  expect((await db.rpc("add_review_request", { p_booking: visit!.id, p_token_hash: hash })).data).toBe(true);

  await page.goto(`/ka/r/${token}`);
  await expect(page.getByText("როგორი იყო ვიზიტი?")).toBeVisible();
  await page.getByRole("button", { name: "გაგზავნა" }).click();
  await expect(page.getByText("აირჩიეთ 1–5 ვარსკვლავი.")).toBeVisible();
  await page.getByLabel("4 ვარსკვლავი").check({ force: true });
  await page.getByLabel("კომენტარი (არასავალდებულო)").fill("e2e: ძალიან კარგი");
  await page.getByRole("button", { name: "გაგზავნა" }).click();
  await expect(page.getByText("გმადლობთ!")).toBeVisible();
  await page.reload();
  await expect(page.getByText("ეს ვიზიტი უკვე შეფასებულია", { exact: false })).toBeVisible();

  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/reviews");
  const item = page.getByRole("listitem").filter({ hasText: "e2e: ძალიან კარგი" });
  await item.getByRole("button", { name: "პასუხი" }).click();
  await item.getByLabel("თქვენი პასუხი").fill("e2e reply");
  await item.getByRole("button", { name: "პასუხის შენახვა" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "e2e reply" })).toBeVisible();

  await page.goto("/ka/book/orchidea");
  await expect(page.getByRole("heading", { name: "შეფასებები" })).toBeVisible();
  await expect(page.getByText("e2e: ძალიან კარგი")).toBeVisible();
  await db.from("reviews").delete().eq("booking_id", visit!.id);
});

test("subscription: owner opens Flitt's card page; a signed Flitt notice activates the plan once", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  const db = admin();
  const tid = await tenantId();
  const { data: before } = await db
    .from("tenants")
    .select("plan, status, paid_until, autopay")
    .eq("id", tid)
    .single();
  try {
    await signIn(page, "salon.owner@demo.test");
    await page.goto("/ka/settings/subscription");
    await expect(page.getByRole("heading", { name: "გამოწერა", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "პაკეტები", exact: true })).toBeVisible();
    await expect(page.getByText("SMS პაკეტები")).toHaveCount(0); // not offered yet

    // paying a plan opens Flitt's own (test) card page — no card data ever reaches Visito
    const { data: pro } = await db.from("plans").select("name, price_minor").eq("code", "pro").single();
    const payButton = page.getByRole("button", { name: `${pro!.price_minor / 100} ₾ ყოველთვიურად ბარათით` });
    // no card page without agreeing to the monthly automatic charge
    await payButton.click();
    await expect(page.getByText("ყოველთვიურ გადახდაზე თანხმობისთვის მონიშნეთ ველი.")).toBeVisible();
    await expect(page).toHaveURL(/\/settings\/subscription/);
    await page.getByTestId("recurring-consent").getByRole("checkbox").check();
    await payButton.click();
    await page.waitForURL(/https:\/\/pay\.flitt\.com\//, { timeout: 30_000 });

    // what Flitt sends Visito after the test card is paid (signed with the test secret)
    const { data: pay } = await db
      .from("billing_payments")
      .select("id, amount_minor")
      .eq("tenant_id", tid)
      .eq("kind", "plan")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const notice: Record<string, string | number> = {
      order_id: pay!.id,
      merchant_id: 1549901,
      amount: String(pay!.amount_minor),
      currency: "GEL",
      order_status: "approved",
      response_status: "success",
      payment_id: 123456789,
      masked_card: "444455XXXXXX1111",
    };
    const values = Object.keys(notice)
      .sort()
      .map((k) => String(notice[k]));
    notice.signature = createHash("sha1")
      .update(["test", ...values].join("|"))
      .digest("hex");
    expect(
      (await page.request.post("/api/webhooks/flitt", { data: { ...notice, amount: "1" } })).status(),
    ).toBe(401);
    expect((await page.request.post("/api/webhooks/flitt", { data: notice })).status()).toBe(200);
    expect((await page.request.post("/api/webhooks/flitt", { data: notice })).status()).toBe(200); // repeated: no change
    const { data: after } = await db.from("tenants").select("plan, status, autopay").eq("id", tid).single();
    expect(after).toEqual({ plan: "pro", status: "active", autopay: true });

    await page.goto(`/ka/settings/subscription?order=${pay!.id}`);
    await expect(page.getByText("გადახდა მიღებულია — გმადლობთ!")).toBeVisible();
    await expect(page.getByText("444455XXXXXX1111").first()).toBeVisible();
  } finally {
    // the demo salon goes back to how it was
    await db.from("tenants").update(before!).eq("id", tid);
  }
});

test("only the owner sees Subscription", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.admin@demo.test");
  await page.goto("/ka/settings/subscription");
  await expect(page).not.toHaveURL(/settings\/subscription/);
});
