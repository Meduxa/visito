// Decision 034: "forgot password", and email links that are used or expired.
// The email itself is not opened here (it needs a real mailbox, see docs/email-setup.md).
import { expect, test } from "@playwright/test";

test("forgot password: link on sign-in, same answer for any address", async ({ page }) => {
  await page.goto("/ka/login");
  await page.getByRole("link", { name: "დაგავიწყდათ პაროლი?" }).click();
  await page.waitForURL("**/ka/forgot-password");
  await expect(page.getByRole("heading", { name: "დაგავიწყდათ პაროლი?" })).toBeVisible();
  await page.getByLabel("ელფოსტა").fill("nobody-here@example.test");
  await page.getByRole("button", { name: "ბმულის გაგზავნა" }).click();
  await expect(page.getByText("შეამოწმეთ ელფოსტა")).toBeVisible();
  await expect(page.getByText(/nobody-here@example\.test/)).toBeVisible();
});

test("a used or forged email link explains itself; the new-password page needs the link", async ({
  page,
}) => {
  await page.goto("/api/auth/confirm?token_hash=forged&type=email&next=/ka/onboarding");
  await page.waitForURL("**/ka/login?link=expired");
  await expect(page.getByText(/ეს ბმული უკვე გამოყენებულია/)).toBeVisible();

  await page.goto("/api/auth/confirm?token_hash=forged&type=recovery&next=/ka/reset-password");
  await page.waitForURL("**/ka/forgot-password?link=expired");
  await expect(page.getByText(/მოითხოვეთ ახალი ქვემოთ/)).toBeVisible();

  // another site in ?next= is never followed
  await page.goto("/api/auth/confirm?token_hash=forged&type=email&next=https://evil.example/");
  await page.waitForURL("**/ka/login?link=expired");

  await page.goto("/ka/reset-password");
  await page.waitForURL("**/ka/forgot-password?link=expired");
});
