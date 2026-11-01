// Takes the screenshots for the landing page from the running dev app
// (npm.cmd run dev, demo data seeded): the salon website on a phone and the
// calendar and reports on a desktop, in each language. Output: public/landing/*.webp
import { chromium } from "@playwright/test";
import sharp from "sharp";

const BASE = process.env.SHOTS_URL ?? "http://localhost:3000";
// the dev server's corner badge is not part of the app
const HIDE_DEV = "nextjs-portal { display: none !important; }";
const out = (name: string) => `public/landing/${name}.webp`;

const browser = await chromium.launch();
for (const locale of ["ka", "en", "ru"]) {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await phone.goto(`${BASE}/${locale}/book/demo-salon`);
  await phone.waitForLoadState("networkidle");
  await phone.addStyleTag({ content: HIDE_DEV });
  await sharp(await phone.screenshot())
    .resize(780)
    .webp({ quality: 78 })
    .toFile(out(`booking-${locale}`));
  await phone.close();

  const desk = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
  await desk.goto(`${BASE}/${locale}/login`);
  await desk.locator("#email").fill("salon.owner@demo.test");
  await desk.locator("#password").fill("Demo-Bookeria-2026");
  await desk.locator("form button[type=submit]").click();
  await desk.waitForURL(`**/${locale}/dashboard`);
  const day = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  await desk.goto(`${BASE}/${locale}/calendar?view=day&date=${day}`);
  await desk.waitForLoadState("networkidle");
  await desk.addStyleTag({ content: HIDE_DEV });
  await sharp(await desk.screenshot())
    .resize(1280)
    .webp({ quality: 78 })
    .toFile(out(`calendar-${locale}`));
  // reports for the last 30 days (enough demo visits to fill the charts)
  const to = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  const from = new Date(Date.now() - 29 * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Tbilisi",
  });
  await desk.goto(`${BASE}/${locale}/reports?from=${from}&to=${to}`);
  await desk.waitForLoadState("networkidle");
  await desk.addStyleTag({ content: HIDE_DEV });
  await sharp(await desk.screenshot())
    .resize(1280)
    .webp({ quality: 78 })
    .toFile(out(`reports-${locale}`));
  await desk.close();
  console.log("✓", locale);
}
await browser.close();
