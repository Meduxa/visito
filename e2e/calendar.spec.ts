// Calendar flows against the seeded demo data (bookings around today).
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const TZ = "Asia/Tbilisi";
const localDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const plusDays = (n: number) => localDate(new Date(Date.now() + n * 86_400_000));
// next weekday (Mon–Fri) at least `from` days ahead
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

test("day view: Georgian title, staff columns, booking opens by click and keyboard", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  const date = weekdayAhead(1);
  await page.goto(`/ka/calendar?view=day&date=${date}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /ოქტომბერი|ნოემბერი|დეკემბერი|იანვარი|თებერვალი|მარტი|აპრილი|მაისი|ივნისი|ივლისი|აგვისტო|სექტემბერი/,
  );
  await expect(page.getByText("ანა გელაშვილი").first()).toBeVisible();

  // the first visit that is still open (other tests may have completed some of this day's visits)
  const blocks = page.locator('[role="button"][aria-label*="–"]');
  const panel = page.getByRole("dialog");
  const arrived = panel.getByRole("button", { name: "მოვიდა" });
  let block = blocks.first();
  for (let i = 0; i < Math.min(await blocks.count(), 8); i++) {
    block = blocks.nth(i);
    await block.click();
    await expect(panel).toBeVisible();
    const open = await arrived.waitFor({ timeout: 2_000 }).then(
      () => true,
      () => false,
    );
    if (open) break;
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  }
  await expect(arrived).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  await block.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("create a booking from an empty slot, then mark the client arrived", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  // a random day beyond the seeded bookings that earlier runs have not used yet
  let date = "";
  for (let tries = 0; ; tries++) {
    expect(tries).toBeLessThan(10);
    date = weekdayAhead(8 + Math.floor(Math.random() * 300));
    await page.goto(`/ka/calendar?view=day&date=${date}`);
    await page.waitForLoadState("networkidle");
    if ((await page.locator('[role="button"][aria-label*="–"]').count()) === 0) break;
  }

  await page.getByRole("button", { name: "ახალი ჯავშანი" }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("searchbox").fill("ნინო");
  await panel
    .getByRole("button", { name: /ნინო ბერიძე/ })
    .first()
    .click();
  await panel.getByText("კლასიკური მანიკური").click();
  const firstSlot = panel.getByRole("radio").first();
  await expect(firstSlot).toBeVisible();
  const time = (await firstSlot.textContent())!.slice(0, 5);
  await firstSlot.click();
  await panel.getByRole("button", { name: "დაჯავშნა", exact: true }).click();
  await expect(panel).toBeHidden();

  // the client gets a confirmation SMS with the booked time (fake provider outbox)
  await expect
    .poll(() =>
      existsSync(".dev/sms-outbox.jsonl")
        ? readFileSync(".dev/sms-outbox.jsonl", "utf8")
            .trim()
            .split("\n")
            .map((l) => JSON.parse(l) as { to: string; text: string })
            .some(
              (m) => m.to === "+995555100000" && m.text.includes("ჯავშანი") && m.text.includes(`, ${time}.`),
            )
        : false,
    )
    .toBe(true);

  const block = page.locator(`[role="button"][aria-label^="${time}"][aria-label*="ნინო ბერიძე"]`);
  await expect(block).toBeVisible();
  await block.click();
  await page.getByRole("dialog").getByRole("button", { name: "მოვიდა" }).click();
  await expect(page.getByRole("dialog")).toBeHidden(); // saved
  await page.goto(`/ka/calendar?view=list&date=${date}`);
  await expect(
    page
      .getByRole("button", { name: /ნინო ბერიძე/ })
      .filter({ hasText: time })
      .getByText("მოვიდა")
      .first(), // the list shows the whole week; earlier runs may have used another day of it
  ).toBeVisible();
});

test("staff see only their own column", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.staff@demo.test");
  await page.goto(`/ka/calendar?view=day&date=${weekdayAhead(1)}`);
  await expect(page.getByText("ანა გელაშვილი").first()).toBeVisible();
  await expect(page.getByText("ეკა მაჭავარიანი")).toHaveCount(0);
});

test("phone: calendar opens as a list and never scrolls sideways", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await signIn(page, "dental.owner@demo.test");
  await page.goto("/ka/calendar");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("tab", { name: "სია" })).toHaveAttribute("aria-selected", "true");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("staff 'My day': own bookings and numbers", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.staff@demo.test");
  await page.goto("/ka/my-day");
  await expect(page.getByRole("heading", { name: "ჩემი დღე" })).toBeVisible();
  await expect(page.getByRole("main").getByText(/^ანა გელაშვილი ·/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "მომავალი" })).toBeVisible();
});

test("client card shows visit history", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/clients");
  await page.waitForLoadState("networkidle");
  // the demo owner is also called Nino Beridze: look only in the client list
  await page
    .getByRole("main")
    .getByRole("button", { name: /^ნინო ბერიძე/ })
    .first()
    .click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("heading", { name: "ვიზიტები" })).toBeVisible();
  await expect(panel.getByText(/₾/).first()).toBeVisible();
});

test("dental notes: the doctor reads and writes, the clinic admin cannot", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "dental.doctor@demo.test");
  await page.goto("/ka/my-day");
  await page.locator("main ul button").first().click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "ჩანაწერების ნახვა" }).click();
  const note = `კბილი 36 — შემოწმება ${Date.now()}`;
  await panel.getByRole("textbox", { name: "ჩანაწერის დამატება" }).fill(note);
  await panel.getByRole("button", { name: "ჩანაწერის დამატება" }).click();
  await expect(panel.getByText(note)).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, "dental.admin@demo.test");
  await page.goto("/ka/clients");
  await page.waitForLoadState("networkidle");
  await page.locator("main ul button").first().click();
  await page.getByRole("dialog").getByRole("button", { name: "ჩანაწერების ნახვა" }).click();
  await expect(
    page.getByRole("dialog").getByText("მკურნალობის ჩანაწერებს ხედავენ მხოლოდ ექიმები"),
  ).toBeVisible();
});
