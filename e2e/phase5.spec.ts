// Phase 5: SMS settings, templates, manual and bulk SMS, unsubscribe, log, job.
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { SMS_SALON_TOOLS } from "../src/lib/pilot";

// some tests here walk through several pages and sign-ins
test.describe.configure({ timeout: 60_000 });

async function signIn(page: Page, email: string) {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" }); // the page itself may still be loading
}

// The fake SMS provider writes every message to .dev/sms-outbox.jsonl.
async function sms(match: (m: { to: string; text: string }) => boolean, atLeast = 1) {
  for (let i = 0; i < 60; i++) {
    if (existsSync(".dev/sms-outbox.jsonl")) {
      const found = readFileSync(".dev/sms-outbox.jsonl", "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l) as { to: string; text: string })
        .filter(match);
      if (found.length >= atLeast) return found;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("SMS not found");
}

test("SMS settings: sender name waits for approval; texts are checked, saved and reset", async ({
  page,
}, info) => {
  test.skip(!SMS_SALON_TOOLS, "pilot: salons' own SMS tools are off (decision 033)");
  test.skip(info.project.name !== "desktop");
  await signIn(page, "dental.owner@demo.test");
  await page.goto("/ka/settings/sms");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("დარჩენილი SMS")).toBeVisible();

  await page.getByLabel("გამგზავნის სახელი").fill("DentSmile");
  await page.getByRole("button", { name: "შენახვა", exact: true }).click();
  await expect(page.getByText("შენახულია").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("ელოდება დამტკიცებას")).toBeVisible();

  const reminder = page.getByRole("region", { name: "შეხსენება" }).first();
  const box = reminder.getByRole("textbox");
  await box.fill("{business_name}: ხვალ {time} {clientname}");
  await expect(reminder.getByText("უცნობი ცვლადი: clientname")).toBeVisible();
  await expect(reminder.getByRole("button", { name: "ტექსტის შენახვა" })).toBeDisabled();

  await box.fill(`{business_name}: გელოდებით {date}, {time} ${Date.now() % 1000}`);
  await expect(reminder.getByText(/სიმბოლო · 1 SMS/)).toBeVisible();
  await reminder.getByRole("button", { name: "ტექსტის შენახვა" }).click();
  await expect(reminder.getByText("თქვენი ტექსტი")).toBeVisible();
  await reminder.getByRole("button", { name: "ნაგულისხმევზე დაბრუნება" }).click();
  await expect(reminder.getByText("ნაგულისხმევი ტექსტი")).toBeVisible();
});

test("manual SMS to a client; a promotion needs consent; it shows in the log", async ({ page }, info) => {
  test.skip(!SMS_SALON_TOOLS, "pilot: salons' own SMS tools are off (decision 033)");
  test.skip(info.project.name !== "desktop");
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/clients");
  await page.waitForLoadState("networkidle");
  const text = `ვაგვიანებთ 10 წუთით ${Date.now()}`;

  // demo client 0 (+995555100000) agreed to SMS; client 1 (+995555103137) did not
  await page.getByRole("searchbox").fill("555100000");
  await expect(page.getByText("1 კლიენტი", { exact: true })).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("button", { name: /ნინო ბერიძე/ })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "SMS-ის გაგზავნა" }).click();
  await page.getByLabel("შეტყობინება").fill(text);
  await page.getByRole("button", { name: "გაგზავნა", exact: true }).click();
  await expect(page.getByText("SMS გაიგზავნა")).toBeVisible();
  await sms((m) => m.to === "+995555100000" && m.text === text);

  await page.keyboard.press("Escape");
  await page.goto("/ka/clients");
  await page.waitForLoadState("networkidle");
  await page.getByRole("searchbox").fill("555103137");
  await expect(page.getByText("1 კლიენტი", { exact: true })).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("button", { name: /მარიამ/ })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "SMS-ის გაგზავნა" }).click();
  await page.getByLabel("შეტყობინება").fill("აქცია −20%");
  await page.getByText("ეს აქციაა").click();
  await page.getByRole("button", { name: "გაგზავნა", exact: true }).click();
  await expect(page.getByText(/არ გაიგზავნა: კლიენტი არ დათანხმებია/)).toBeVisible();

  await page.goto("/ka/settings/sms/log");
  await expect(page.getByText(text)).toBeVisible();
  await page.goto("/ka/settings/sms/log?status=failed");
  await expect(page.getByText("არ არის მარკეტინგული თანხმობა").first()).toBeVisible();
});

