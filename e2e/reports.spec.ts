// Reports in sections (tabs), each chart switchable to a table, and a
// comparison with the previous period or last year.
import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

test("report tabs, chart/table and measure switches, comparison", async ({ page }, info) => {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill("salon.owner@demo.test");
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" });

  await page.goto("/ka/reports?from=2026-01-01&to=2026-12-31");
  const tabs = page.getByRole("navigation", { name: "ანგარიშის განყოფილებები" });
  for (const name of ["მიმოხილვა", "შემოსავალი", "გადახდები", "სერვისები", "კლიენტები", "სპეციალისტები"])
    await expect(tabs.getByRole("link", { name })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "მიმოხილვა" })).toHaveAttribute("aria-current", "page");

  // a year is charted by month: 12 bars' worth of rows in the table view
  const overTime = page.getByTestId("chart-over-time");
  await expect(overTime.locator("svg.recharts-surface")).toBeVisible();
  await overTime.getByRole("radio", { name: "ჯავშნები" }).click();
  await expect(overTime.getByRole("radio", { name: "ჯავშნები" })).toHaveAttribute("aria-checked", "true");
  await overTime.getByRole("radio", { name: "ცხრილი" }).click();
  await expect(overTime.getByRole("table").locator("tbody tr")).toHaveCount(12);
  await expect(overTime.getByRole("cell", { name: "ნოემბერი 2026" })).toBeVisible();

  // compare with the previous period: every number card says how it changed
  await page.getByLabel("შედარება").selectOption({ label: "წინა პერიოდი" });
  await page.getByRole("button", { name: "ჩვენება" }).click();
  await expect(page).toHaveURL(/compare=previous/);
  await expect(page.getByTestId("report-delta").or(page.getByText("— წინა პერიოდთან")).first()).toBeVisible();
  await expect(page.getByText(/წინა პერიოდი: .* 2025 — .* 2025/)).toBeVisible();
  const table = page.getByTestId("chart-over-time");
  await table.getByRole("radio", { name: "ცხრილი" }).click();
  await expect(table.getByRole("columnheader", { name: "ცვლილება" }).first()).toBeVisible();

  // tabs keep the period and the comparison
  await tabs.getByRole("link", { name: "გადახდები" }).click();
  await expect(page).toHaveURL(/tab=payments/);
  await expect(page).toHaveURL(/compare=previous/);
  await expect(page.getByTestId("chart-methods")).toBeVisible();

  await tabs.getByRole("link", { name: "სპეციალისტები" }).click();
  await expect(page.getByTestId("chart-staff")).toBeVisible();
  await expect(page.getByTestId("staff-table")).toBeVisible();

  if (info.project.name === "mobile") {
    // nothing sticks out sideways on the phone
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  }
});
