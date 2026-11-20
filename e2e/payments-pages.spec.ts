// What card payment providers (Flitt) check on the website: the payments and
// refunds page, card marks and legal links on the main page and legal pages.
import { expect, test } from "@playwright/test";

test("payments and refunds page, linked with the card marks from the main page", async ({ page }) => {
  await page.goto("/ka");
  const footer = page.getByTestId("company-footer");
  await expect(footer.getByRole("img", { name: "Visa, Mastercard" })).toBeVisible();
  await expect(footer.getByText("უსაფრთხო გადახდა ბარათით: Flitt (TBC Group)")).toBeVisible();
  await footer.getByRole("link", { name: "გადახდები და დაბრუნება" }).click();
  await page.waitForURL("**/ka/legal/payments");
  await expect(
    page.getByRole("heading", { name: "გადახდა, ავტომატური განახლება და თანხის დაბრუნება", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "4. ავტომატური გადახდის გამორთვა" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "6. თანხის დაბრუნება" })).toBeVisible();
  await expect(page.getByTestId("company-footer")).toBeVisible();

  await page.goto("/en/legal/payments");
  await expect(page.getByRole("heading", { name: "6. Refunds" })).toBeVisible();
});

test("all four legal documents open; Russian shows the English text with a note", async ({ page }) => {
  for (const [path, title] of [
    ["/ka/legal/terms", "მომსახურების პირობები"],
    ["/ka/legal/privacy", "კონფიდენციალურობის პოლიტიკა"],
    ["/ka/legal/dpa", "მონაცემთა დამუშავების ხელშეკრულება"],
    ["/en/legal/dpa", "Data Processing Agreement"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(
      page.getByText("ვერსია: 2026-11-14").or(page.getByText("Version: 2026-11-14")),
    ).toBeVisible();
  }
  await page.goto("/ru/legal/terms");
  await expect(page.getByText("Русская версия документа готовится.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Terms of Service", level: 1 })).toBeVisible();
});
