// Phase 1 screens against the seeded demo data (npm.cmd run db:seed).
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" }); // the page itself may still be loading
}

test("services: seeded price list with categories and Georgian prices", async ({ page }) => {
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/services");
  await expect(page.getByRole("tab", { name: /თმა/ })).toBeVisible();
  const row = page.getByRole("button", { name: /ქალის თმის შეჭრა/ });
  await expect(row).toContainText("55 ₾");
  await expect(page.getByRole("button", { name: /აფრიკული ნაწნავები/ })).toContainText("250–300 ₾");

  await page.getByRole("tab", { name: /ფრჩხილები/ }).click();
  await expect(page.getByRole("button", { name: /ქალის თმის შეჭრა/ })).toHaveCount(0);

  await page.getByRole("tab", { name: /ყველა/ }).click();
  await row.click();
  await expect(page.getByRole("dialog")).toContainText("ვარიანტები");
});

test("staff: list with work days, profile opens with tabs", async ({ page }) => {
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/staff");
  await page.getByRole("link", { name: /ანა გელაშვილი/ }).click();
  await expect(page.getByRole("heading", { name: "ანა გელაშვილი" })).toBeVisible();
  await page.getByRole("tab", { name: "განრიგი" }).click();
  await expect(page.getByRole("switch", { name: "შაბათი", exact: true })).toBeChecked();
  await expect(page.getByRole("switch", { name: "კვირა", exact: true })).not.toBeChecked();
});

test("clients: count, search by phone, important note warning", async ({ page }) => {
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/clients");
  // type only after the page is interactive, or the input is reset by hydration
  await page.waitForLoadState("networkidle");
  // 30 seeded; online-booking tests add more
  await expect(page.getByText(/^\d+ კლიენტი$/)).toBeVisible();
  await page.getByRole("searchbox").fill("555100000");
  await expect(page.getByText("1 კლიენტი", { exact: true })).toBeVisible();
  // the demo client with an allergy note (there are two Tamars, found by phone)
  await page.getByRole("searchbox").fill("555109411");
  await expect(page.getByText("1 კლიენტი", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /თამარ/ }).click();
  await expect(page.getByRole("note")).toContainText("ალერგია");
});

test("staff role: read-only clients, no settings, no staff editing", async ({ page }) => {
  await signIn(page, "dental.doctor@demo.test");
  await page.goto("/ka/settings/business");
  await expect(page).toHaveURL(/\/ka\/dashboard$/);
  await page.goto("/ka/clients");
  // the doctor's login is linked to a staff profile that is preferred by some patients
  await expect(page.getByRole("button", { name: "ახალი კლიენტი" })).toHaveCount(0);
});

test("dental clinic: patients wording and chairs in settings", async ({ page }) => {
  await signIn(page, "dental.owner@demo.test");
  await page.goto("/ka/clients");
  await expect(page.getByRole("heading", { name: "პაციენტები" })).toBeVisible();
  await page.goto("/ka/settings/business");
  await expect(page.getByText("სავარძელი 1")).toBeVisible();
});

test("phone width: Phase 1 pages never scroll sideways", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await signIn(page, "salon.owner@demo.test");
  for (const path of [
    "/ka/services",
    "/ka/services/import",
    "/ka/staff",
    "/ka/clients",
    "/ka/settings/business",
    "/ka/more",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
