// Keyboard-only use (WCAG 2.1.1, 2.4.7): every control can be reached with Tab,
// shows where the focus is, and the main flows work without a mouse.
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

// Tabs through the page; returns controls that got focus without a visible indicator.
async function tabThrough(page: Page, max = 60) {
  const missing: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const ring = s.boxShadow !== "none" && !/^rgba\(0, 0, 0, 0\)[^,]*$/.test(s.boxShadow);
      const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
      const box = el.getBoundingClientRect();
      const label = `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}"`;
      return { label, visible: ring || outline, size: box.width > 0 && box.height > 0 };
    });
    if (!r) continue;
    if (seen.has(r.label)) continue;
    seen.add(r.label);
    if (!r.visible || !r.size) missing.push(r.label);
  }
  return { missing, reached: seen.size };
}

test("public booking page: every control shows focus", async ({ page }) => {
  await page.goto("/ka/book/demo-salon");
  await page.waitForLoadState("networkidle");
  const { missing, reached } = await tabThrough(page);
  expect(reached).toBeGreaterThan(10);
  expect(missing, missing.join("\n")).toEqual([]);
});

test("sign in and start a booking with the keyboard only", async ({ page }) => {
  await page.goto("/ka/login");
  await page.keyboard.press("Tab"); // language
  await page.getByLabel("ელფოსტა").focus();
  await page.keyboard.type("salon.owner@demo.test");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Demo-Visito-2026");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/ka/dashboard");

  await page.goto("/ka/book/demo-salon");
  const service = page.locator("#book").getByRole("checkbox").first();
  await service.focus();
  await page.keyboard.press("Space");
  await expect(service).toBeChecked();
  await page.getByRole("button", { name: "გაგრძელება" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "სპეციალისტი" })).toBeFocused();
});

test("the app, signed in: every control shows focus", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill("salon.owner@demo.test");
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard");
  const found: string[] = [];
  for (const path of ["/ka/dashboard", "/ka/calendar", "/ka/clients", "/ka/settings/business"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const { missing } = await tabThrough(page, 45);
    found.push(...missing.map((m) => `${path}: ${m}`));
  }
  expect(found, found.join("\n")).toEqual([]);
});