test("promotion to VIP clients, and the unsubscribe link works", async ({ page }, info) => {
  test.skip(!SMS_SALON_TOOLS, "pilot: salons' own SMS tools are off (decision 033)");
  test.skip(info.project.name !== "desktop");
  // promotions wait for the end of the demo salon's quiet hours (22:00–09:00 Tbilisi)
  const hour = Number(
    new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", hourCycle: "h23" }),
  );
  test.skip(hour >= 22 || hour < 9, "quiet hours in Tbilisi — promotions are held until 09:00");
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/clients");
  await page.waitForLoadState("networkidle");
  const open = async () => {
    await page.getByRole("button", { name: "SMS კლიენტებს" }).click();
    await page.getByLabel(/მხოლოდ თეგით/).fill("VIP");
    const line = page.getByText(/^მიიღებს \d+ კლიენტი$/);
    await expect(line).toBeVisible();
    return Number((await line.textContent())!.match(/\d+/)![0]);
  };
  const before = await open();
  test.skip(before === 0, "every VIP demo client already unsubscribed — reseed");
  const text = `VIP აქცია ${Date.now()}`;
  await page.getByLabel("შეტყობინება").fill(text);
  await page.getByRole("button", { name: `გაგზავნა (${before})` }).click();
  await expect(page.getByText(`${before} SMS იგზავნება`)).toBeVisible();

  const sent = await sms((m) => m.text.startsWith(text), before);
  expect(sent.length).toBe(before);
  const link = sent[0].text.match(/\/u\/([A-Za-z0-9_-]{32})/)![1];
  await page.goto(`/ka/u/${link}`);
  await page.getByRole("button", { name: "გამოწერის გაუქმება" }).click();
  await expect(page.getByText("მზადაა — გამოწერა გაუქმებულია.")).toBeVisible();

  await page.goto("/ka/clients");
  await page.waitForLoadState("networkidle");
  expect(await open()).toBe(before - 1);
});

test("a broken unsubscribe link is refused", async ({ page }) => {
  await page.goto("/ka/u/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  await expect(page.getByRole("heading", { name: "ბმული არ მუშაობს" })).toBeVisible();
});

test("the SMS job answers locally", async ({ request }) => {
  // locally the job runs without a secret; against a production build it needs one
  const secret = process.env.CRON_SECRET;
  const res = await request.get(
    "/api/cron/sms",
    secret ? { headers: { authorization: `Bearer ${secret}` } } : {},
  );
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ queued: expect.any(Number), sent: expect.any(Number) });
});

test("phone: SMS settings never scroll sideways", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await signIn(page, "salon.admin@demo.test");
  await page.goto("/ka/settings/sms");
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("pilot: salons see only the automatic SMS switches; Visito writes the texts", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop" || SMS_SALON_TOOLS);
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/settings/sms");
  await expect(page.getByText(/პილოტის პერიოდში SMS იგზავნება Visito-ს/)).toBeVisible();
  await expect(page.getByLabel("გამგზავნის სახელი")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ტექსტის შენახვა" })).toHaveCount(0);
  await expect(page.getByRole("switch").first()).toBeVisible(); // the on/off switches stay
  // nobody but Visito's admins reaches the texts page
  await page.goto("/ka/admin/sms-texts");
  await expect(page.getByRole("heading", { name: "SMS ტექსტები" })).toHaveCount(0);

  await page.context().clearCookies();
  await signIn(page, "platform.admin@demo.test");
  await page.goto("/ka/admin/sms-texts");
  await expect(page.getByRole("heading", { name: "SMS ტექსტები" })).toBeVisible();
  await expect(page.getByTestId("ptxt-ka-confirmed").getByRole("textbox")).toBeVisible();
  await expect(page.getByTestId("ptxt-ka-review")).toBeVisible();
});
