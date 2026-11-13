// The foldable sidebar (Levan, 2026-11-13): fold, the choice survives a reload,
// names on hover, Ctrl+B unfolds. Desktop only (phones have the bottom menu).
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" });
}

test("the sidebar folds to icons, remembers it, and unfolds with Ctrl+B", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  const aside = page.locator("aside");
  await expect(aside).toHaveAttribute("data-collapsed", "false");

  await page.getByRole("button", { name: "მენიუს ჩაკეცვა" }).click();
  await expect(aside).toHaveAttribute("data-collapsed", "true");
  await expect.poll(async () => (await aside.boundingBox())?.width).toBe(64);

  // still folded after a reload, with no flash of the wide menu
  await page.reload();
  await expect(aside).toHaveAttribute("data-collapsed", "true");
  // links keep their names for screen readers, and show them on hover
  const clients = aside.getByRole("link", { name: "კლიენტები" });
  await clients.hover();
  await expect(page.getByRole("tooltip", { name: "კლიენტები" })).toBeVisible();
  await clients.click();
  await page.waitForURL("**/ka/clients");

  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+b");
  await expect(aside).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByRole("button", { name: "მენიუს ჩაკეცვა" })).toBeVisible();
});
