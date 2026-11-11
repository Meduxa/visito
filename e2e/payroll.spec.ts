// Payroll (decision 025): the month view, a payslip with a bonus and a payment,
// pay settings, staff kept out, and the "not in your plan" view.
// Needs the dev project seeded (npm run db:seed) and .env.local.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { expect, test, type Page } from "@playwright/test";
import { assertDevProject } from "../scripts/dev-project.mts";

config({ path: ".env.local", quiet: true });
test.describe.configure({ timeout: 90_000 });

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

const money = (s: string) =>
  Number(
    s
      .replace(/[^\d,-]/g, "")
      .replace(",", ".")
      .replace("−", "-"),
  );

test("owner: month view, a bonus and a payment on the payslip", async ({ page }, info) => {
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/payroll");
  await expect(page.getByRole("heading", { name: "ხელფასები", level: 1 })).toBeVisible();
  for (const label of ["გამომუშავებული თვეში", "გადახდილი", "დარჩა გადასახდელი"])
    await expect(page.getByText(label, { exact: true })).toBeVisible();

  // the demo: last month the salaries were paid; this month nothing yet
  await page.getByRole("link", { name: "წინა თვე" }).click();
  await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
  await page.getByRole("link", { name: "მიმდინარე თვე" }).click();
  await expect(page).toHaveURL(/\/ka\/payroll$/);

  // phone and desktop work on different people, so the two runs don't collide
  const rows = page.getByRole("main").getByRole("list").first().getByRole("button");
  const row = rows.nth(info.project.name === "desktop" ? 2 : 3);
  await row.click();
  const slip = page.getByRole("dialog");
  await expect(slip.getByText("თვის ანაზღაურება")).toBeVisible();
  const total = async () =>
    money(await slip.locator("section").first().locator("div.font-semibold span.tabular-nums").innerText());
  const before = await total();

  // a bonus raises the total; removing it brings it back
  await slip.getByLabel("ტიპი").click();
  await page.getByRole("option", { name: "ბონუსი" }).click();
  await slip.getByLabel("თანხა, ₾").last().fill("25");
  await slip.getByLabel("შენიშვნა").last().fill("e2e bonus");
  await slip.getByRole("button", { name: "დამატება", exact: true }).click();
  await expect(slip.getByText("e2e bonus")).toBeVisible();
  await expect.poll(total).toBe(before + 25);

  // a payment lowers what is still owed
  await slip.getByLabel("თანხა, ₾").first().fill("10");
  await slip.getByLabel("შენიშვნა").first().fill("e2e payment");
  await slip.getByRole("button", { name: "გადახდის დამატება" }).click();
  await expect(slip.getByText("e2e payment")).toBeVisible();
  await expect(slip.getByText(/^(გადასახდელი|გადახდილია გამომუშავებულზე მეტი)$/)).toBeVisible();

  // clean up through the same screens (each asks first)
  for (const note of ["e2e payment", "e2e bonus"]) {
    await slip
      .locator("li, div")
      .filter({ hasText: note })
      .last()
      .getByRole("button", { name: "წაშლა" })
      .click();
    await page.getByRole("alertdialog").getByRole("button").last().click();
    await expect(slip.getByText(note)).toHaveCount(0);
  }
  await expect.poll(total).toBe(before);
});

test("owner: pay settings save the default %", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/payroll/settings");
  await expect(page.getByRole("heading", { name: "ანაზღაურების წესები", level: 1 })).toBeVisible();
  const card = page.getByRole("main").locator('[data-slot="card"]').last();
  const pct = card.getByLabel("% სერვისებიდან");
  const old = await pct.inputValue();
  await pct.fill("33");
  await card.getByRole("button", { name: "შენახვა" }).click();
  await expect(page.getByText("შენახულია").first()).toBeVisible();
  await page.reload();
  await expect(card.getByLabel("% სერვისებიდან")).toHaveValue("33");
  await card.getByLabel("% სერვისებიდან").fill(old);
  await card.getByRole("button", { name: "შენახვა" }).click();
  await expect(page.getByText("შენახულია").first()).toBeVisible();
});

test("staff cannot open payroll", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.staff@demo.test");
  await expect(page.getByRole("link", { name: "ხელფასები" })).toHaveCount(0);
  await page.goto("/ka/payroll");
  await expect(page).toHaveURL(/\/ka\/dashboard/);
  expect((await page.request.get("/api/export/payroll?month=2026-11")).status()).toBe(403);
});

test("a plan without payroll shows what it is and how to get it", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  const db = admin();
  const { data: t } = await db.from("tenants").select("id, plan").eq("slug", "demo-dental").single();
  await db.from("tenants").update({ plan: "start" }).eq("id", t!.id);
  try {
    await signIn(page, "dental.owner@demo.test");
    await page.goto("/ka/payroll");
    await expect(page.getByRole("heading", { name: "ხელფასები თქვენს პაკეტში არ შედის" })).toBeVisible();
    // the names Levan gave the plans that include payroll (offered to new businesses)
    const { data: plans } = await db
      .from("plans")
      .select("name")
      .eq("active", true)
      .neq("code", "trial")
      .contains("features", ["payroll"]);
    for (const p of plans ?? [])
      await expect(page.getByText(/ხელფასები შედის პაკეტებში:/)).toContainText(p.name);
    await page.goto("/ka/payroll/settings");
    await expect(page.getByRole("heading", { name: "ხელფასები თქვენს პაკეტში არ შედის" })).toBeVisible();
    expect((await page.request.get("/api/export/payroll?month=2026-11")).status()).toBe(403);
  } finally {
    await db.from("tenants").update({ plan: t!.plan }).eq("id", t!.id);
  }
});

test("Excel download of the month", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  const res = await page.request.get("/api/export/payroll?month=2026-10&locale=ka");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("visito-payroll-2026-10.xlsx");
  expect((await res.body()).subarray(0, 2).toString()).toBe("PK"); // a real xlsx (zip)
});
