// "Requires additional service" (decision 037): colouring is followed by a blow-dry.
// The booking form reminds staff, both parts are saved as one visit, and the
// calendar shows two blocks with the specialist free in between.
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
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" });
}

// both tests switch the same service setting
test.describe.configure({ mode: "serial" });

async function setFollowUp(page: Page, on: boolean) {
  await page.goto("/ka/services");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /შეღებვა X პროდუქტით/ }).click();
  const dialog = page.getByRole("dialog");
  const sw = dialog.getByRole("switch", { name: "საჭიროებს დამატებით სერვისს" });
  if ((await sw.getAttribute("aria-checked")) !== String(on)) await sw.click();
  if (on) {
    await dialog.locator("#svc-followup").click();
    await page.getByRole("option", { name: "დავარცხნა" }).click();
    await dialog.getByLabel("რამდენ წუთში").fill("30");
  }
  await dialog.getByRole("button", { name: "შენახვა", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "შენახვა", exact: true })).toBeEnabled();
  await page.keyboard.press("Escape");
}

test("a service with an additional one: reminder, one visit, two blocks", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(60_000); // two service saves and a booking: close to 30 s on a slow evening
  await signIn(page, "salon.owner@demo.test");
  await setFollowUp(page, true);

  try {
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
    await panel.getByText("შეღებვა X პროდუქტით").click();
    const firstSlot = panel.getByRole("radio").first();
    await expect(firstSlot).toBeVisible();
    const time = (await firstSlot.textContent())!.slice(0, 5);
    await firstSlot.click();

    // the reminder, with the follow-up switched on and its time suggested
    const reminder = panel.getByTestId("followup-reminder");
    await expect(reminder).toContainText("საჭიროებს დამატებით სერვისს");
    await expect(reminder.getByRole("checkbox")).toBeChecked();
    const [h, m] = time.split(":").map(Number);
    const fu = h * 60 + m + 120 + 30; // colouring 120 min, then 30 min gap
    const suggested = `${String(Math.floor(fu / 60)).padStart(2, "0")}:${String(fu % 60).padStart(2, "0")}`;
    await expect(reminder.locator('[data-slot="time-input"]')).toHaveAttribute("data-value", suggested);

    // free times for the additional service: pick the last one instead of the suggestion
    const fuSlots = reminder.getByTestId("followup-slots").getByRole("radio");
    await expect(fuSlots.first()).toBeVisible();
    const last = fuSlots.last();
    const fuTime = (await last.textContent())!.trim();
    expect(fuTime).not.toBe(suggested);
    await last.click();
    await expect(last).toHaveAttribute("aria-checked", "true");
    await expect(reminder.locator('[data-slot="time-input"]')).toHaveAttribute("data-value", fuTime);

    await panel.getByRole("button", { name: "დაჯავშნა", exact: true }).click();
    await expect(panel).toBeHidden();

    // two blocks of the same visit: the colouring and, after the gap, the blow-dry
    const blocks = page.locator('[role="button"][aria-label*="ნინო ბერიძე"]');
    await expect(blocks).toHaveCount(2);
    await expect(
      page.locator(`[role="button"][aria-label^="${time}"][aria-label*="ნინო ბერიძე"]`),
    ).toBeVisible();
    // each block names only its own service
    const second = page.locator(`[role="button"][aria-label^="${fuTime}"][aria-label*="ნინო ბერიძე"]`);
    await expect(second).toBeVisible();
    await expect(second).toHaveAttribute("aria-label", /დავარცხნა/);
    await expect(second).not.toHaveAttribute("aria-label", /შეღებვა/);
    await expect(
      page.locator(`[role="button"][aria-label^="${time}"][aria-label*="ნინო ბერიძე"]`),
    ).not.toHaveAttribute("aria-label", /დავარცხნა/);
  } finally {
    await setFollowUp(page, false);
  }
});

test("additional service not added: flag in the calendar, added from the visit", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(60_000); // same: two service saves and a booking
  await signIn(page, "salon.owner@demo.test");
  await setFollowUp(page, true);

  try {
    let date = "";
    for (let tries = 0; ; tries++) {
      expect(tries).toBeLessThan(10);
      date = weekdayAhead(8 + Math.floor(Math.random() * 300));
      await page.goto(`/ka/calendar?view=day&date=${date}`);
      await page.waitForLoadState("networkidle");
      if ((await page.locator('[role="button"][aria-label*="–"]').count()) === 0) break;
    }

    // booked without the additional service (like an online booking)
    await page.getByRole("button", { name: "ახალი ჯავშანი" }).click();
    const panel = page.getByRole("dialog");
    await panel.getByRole("searchbox").fill("ნინო");
    await panel
      .getByRole("button", { name: /ნინო ბერიძე/ })
      .first()
      .click();
    await panel.getByText("შეღებვა X პროდუქტით").click();
    const firstSlot = panel.getByRole("radio").first();
    await expect(firstSlot).toBeVisible();
    const time = (await firstSlot.textContent())!.slice(0, 5);
    await firstSlot.click();
    await panel.getByTestId("followup-reminder").getByRole("checkbox").click();
    await panel.getByRole("button", { name: "დაჯავშნა", exact: true }).click();
    await expect(panel).toBeHidden();

    // the calendar marks the visit
    const block = page.locator(`[role="button"][aria-label^="${time}"][aria-label*="ნინო ბერიძე"]`);
    await expect(block).toHaveAttribute("aria-label", /დამატებითი სერვისი არ არის დამატებული/);
    await expect(block.getByText("დამატებითი სერვისი არ არის დამატებული")).toBeVisible();

    // the visit panel explains it and adds the service at a free time
    await block.click();
    const missing = page.getByRole("dialog").getByTestId("followup-missing");
    await expect(missing).toContainText("„დავარცხნა“ ჯერ არ არის დამატებული");
    await missing.getByRole("button", { name: "დამატება: „დავარცხნა“" }).click();
    const slot = missing.getByTestId("followup-add-slots").getByRole("radio").last();
    const fuTime = (await slot.textContent())!.trim();
    await slot.click();
    await missing.getByRole("button", { name: "ვიზიტში დამატება" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // two blocks now, no mark
    await expect(page.locator('[role="button"][aria-label*="ნინო ბერიძე"]')).toHaveCount(2);
    const second = page.locator(`[role="button"][aria-label^="${fuTime}"][aria-label*="ნინო ბერიძე"]`);
    await expect(second).toHaveAttribute("aria-label", /დავარცხნა/);
    await expect(block).not.toHaveAttribute("aria-label", /არ არის დამატებული/);
  } finally {
    await setFollowUp(page, false);
  }
});
