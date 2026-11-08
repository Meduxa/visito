// Phase 6a: dashboard, reports, owner's data tools, platform admin, photos.
import { expect, test, type Browser, type Page } from "@playwright/test";

// several people sign in per test; each sign-in takes a few seconds on the dev server
test.describe.configure({ timeout: 90_000 });

async function signIn(page: Page, email: string, landing: string | RegExp = "**/ka/dashboard") {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL(landing, { waitUntil: "commit" }); // the page itself may still be loading
}
async function as(browser: Browser, email: string, landing?: string | RegExp) {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, email, landing);
  return page;
}

test("dashboard numbers, reports with a staff filter, Excel download", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  await expect(page.getByRole("heading", { name: "დღეს" })).toBeVisible();
  await expect(page.getByText("დატვირთვა").first()).toBeVisible();
  await page.getByRole("link", { name: "ანგარიშები" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "ანგარიშები" })).toBeVisible();
  await expect(page.getByText("დასრულებული ვიზიტები").first()).toBeVisible();

  await page.getByRole("link", { name: "ეს წელი" }).click();
  await page.getByLabel("სპეციალისტი").selectOption({ label: "ანა გელაშვილი" });
  await page.getByRole("button", { name: "ჩვენება" }).click();
  await expect(page).toHaveURL(/staff=/);
  // the specialists' table lives on its own tab; the filter stays
  await page
    .getByRole("navigation", { name: "ანგარიშის განყოფილებები" })
    .getByRole("link", { name: "სპეციალისტები" })
    .click();
  await expect(page).toHaveURL(/tab=staff.*|staff=.*tab=staff/);
  const rows = page.getByTestId("staff-table").getByRole("row");
  await expect(rows).toHaveCount(2); // header + Ana
  await expect(rows.nth(1)).toContainText("ანა გელაშვილი");

  const excel = await page.request.get("/api/export/report?locale=ka");
  expect(excel.status()).toBe(200);
  expect(excel.headers()["content-type"]).toContain("spreadsheetml");
  expect((await excel.body()).subarray(0, 2).toString()).toBe("PK");
});

test("an admin without revenue access sees no money", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop");
  const owner = await as(browser, "dental.owner@demo.test");
  const toggle = async (on: boolean) => {
    await owner.goto("/ka/settings/team");
    await owner.waitForLoadState("networkidle");
    const sw = owner.getByRole("switch", { name: "ადმინისტრატორები ხედავენ შემოსავალს" });
    if ((await sw.getAttribute("aria-checked")) !== String(on)) await sw.click();
    // the save button of the same card as the switch
    await owner.locator("[data-slot=card]", { has: sw }).getByRole("button", { name: "შენახვა" }).click();
    await expect(owner.getByText("შენახულია").first()).toBeVisible();
    await owner.reload();
    await expect(owner.getByRole("switch", { name: "ადმინისტრატორები ხედავენ შემოსავალს" })).toHaveAttribute(
      "aria-checked",
      String(on),
    );
  };
  try {
    await toggle(false);
    const admin = await as(browser, "dental.admin@demo.test");
    await admin.goto("/ka/reports");
    await expect(admin.getByText("დასრულებული ვიზიტები").first()).toBeVisible();
    await expect(admin.getByText("მიღებული თანხა")).toHaveCount(0);
    await admin.goto("/ka/dashboard");
    await expect(admin.getByText("შემოსავალი")).toHaveCount(0);
  } finally {
    await toggle(true);
  }
});

test("owner: audit log, full export; others cannot export", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop");
  const owner = await as(browser, "salon.owner@demo.test");
  await owner.goto("/ka/settings/data");
  await owner.getByRole("main").getByRole("link", { name: "ქმედებების ჟურნალი" }).click();
  await expect(owner.getByRole("heading", { name: "ქმედებების ჟურნალი" })).toBeVisible();
  // entries are there (newest first; other tests keep adding some, so no particular one)
  await expect(owner.getByRole("main").getByRole("listitem").first()).toBeVisible();
  await expect(owner.getByText("ჯერ არაფერია.")).toHaveCount(0);
  await owner.getByRole("link", { name: "გუნდი" }).last().click();
  await expect(owner).toHaveURL(/group=team/);

  const json = await owner.request.get("/api/export/business?format=json");
  expect(json.status()).toBe(200);
  const data = (await json.json()) as { clients: unknown[]; bookings: unknown[] };
  expect(data.clients.length).toBeGreaterThanOrEqual(30);
  expect(data.bookings.length).toBeGreaterThan(0);
  const xlsx = await owner.request.get("/api/export/business?format=xlsx");
  expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");

  const admin = await as(browser, "salon.admin@demo.test");
  expect((await admin.request.get("/api/export/business?format=json")).status()).toBe(403);
});

