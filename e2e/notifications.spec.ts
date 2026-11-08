// In-app notifications (decision 019): a client books online, the owner sees
// it under the bell next to the logo — client, service, specialist, date and
// time — and the notification opens that booking in the calendar.
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const TZ = "Asia/Tbilisi";
const plusDays = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
function weekdayAhead(from: number) {
  for (let n = from; ; n++) {
    const day = new Date(`${plusDays(n)}T12:00:00Z`).getUTCDay();
    if (day >= 1 && day <= 5) return plusDays(n);
  }
}
const randomPhone = () => `599${String(Math.floor(100_000 + Math.random() * 899_999))}`;

// The fake SMS provider writes every message to .dev/sms-outbox.jsonl.
async function lastSms(e164: string, contains: string) {
  for (let i = 0; i < 40; i++) {
    if (existsSync(".dev/sms-outbox.jsonl")) {
      const found = readFileSync(".dev/sms-outbox.jsonl", "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l) as { to: string; text: string })
        .filter((m) => m.to === e164 && m.text.includes(contains))
        .at(-1);
      if (found) return found.text;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no SMS to ${e164}`);
}

async function bookOnline(page: Page, last: string) {
  await page.goto("/ka/book/orchidea");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /ფრჩხილები/ }).click();
  await page.getByText("კლასიკური მანიკური").click();
  await page.getByRole("button", { name: "გაგრძელება" }).click();
  await page.getByRole("radio", { name: /ნებისმიერი თავისუფალი/ }).click();
  await page.getByLabel("სხვა თარიღი").fill(weekdayAhead(8 + Math.floor(Math.random() * 40)));
  const times = page.getByRole("radiogroup", { name: "თარიღი და დრო" }).getByRole("radio");
  await expect(times.first()).toBeVisible();
  // any free time that day: phone and desktop run in parallel and must not pick the same one
  await times.nth(Math.floor(Math.random() * (await times.count()))).click();
  const phone = randomPhone();
  await page.getByLabel("სახელი", { exact: true }).fill("ონლაინ");
  await page.getByLabel("გვარი").fill(last);
  await page.getByLabel("მობილური").fill(phone);
  // the business may or may not ask for an SMS code (a setting)
  const sendCode = page.getByRole("button", { name: "SMS კოდის გაგზავნა" });
  await expect(sendCode.or(page.getByRole("button", { name: "დაჯავშნა", exact: true }))).toBeVisible();
  if (await sendCode.isVisible()) {
    await sendCode.click();
    await page.getByLabel("SMS კოდი").fill((await lastSms(`+995${phone}`, "კოდია")).match(/\d{6}/)![0]);
  }
  await page.getByRole("button", { name: "დაჯავშნა" }).click();
  await expect(page.getByRole("heading", { name: "დაჯავშნილია!" })).toBeVisible();
  // "26 ოქტომბერი 2026, 15:45"
  return (await page.locator("main p.font-medium").first().textContent())!.split(", ").at(-1)!;
}

test("an online booking shows up under the bell and opens in the calendar", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90_000); // a client and a team member, two sign-ins' worth of pages
  const last = `შეტყობინება${Math.floor(Math.random() * 1e6)}`;
  const time = await bookOnline(page, last);

  const owner = await browser.newPage({ viewport: page.viewportSize()! });
  await owner.goto("/ka/login");
  await owner.getByLabel("ელფოსტა").fill("salon.owner@demo.test");
  await owner.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await owner.getByRole("button", { name: "შესვლა" }).click();
  await owner.waitForURL("**/ka/dashboard", { waitUntil: "commit" });
  await owner.waitForLoadState("networkidle");

  // the bell sits next to the logo (sidebar on desktop, header on the phone)
  const bell = owner.locator('[data-testid="notification-bell"]:visible');
  await expect(bell).toHaveCount(1);
  await expect(bell.getByTestId("notification-badge")).toBeVisible();
  await bell.click();
  const panel = owner.getByRole("dialog", { name: "შეტყობინებები" });
  await expect(panel.getByRole("heading", { name: "შეტყობინებები" })).toBeVisible();

  const item = panel.getByTestId("notification-item").filter({ hasText: last });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("ახალი ონლაინ ჯავშანი");
  await expect(item).toContainText(`ონლაინ ${last}`); // client
  await expect(item).toContainText("კლასიკური მანიკური"); // service
  await expect(item).toContainText(time); // start time in Tbilisi time
  // client · date, time · service · specialist
  expect((await item.locator("span.text-muted-foreground").first().textContent())!.split(" · ")).toHaveLength(
    4,
  );

  if (info.project.name === "mobile") {
    // the panel fits the phone screen
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  } else {
    // "mark all as read" is stored on the server: still read after a reload
    await expect(item.getByText("1 წაუკითხავი")).toHaveCount(1);
    const saved = owner.waitForResponse((r) => r.request().method() === "POST");
    await panel.getByRole("button", { name: "ყველას წაკითხულად მონიშვნა" }).click();
    await expect(bell.getByTestId("notification-badge")).toHaveCount(0);
    await saved;
    await owner.reload();
    await owner.waitForLoadState("networkidle");
    await bell.click();
    await expect(item).toHaveCount(1);
    await expect(item.getByText("1 წაუკითხავი")).toHaveCount(0);
  }

  await item.click();
  await owner.waitForURL(/\/ka\/calendar\?.*booking=/);
  await expect(owner.getByRole("dialog").getByText(`ონლაინ ${last}`).first()).toBeVisible();
  await owner.close();
});
