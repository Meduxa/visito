// Online booking extras (decision 023): hide prices, limit on upcoming visits
// (the limit itself is proven in supabase/tests/rls_online_limits.test.ts), and
// the booking form for a frame on the salon's own website.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

async function signIn(page: Page, email: string) {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" });
}

test("only the embed page may be framed by other sites", async ({ request }) => {
  const embed = (await request.get("/ka/embed/orchidea")).headers();
  expect(embed["content-security-policy"]).toContain("frame-ancestors *");
  expect(embed["x-frame-options"]).toBeUndefined();
  for (const path of ["/ka/book/orchidea", "/ka/login", "/ka/embed/orchidea/x"]) {
    const h = (await request.get(path)).headers();
    expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"], path).toBe("DENY");
  }
});

test("the booking form works inside another website's frame", async ({ page, baseURL }) => {
  // a pretend salon website on another address (a real little server: Chrome
  // won't let a faked page frame localhost), with the code from Settings
  const site = createServer((_, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<h1>Salon site</h1><iframe src="${baseURL}/ka/embed/orchidea" title="booking" style="width:600px;height:700px"></iframe>`,
    );
  });
  await new Promise<void>((done) => site.listen(0, "127.0.0.1", done));
  try {
    await page.goto(`http://127.0.0.1:${(site.address() as AddressInfo).port}/`);
    const frame = page.frameLocator('iframe[title="booking"]');
    await expect(frame.getByRole("heading", { level: 1, name: "სალონი ორქიდეა" })).toBeVisible();
    await expect(frame.getByRole("checkbox").first()).toBeVisible();
  } finally {
    site.close();
  }
});

test("owner hides prices and sets the limit; the booking page follows; embed code shown", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop"); // one business setting: one browser changes it
  await signIn(page, "salon.owner@demo.test");
  await page.goto("/ka/settings/booking");
  const prices = page.getByRole("switch", { name: "ფასების ჩვენება ჯავშნის გვერდზე" });
  const limit = page.getByLabel("მომავალი ვიზიტები ერთ კლიენტზე");
  const save = page.getByRole("main").getByRole("button", { name: "შენახვა" });

  // the code for the salon's own website
  await expect(page.getByRole("heading", { name: "ჯავშანი თქვენს საიტზე" })).toBeVisible();
  await expect(page.getByLabel("ჯავშნის ფორმა გვერდის შიგნით")).toHaveValue(
    /<iframe src="[^"]+\/ka\/embed\/orchidea"/,
  );
  await expect(page.getByLabel("ღილაკი, რომელიც ჯავშნის გვერდს ხსნის")).toHaveValue(/<a href="[^"]+orchidea/);

  await expect(prices).toHaveAttribute("aria-checked", "true");
  const services = page.getByRole("main");
  try {
    await prices.click();
    await limit.fill("2");
    await save.click();
    await expect(page.getByText("შენახულია").first()).toBeVisible();
    await page.reload();
    await expect(prices).toHaveAttribute("aria-checked", "false");
    await expect(limit).toHaveValue("2");

    await page.goto("/ka/book/orchidea");
    await expect(page.getByRole("checkbox").first()).toBeVisible();
    await expect(services).not.toContainText("₾");
  } finally {
    await page.goto("/ka/settings/booking");
    if ((await prices.getAttribute("aria-checked")) === "false") await prices.click();
    await limit.fill("0");
    await save.click();
    await expect(page.getByText("შენახულია").first()).toBeVisible();
  }
  await page.goto("/ka/book/orchidea");
  await expect(page.getByRole("checkbox").first()).toBeVisible();
  await expect(services).toContainText("₾");
});
