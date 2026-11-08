// Settings in sections (decision 021): a home with every section, a menu
// beside each section on desktop, "← Settings" on phones, and the
// Notifications section deciding who sees what under the bell.
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

async function signIn(page: Page, email: string) {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" });
}

const SECTIONS = [
  "ბიზნესის მონაცემები",
  "ონლაინ ჯავშანი",
  "ვებგვერდი",
  "დაკეტილი დღეები",
  "შეტყობინებები",
  "SMS და შეხსენებები",
  "გუნდი და წვდომა",
  "მონაცემები და უსაფრთხოება",
];

test("owner: settings home, sections, menu or back link", async ({ page }, info) => {
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/settings");
  await expect(page.getByRole("heading", { level: 1, name: "პარამეტრები" })).toBeVisible();
  const home = page.getByRole("main").getByRole("navigation", { name: "პარამეტრების განყოფილებები" });
  for (const name of SECTIONS)
    await expect(home.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
  // a salon has no rooms & chairs section
  await expect(home.getByRole("link", { name: /კაბინეტები და სავარძლები/ })).toHaveCount(0);

  await home.getByRole("link", { name: /^ონლაინ ჯავშანი/ }).click();
  await expect(page).toHaveURL(/\/ka\/settings\/booking$/);
  await expect(page.getByRole("heading", { level: 1, name: "ონლაინ ჯავშანი" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ონლაინ ჯავშნის ბმული" })).toBeVisible();

  if (info.project.name === "mobile") {
    await page.getByRole("link", { name: "პარამეტრები" }).first().click();
    await expect(page).toHaveURL(/\/ka\/settings$/);
  } else {
    const menu = page.getByRole("navigation", { name: "პარამეტრების განყოფილებები" });
    await expect(menu.getByRole("link", { name: "ონლაინ ჯავშანი" })).toHaveAttribute("aria-current", "page");
    await menu.getByRole("link", { name: "გუნდი და წვდომა" }).click();
    await expect(page).toHaveURL(/\/ka\/settings\/team$/);
    // what staff see is set next to the people now
    await expect(page.getByRole("switch", { name: "ადმინისტრატორები ხედავენ შემოსავალს" })).toBeVisible();
    await menu.getByRole("link", { name: "მონაცემები და უსაფრთხოება" }).click();
    await expect(page.getByRole("button", { name: "ბიზნესის წაშლა…" })).toBeVisible();
  }
});

test("notifications section saves who is told", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop"); // one business setting: one browser changes it
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/settings/notifications");
  const online = page.getByTestId("notify-online");
  const managers = online.getByRole("switch", { name: "მფლობელი და ადმინისტრატორები" });
  await expect(managers).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("notify-overdue").getByRole("switch")).toHaveCount(2);

  const save = page.getByRole("main").getByRole("button", { name: "შენახვა" });
  try {
    await managers.click();
    await save.click();
    await expect(page.getByText("შენახულია").first()).toBeVisible();
    // the owner's bell no longer lists online bookings
    const feed = (await (await page.request.get("/api/notifications")).json()) as {
      items: { kind: string }[];
    };
    expect(feed.items.some((i) => i.kind === "online_booking")).toBe(false);
    await page.reload();
    await expect(managers).toHaveAttribute("aria-checked", "false");
  } finally {
    await page.goto("/ka/settings/notifications");
    if ((await managers.getAttribute("aria-checked")) === "false") {
      await managers.click();
      await save.click();
      await expect(page.getByText("შენახულია").first()).toBeVisible();
    }
  }
});

test("staff: no settings menu, only the team page", async ({ page }) => {
  await signIn(page, "salon.staff@demo.test");
  await page.goto("/ka/settings");
  await expect(page).toHaveURL(/\/ka\/settings\/team$/);
  await expect(page.getByRole("navigation", { name: "პარამეტრების განყოფილებები" })).toHaveCount(0);
  await page.goto("/ka/settings/notifications");
  await expect(page).toHaveURL(/\/ka\/dashboard$/);
});
