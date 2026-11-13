// Phase 4: public online booking page and manage link, as a client on a phone.
import { readFileSync, existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { SMS_SALON_TOOLS } from "../src/lib/pilot";

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

async function pickServiceAndTime(page: Page) {
  await page.goto("/ka/book/orchidea");
  await expect(page.getByRole("heading", { level: 1, name: "სალონი ორქიდეა" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  // categories are folded (the first one is open): search finds a service in any of them
  await page.getByRole("searchbox", { name: "სერვისის ძებნა…" }).fill("პედიკ");
  await expect(page.getByText("პედიკური", { exact: true })).toBeVisible();
  await expect(page.getByText("კლასიკური მანიკური")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "სერვისის ძებნა…" }).fill("");
  // open the nails category and pick a service there
  await page.getByRole("button", { name: /ფრჩხილები/ }).click();
  await page.getByText("კლასიკური მანიკური").click();
  await page.getByRole("button", { name: "გაგრძელება" }).click();
  await page.getByRole("radio", { name: /ნებისმიერი თავისუფალი/ }).click();
  // a random weekday in the coming weeks, so reruns do not compete for the same times
  await page.getByLabel("სხვა თარიღი").fill(weekdayAhead(8 + Math.floor(Math.random() * 40)));
  const times = page.getByRole("radiogroup", { name: "თარიღი და დრო" }).getByRole("radio");
  await expect(times.first()).toBeVisible();
  await times.nth(Math.floor(Math.random() * Math.min(5, await times.count()))).click();
}

test("client books online with an SMS code, then moves and cancels with the link", async ({ page }) => {
  await pickServiceAndTime(page);
  const phone = randomPhone();
  await page.getByLabel("სახელი", { exact: true }).fill("ონლაინ");
  await page.getByLabel("გვარი").fill("კლიენტი");
  await page.getByLabel("მობილური").fill(phone);
  // marketing consent is not asked during the pilot (decision 033)
  if (SMS_SALON_TOOLS) await page.getByText("მსურს აქციების და სიახლეების მიღება SMS-ით").click();
  else await expect(page.getByText("მსურს აქციების და სიახლეების მიღება SMS-ით")).toHaveCount(0);
  await page.getByRole("button", { name: "SMS კოდის გაგზავნა" }).click();

  const code = (await lastSms(`+995${phone}`, "კოდია")).match(/\d{6}/)![0];
  await page.getByLabel("SMS კოდი").fill(code === "000000" ? "111111" : "000000"); // wrong first
  await page.getByRole("button", { name: "დაჯავშნა" }).click();
  await expect(page.getByText("კოდი არასწორია.")).toBeVisible();
  await page.getByLabel("SMS კოდი").fill(code);
  await page.getByRole("button", { name: "დაჯავშნა" }).click();
  await expect(page.getByRole("heading", { name: "დაჯავშნილია!" })).toBeVisible();
  await expect(page.getByRole("button", { name: "კალენდარში დამატება" })).toBeVisible();

  // the confirmation SMS is short (date, time, 💚 — no link); the manage link is on the success screen
  expect(await lastSms(`+995${phone}`, "💚")).not.toContain("/m/");
  const href = await page.getByRole("link", { name: "შეცვლა ან გაუქმება" }).getAttribute("href");
  const link = href!.match(/\/m\/([A-Za-z0-9_-]{32})/)![1];
  await page.goto(`/ka/m/${link}`);
  await expect(page.getByRole("heading", { name: "თქვენი ჯავშანი" })).toBeVisible();
  await expect(page.getByText("დადასტურებული")).toBeVisible();
  const before = await page.locator("dd").first().textContent();

  await page.getByRole("button", { name: "დროის შეცვლა" }).click();
  const times = page.getByRole("radiogroup", { name: "აირჩიეთ ახალი დრო" }).getByRole("radio");
  await expect(times.first()).toBeVisible();
  await times.last().click();
  await page.getByRole("button", { name: /^გადატანა/ }).click();
  await expect(page.getByText("მზადაა — ჯავშანი გადატანილია.")).toBeVisible();
  await expect(page.locator("dd").first()).not.toHaveText(before!);

  await page.getByRole("button", { name: "ჯავშნის გაუქმება" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ჯავშნის გაუქმება" }).click();
  await expect(page.getByText("ჯავშანი გაუქმებულია.")).toBeVisible();
  await expect(page.getByText("კლიენტმა გააუქმა")).toBeVisible();
});

test("a wrong manage link shows a friendly page", async ({ page }) => {
  await page.goto("/ka/m/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  await expect(page.getByRole("heading", { name: "ბმული არ მუშაობს" })).toBeVisible();
});

test("unknown business: not found", async ({ page }) => {
  const res = await page.goto("/ka/book/no-such-business-here");
  expect(res?.status()).toBe(404);
});

test("phone: booking page never scrolls sideways", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await page.goto("/ka/book/orchidea");
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the team sees the online client and visit in the client list", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop");
  await pickServiceAndTime(page);
  const phone = randomPhone();
  const last = `ტესტი${Math.floor(Math.random() * 1e6)}`;
  await page.getByLabel("სახელი", { exact: true }).fill("ონლაინ");
  await page.getByLabel("გვარი").fill(last);
  await page.getByLabel("მობილური").fill(phone);
  await page.getByLabel("კომენტარი (არასავალდებულო)").fill("პირველად მოვდივარ");
  await page.getByRole("button", { name: "SMS კოდის გაგზავნა" }).click();
  await page.getByLabel("SMS კოდი").fill((await lastSms(`+995${phone}`, "კოდია")).match(/\d{6}/)![0]);
  await page.getByRole("button", { name: "დაჯავშნა" }).click();
  await expect(page.getByRole("heading", { name: "დაჯავშნილია!" })).toBeVisible();
  const when = await page.locator("main p.font-medium").first().textContent(); // "26 ოქტომბერი 2026, 15:45"

  const staff = await browser.newPage();
  await staff.goto("/ka/login");
  await staff.getByLabel("ელფოსტა").fill("salon.owner@demo.test");
  await staff.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await staff.getByRole("button", { name: "შესვლა" }).click();
  await staff.waitForURL("**/ka/dashboard", { waitUntil: "commit" }); // the page itself may still be loading
  await staff.goto("/ka/clients");
  await staff.waitForLoadState("networkidle");
  await staff.getByRole("searchbox").fill(phone);
  await staff
    .getByRole("main")
    .getByRole("button", { name: new RegExp(last) })
    .click();
  await expect(staff.getByRole("dialog").getByText(when!.split(",")[0])).toBeVisible(); // in visit history
  await staff.close();
});

test("owner settings: booking link, QR code and the SMS code switch", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill("salon.owner@demo.test");
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" }); // the page itself may still be loading
  await page.goto("/ka/settings/booking");
  await expect(page.getByRole("heading", { name: "ონლაინ ჯავშნის ბმული" })).toBeVisible();
  // the short address (decision 016), switched on for these tests
  await expect(page.getByText(/^http:\/\/orchidea\.localhost:\d+$/)).toBeVisible();
  await expect(page.getByRole("img", { name: "QR კოდი" }).locator("svg")).toBeVisible();
  await expect(page.getByRole("switch", { name: "ონლაინ ჯავშანი SMS კოდით" })).toBeChecked();
});
