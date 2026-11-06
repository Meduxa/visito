import { expect, test, type Page } from "@playwright/test";

const TZ = "Asia/Tbilisi";
const localDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const plusDays = (n: number) => localDate(new Date(Date.now() + n * 86_400_000));
function weekdayAhead(from: number) {
  for (let n = from; ; n++) {
    const day = new Date(`${plusDays(n)}T12:00:00Z`).getUTCDay();
    if (day >= 1 && day <= 5) return plusDays(n);
  }
}

async function signIn(page: Page, email: string) {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" }); // the page itself may still be loading
}

test("checkout with a split payment shows up in the cash summary", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  // day 3+, so the calendar tests (day 1) still find unpaid, confirmed bookings
  await page.goto(`/ka/calendar?view=day&date=${weekdayAhead(3)}`);
  await page.waitForLoadState("networkidle");
  // the first booking that is still unpaid (earlier runs paid some)
  const blocks = page.locator('[role="button"][aria-label*="–"]');
  const panel = page.getByRole("dialog");
  const pay = panel.getByRole("button", { name: "ანგარიშსწორება" });
  for (let i = 0; ; i++) {
    expect(i).toBeLessThan(await blocks.count());
    await blocks.nth(i).click();
    await expect(panel.getByRole("heading", { name: "სერვისები" })).toBeVisible();
    if (await pay.isVisible()) break;
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  }
  await pay.click();
  await expect(page.getByRole("dialog")).toContainText("გადასახდელი");
  await page.getByRole("dialog").getByRole("button", { name: "გაყოფილი გადახდა" }).click();
  // first line pays 10 ₾ cash, the second (card) the rest
  const amounts = page.getByRole("dialog").getByRole("textbox", { name: "თანხა" });
  const dueText = await amounts.first().inputValue();
  await amounts.first().fill("10");
  await amounts.nth(1).fill(String(Number(dueText.replace(",", ".")) - 10));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^მიღება/ })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goto("/ka/cash");
  await expect(page.getByRole("heading", { name: "სალარო" })).toBeVisible();
  await expect(page.getByText("ნაღდი").first()).toBeVisible();
  await expect(page.getByText("ბარათი (ტერმინალი)").first()).toBeVisible();
});

test("recurring: three weekly visits in one go", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  const date = weekdayAhead(30 + Math.floor(Math.random() * 60));
  await page.goto(`/ka/calendar?view=day&date=${date}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "ახალი ჯავშანი" }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("searchbox").fill("მარიამ");
  await panel
    .getByRole("button", { name: /მარიამ/ })
    .first()
    .click();
  await panel.getByText("წარბის კორექცია").click();
  await panel.getByRole("radio").first().click();
  await panel.getByText("გამეორება").click();
  await panel.getByLabel("რამდენჯერ").fill("3");
  await panel.getByRole("button", { name: "თარიღების შემოწმება" }).click();
  await panel.getByRole("button", { name: "დაჯავშნა", exact: true }).click();
  await expect(page.getByText("შეიქმნა 3 ჯავშანი")).toBeVisible();
});

test("dental: day view by chair", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "dental.owner@demo.test");
  await page.goto(`/ka/calendar?view=day&date=${weekdayAhead(1)}`);
  await page.getByRole("tab", { name: "სავარძლებით" }).click();
  await expect(page).toHaveURL(/by=chair/);
  await expect(page.getByText("სავარძელი 1")).toBeVisible();
  await expect(page.getByText("სავარძელი 2")).toBeVisible();
  await expect(page.locator('[role="button"][aria-label*="–"]').first()).toBeVisible();
});

test("import bookings: columns guessed, bad rows left out, good rows saved", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/calendar");
  await page.getByRole("link", { name: "ჯავშნების იმპორტი" }).click();
  await page.waitForURL("**/ka/calendar/import");
  await page.waitForLoadState("networkidle");
  // a random far-future day so reruns never collide with earlier imports
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  const year = 2030 + Math.floor(Math.random() * 20);
  const table = [
    "თარიღი\tდრო\tკლიენტი\tტელეფონი\tსერვისი\tსპეციალისტი\tფასი",
    `${day}.${month}.${year}\t10:00\tნინო ბერიძე\t555 10 00 00\tქალის თმის შეჭრა\tანა გელაშვილი\t55`,
    `${day}.${month}.${year}\t12:00\tვიღაც სხვა\t599 11 22 34\tარარსებული სერვისი\tანა გელაშვილი\t10`,
  ].join("\n"); // the good row matches a demo client by phone, so no new client is created
  await page.getByLabel("ჩასვით ცხრილი (Excel-იდან დაკოპირებული)").fill(table);
  await page.getByRole("button", { name: "ცხრილის წაკითხვა" }).click();
  await expect(page.getByText("უცნობი სერვისი")).toBeVisible();
  await page.getByRole("button", { name: "1 ჯავშნის იმპორტი" }).click();
  await expect(page.getByRole("heading", { name: "შემოტანილია 1 ჯავშანი" })).toBeVisible();
});

test("phone: booking import page never scrolls sideways", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await signIn(page, "salon.admin@demo.test");
  await page.goto("/ka/calendar/import");
  await expect(page.getByRole("heading", { name: "ჯავშნების იმპორტი" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("staff cannot open booking import", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.staff@demo.test");
  await page.goto("/ka/calendar/import");
  await page.waitForURL("**/ka/calendar");
  await expect(page.getByRole("link", { name: "ჯავშნების იმპორტი" })).toHaveCount(0);
});

test("panel read route: nothing for signed-out visitors, unknown loaders 404", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop");
  const id = "00000000-0000-4000-8000-000000000000";
  const visits = await request.get(`/api/read/clientVisits/${id}`, { maxRedirects: 0 });
  expect(visits.status()).not.toBe(200);
  expect(await visits.text()).not.toContain("starts_at");
  const unknown = await request.get(`/api/read/exportClient/${id}`, { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
});
