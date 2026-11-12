// Clients section, step 1 (decision 024): visit numbers in the list, automatic
// groups, filters and sorting in the address, number tiles on the client card,
// money only for people who may see revenue.
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

async function signIn(page: Page, email: string) {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" });
}

const money = (s: string) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));

test("owner: columns, groups, sorting by money, the card's numbers", async ({ page }, info) => {
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/clients");
  const groups = page.getByRole("navigation", { name: "კლიენტების ჯგუფები" });
  for (const g of ["ყველა", "ახალი", "მუდმივი", "VIP", "რისკის ქვეშ", "დაკარგული"])
    await expect(groups.getByRole("button", { name: new RegExp(`^${g}`) })).toBeVisible();

  // the demo salon has clients who stopped coming (seed: a year of history)
  await groups.getByRole("button", { name: /^რისკის ქვეშ/ }).click();
  await expect(page).toHaveURL(/segment=at_risk/);
  await expect(groups.getByRole("button", { name: /^რისკის ქვეშ/ })).toHaveAttribute("aria-current", "true");
  const list = page.getByRole("main").getByRole("list").first();
  await expect(list.getByRole("listitem").first()).toContainText("რისკის ქვეშ");
  await expect(list).not.toContainText("VIP");

  if (info.project.name === "desktop") {
    for (const h of ["ბოლო ვიზიტი", "შემდეგი ვიზიტი", "ვიზიტები", "დახარჯა", "საშუალო"])
      await expect(page.getByRole("main").getByText(h, { exact: true }).first()).toBeVisible();

    // sorted by money spent: biggest first (a link opens the same view)
    await page.goto("/ka/clients?sort=spent");
    await expect(page.getByRole("combobox", { name: "დალაგება" })).toHaveText("დახარჯული თანხით");
    const rows = page.getByRole("main").getByRole("list").first().getByRole("listitem");
    const spent = async (i: number) =>
      money(await rows.nth(i).locator("span.tabular-nums", { hasText: "₾" }).first().innerText()); // the "spent" column
    expect(await spent(0)).toBeGreaterThanOrEqual(await spent(1));
    expect(await spent(0)).toBeGreaterThan(0);
  }

  await page.goto("/ka/clients?sort=visits");
  await page.getByRole("main").getByRole("list").first().getByRole("button").first().click();
  const card = page.getByRole("dialog");
  const glance = card.getByRole("region", { name: "მოკლედ" });
  await expect(glance).toBeVisible();
  for (const label of ["ვიზიტები", "დახარჯა", "საშუალო ჩეკი", "ბოლო ვიზიტი", "შემდეგი ვიზიტი", "კლიენტია"])
    await expect(glance.getByText(label, { exact: true })).toBeVisible();
  await expect(glance).toContainText("₾");
});

test("filters: upcoming visit, and clearing them", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/clients");
  const total = async () => Number((await page.getByText(/^\d+ კლიენტი$/).innerText()).replace(/\D/g, ""));
  const all = await total();
  await page.getByRole("button", { name: "აქვს მომავალი ვიზიტი" }).click();
  await expect(page).toHaveURL(/upcoming=1/);
  await expect(page.getByRole("button", { name: "აქვს მომავალი ვიზიტი" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(total).toBeLessThan(all);

  // nothing matches → a way back
  await page.goto("/ka/clients?upcoming=1&q=zzzz-nobody");
  await page.getByRole("button", { name: "ფილტრების გასუფთავება" }).click();
  await expect(page).toHaveURL(/\/ka\/clients$/);
  await expect.poll(total).toBe(all);
});

test("staff: no money in the list or on the card", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.staff@demo.test");
  await page.goto("/ka/clients");
  await expect(page.getByRole("navigation", { name: "კლიენტების ჯგუფები" })).toBeVisible();
  await expect(page.getByRole("main").getByText("დახარჯა", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "დალაგება" })).toBeVisible();
  await page.getByRole("combobox", { name: "დალაგება" }).click();
  await expect(page.getByRole("option", { name: "დახარჯული თანხით" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  // asking for money sorting in the address quietly falls back
  await page.goto("/ka/clients?sort=spent");
  await expect(page.getByRole("combobox", { name: "დალაგება" })).toHaveText("ახალი დამატებული");
  const first = page.getByRole("main").getByRole("list").first().getByRole("button").first();
  if (await first.count()) {
    await first.click();
    const glance = page.getByRole("dialog").getByRole("region", { name: "მოკლედ" });
    await expect(glance.getByText("ვიზიტები", { exact: true })).toBeVisible();
    await expect(glance.getByText("დახარჯა", { exact: true })).toHaveCount(0);
  }
});
