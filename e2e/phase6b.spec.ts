// Phase 6b: installable app, security headers, no blocked content.
import { expect, test, type Page } from "@playwright/test";

test("installable: manifest, icons, service worker, offline page", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const m = (await manifest.json()) as {
    name: string;
    display: string;
    icons: { src: string; purpose: string }[];
  };
  expect(m).toMatchObject({ name: "Visito", display: "standalone" });
  expect(m.icons.map((i) => i.purpose)).toContain("maskable");
  for (const i of m.icons) expect((await request.get(i.src)).status()).toBe(200);
  expect((await request.get("/icons/apple-touch-icon.png")).status()).toBe(200);
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
  expect(await (await request.get("/offline.html")).text()).toContain("ინტერნეტთან კავშირი არ არის");
});

test("security headers on pages", async ({ request }) => {
  const res = await request.get("/ka/login");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();
});

// The content policy must not block anything the app itself uses.
async function noBlocked(page: Page, path: string, blocked: string[]) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  expect(blocked, `${path}: ${blocked.join(" | ")}`).toEqual([]);
}

test("no content blocked by the security policy", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(90_000);
  const blocked: string[] = [];
  page.on(
    "console",
    (m) => /Content Security Policy|Refused to/i.test(m.text()) && blocked.push(m.text().slice(0, 160)),
  );
  await noBlocked(page, "/ka/book/orchidea", blocked);
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill("salon.owner@demo.test");
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard");
  for (const p of [
    "/ka/dashboard",
    "/ka/calendar",
    "/ka/clients",
    "/ka/staff",
    "/ka/settings/business",
    "/ka/settings/website",
    "/ka/reports",
  ])
    await noBlocked(page, p, blocked);
});

test("legal pages are reachable from sign-up and the booking page, in every language", async ({ page }) => {
  await page.goto("/ka/signup");
  await page.getByRole("link", { name: "კონფიდენციალურობის პოლიტიკა" }).first().waitFor();
  await page.goto("/ka/book/orchidea");
  // opens in a new tab, so a half-finished booking (or an embedded form) is not lost
  const [terms] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("contentinfo").getByRole("link", { name: "მომსახურების პირობები" }).click(),
  ]);
  await expect(terms.getByRole("heading", { level: 1, name: "მომსახურების პირობები" })).toBeVisible();
  await expect(terms.getByRole("note")).toContainText("სამუშაო ვერსია");
  await terms.close();
  for (const [l, title] of [
    ["en", "Data processing agreement"],
    ["ru", "Политика конфиденциальности"],
  ] as const) {
    await page.goto(`/${l}/legal/${l === "en" ? "dpa" : "privacy"}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  }
  expect((await page.goto("/ka/legal/nothing"))?.status()).toBe(404);
});
