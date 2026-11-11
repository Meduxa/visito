// Clients step 2 (decision 026): own fields, group numbers, columns, quick
// note, Excel of the current list, and "new booking" from the card.
// Needs the dev project seeded (npm run db:seed).
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

async function signIn(page: Page, email: string) {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" });
}

const list = (page: Page) => page.getByRole("main").getByRole("list").first();

test("settings: add and remove an own field; group numbers", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/settings/clients");
  await expect(page.getByRole("heading", { name: "კლიენტები", level: 1 })).toBeVisible();
  await expect(page.getByText("თმის ტიპი", { exact: true })).toBeVisible(); // demo field

  await page.getByRole("button", { name: "ველის დამატება" }).click();
  await page.getByLabel("სახელი").fill("e2e ველი");
  await page.getByRole("button", { name: "შენახვა" }).first().click();
  await expect(page.getByText("e2e ველი", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "e2e ველი — წაშლა" }).click();
  await page.getByRole("alertdialog").getByRole("button").last().click();
  await expect(page.getByText("e2e ველი", { exact: true })).toHaveCount(0);

  // the numbers behind the groups show in the client list's hint
  await page.getByLabel("რისკის ქვეშ —").fill("45");
  await page.getByLabel("დაკარგული —").fill("40");
  await page.getByRole("button", { name: "შენახვა" }).last().click();
  await expect(page.getByText("„დაკარგულის“ დღეები „რისკის ქვეშ“-ზე მეტი უნდა იყოს.")).toBeVisible();
  await page.getByLabel("დაკარგული —").fill("150");
  await expect(page.getByText("შენახულია")).toHaveCount(0, { timeout: 15_000 }); // earlier messages gone
  await page.getByRole("button", { name: "შენახვა" }).last().click();
  await expect(page.getByText("შენახულია").first()).toBeVisible();
  await page.goto("/ka/clients");
  await expect(page.getByText(/რისკის ქვეშ — 45–150 დღეა არ მოსულა/)).toBeVisible();
  // back to the standard numbers
  await page.goto("/ka/settings/clients");
  await page.getByRole("button", { name: "სტანდარტული რიცხვები" }).click();
  await page.getByRole("button", { name: "შენახვა" }).last().click();
  await expect(page.getByText("შენახულია").first()).toBeVisible();
});

test("columns, own field on the card, quick note", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/clients?sort=name");
  const header = page.getByRole("main").locator("div.grid-cols-\\(--cols\\)").first();

  // choose columns: hide the phone, show "hair type"
  await page.getByRole("button", { name: "სვეტები" }).click();
  await page.getByRole("menuitemcheckbox", { name: "ტელეფონი" }).click();
  await page.getByRole("menuitemcheckbox", { name: "თმის ტიპი" }).click();
  await page.keyboard.press("Escape");
  await expect(header).toContainText("თმის ტიპი");
  await expect(header).not.toContainText("ტელეფონი");
  await page.reload(); // remembered
  await expect(header).toContainText("თმის ტიპი");
  await page.getByRole("button", { name: "სვეტები" }).click();
  await page.getByRole("menuitem", { name: "სტანდარტული სვეტები" }).click();
  await expect(header).toContainText("ტელეფონი");
  await expect(header).not.toContainText("თმის ტიპი");

  // an own field on the card
  await list(page).getByRole("listitem").nth(1).getByRole("button").first().click();
  const card = page.getByRole("dialog");
  await card.getByLabel("ფერის ფორმულა").fill("e2e 7/1 + 6%");
  await card.getByRole("button", { name: "შენახვა" }).click();
  await expect(page.getByText("შენახულია").first()).toBeVisible();
  await page.reload();
  await list(page).getByRole("listitem").nth(1).getByRole("button").first().click();
  await expect(page.getByRole("dialog").getByLabel("ფერის ფორმულა")).toHaveValue("e2e 7/1 + 6%");
  await page.getByRole("dialog").getByLabel("ფერის ფორმულა").fill("");
  await page.getByRole("dialog").getByRole("button", { name: "შენახვა" }).click();
  await expect(page.getByText("შენახულია").first()).toBeVisible();
  await page.keyboard.press("Escape");

  // the quick note from the list
  const row = list(page).getByRole("listitem").nth(2);
  const noteButton = row.getByRole("button", { name: /^(შენიშვნის დამატება|შენიშვნა)$/ });
  const before = (await noteButton.getAttribute("aria-label"))!;
  await noteButton.click();
  const box = page.getByRole("dialog").getByRole("textbox");
  const old = await box.inputValue();
  await box.fill("e2e quick note");
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(page.getByText("შენიშვნა შენახულია")).toBeVisible();
  await expect(row.getByRole("button", { name: /^შენიშვნა$/ })).toHaveAttribute("title", "e2e quick note");
  // put it back
  await row.getByRole("button", { name: /^შენიშვნა$/ }).click();
  await page.getByRole("dialog").getByRole("textbox").fill(old);
  await page.getByRole("button", { name: "შენახვა" }).click();
  await expect(row.getByRole("button", { name: before })).toBeVisible();
});

test("Excel of exactly the current list", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/clients?segment=vip");
  const link = page.getByRole("link", { name: "Excel-ის ჩამოტვირთვა" });
  await expect(link).toHaveAttribute("href", /\/api\/export\/clients\?segment=vip&locale=ka/);
  const res = await page.request.get((await link.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toMatch(/visito-clients-\d{4}-\d{2}-\d{2}\.xlsx/);
  expect((await res.body()).subarray(0, 2).toString()).toBe("PK");
});

test("new booking straight from the client card", async ({ page }) => {
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/clients?sort=name");
  const first = list(page).getByRole("listitem").first().getByRole("button").first();
  const name = (await first.locator("span.font-medium").first().innerText()).trim();
  await first.click();
  await page.getByRole("dialog").getByRole("link", { name: "ახალი ჯავშანი" }).click();
  await expect(page).toHaveURL(/\/ka\/calendar\?for=/);
  await expect(page.getByRole("dialog")).toContainText(name.split(" ")[0]);
});

test("staff: no Excel, no quick note, no client settings", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.staff@demo.test");
  await page.goto("/ka/clients");
  await expect(page.getByRole("link", { name: "Excel-ის ჩამოტვირთვა" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^(შენიშვნის დამატება|შენიშვნა)$/ })).toHaveCount(0);
  expect((await page.request.get("/api/export/clients")).status()).toBe(403);
  await page.goto("/ka/settings/clients");
  await expect(page).not.toHaveURL(/settings\/clients/);
});