test("owner schedules deletion (banner everywhere) and cancels it", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "dental.owner@demo.test");
  await page.goto("/ka/settings/data");
  await page.getByRole("button", { name: "ბიზნესის წაშლა…" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ბიზნესის სახელი").fill("არასწორი");
  await expect(dialog.getByRole("button", { name: "წაშლა 14 დღეში" })).toBeDisabled();
  await dialog.getByLabel("ბიზნესის სახელი").fill("დენტალ სმაილი");
  await dialog.getByRole("button", { name: "წაშლა 14 დღეში" }).click();
  await expect(page.getByText(/ბიზნესი წაიშლება .* გაუქმება შეგიძლიათ პარამეტრებში/)).toBeVisible();
  await page.goto("/ka/calendar");
  await expect(page.getByText(/ბიზნესი წაიშლება/).first()).toBeVisible();
  await page.goto("/ka/settings/data");
  await page.getByRole("button", { name: "ბიზნესის დატოვება" }).click();
  await expect(page.getByText("ბიზნესი არ წაიშლება.")).toBeVisible();
  await page.goto("/ka/dashboard");
  await expect(page.getByText(/ბიზნესი წაიშლება/)).toHaveCount(0);
});

test("platform admin: businesses, SMS top-up, plans; nobody else sees /admin", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop");
  // the demo admin has no business of its own — unless someone tried sign-up with it
  const admin = await as(browser, "platform.admin@demo.test", /\/ka\/(onboarding|dashboard)/);
  await admin.goto("/ka/admin");
  await expect(admin.getByRole("heading", { name: "ბიზნესები" })).toBeVisible();
  await admin.getByRole("link", { name: "სალონი ორქიდეა" }).click();
  const heading = admin.getByRole("heading", { name: /^დარჩენილი SMS: \d+$/ });
  const before = Number((await heading.textContent())!.match(/\d+/)![0]);
  await admin.getByLabel("SMS-ის დამატება").fill("10");
  await admin.getByLabel(/შენიშვნა/).fill("e2e");
  await admin.getByRole("button", { name: "დამატება" }).click();
  await expect(admin.getByRole("heading", { name: `დარჩენილი SMS: ${before + 10}` })).toBeVisible();
  await admin.goto("/ka/admin/plans");
  await expect(admin.getByLabel("სახელი").first()).toBeVisible();

  const owner = await as(browser, "salon.owner@demo.test");
  const res = await owner.goto("/ka/admin");
  expect(res?.status()).toBe(404);
});

test("photos: upload, show on the booking page, remove", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop");
  const owner = await as(browser, "salon.owner@demo.test");
  await owner.goto("/ka/settings/website");
  await owner.waitForLoadState("networkidle");
  const before = await owner.getByRole("button", { name: /^ფოტო \d+-ის წაშლა$/ }).count();
  // a 1×1 PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await owner
    .locator('input[type="file"][accept*="image/webp"][multiple]')
    .setInputFiles({ name: "salon.png", mimeType: "image/png", buffer: png });
  await expect(owner.getByRole("button", { name: /^ფოტო \d+-ის წაშლა$/ })).toHaveCount(before + 1);

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/ka/book/orchidea");
  await expect(visitor.getByRole("img", { name: `ფოტო ${before + 1}` })).toBeVisible();

  await owner.getByRole("button", { name: `ფოტო ${before + 1}-ის წაშლა` }).click();
  await expect(owner.getByRole("button", { name: /^ფოტო \d+-ის წაშლა$/ })).toHaveCount(before);
});
