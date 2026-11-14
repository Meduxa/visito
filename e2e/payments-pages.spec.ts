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
  await expect(page.getByRole("heading", { name: "გამორთვა" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "თანხის დაბრუნება", exact: true })).toBeVisible();
  await expect(page.getByTestId("company-footer")).toBeVisible();

  await page.goto("/en/legal/payments");
  await expect(page.getByRole("heading", { name: "Refunds", exact: true })).toBeVisible();
});
