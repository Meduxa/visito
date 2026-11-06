// Accessibility (WCAG 2.1 AA, the bar the spec sets for the booking page): automatic
// axe checks on the main screens, phone and desktop. Each violation is listed by rule
// and element so it can be fixed, not just counted.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

async function scan(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map(
    (v) =>
      `${path} — ${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 3)
        .join(" | ")}`,
  );
}

test("public pages", async ({ page }) => {
  const found = [
    ...(await scan(page, "/ka")),
    ...(await scan(page, "/ka/login")),
    ...(await scan(page, "/ka/signup")),
    ...(await scan(page, "/ka/book/demo-salon")),
    ...(await scan(page, "/ka/m/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")),
    ...(await scan(page, "/ka/legal/privacy")),
  ];
  expect(found, found.join("\n")).toEqual([]);
});

test("the app, signed in as the owner", async ({ page }) => {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill("salon.owner@demo.test");
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard");
  const found: string[] = [];
  for (const p of [
    "/ka/dashboard",
    "/ka/calendar",
    "/ka/calendar?view=list",
    "/ka/clients",
    "/ka/services",
    "/ka/staff",
    "/ka/cash",
    "/ka/reports",
    "/ka/settings/business",
    "/ka/settings/sms",
    "/ka/settings/team",
    "/ka/more",
  ])
    found.push(...(await scan(page, p)));
  expect(found, found.join("\n")).toEqual([]);
});
