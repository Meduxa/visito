import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// End-to-end tests against a production build (`npm.cmd run test:e2e`, decision 010):
// what users get — no on-demand compiling, so timings are realistic and stable.
// The fake SMS provider must be allowed explicitly in production mode, and the
// job routes need their secret (a throwaway one, only for this local server).
process.env.CRON_SECRET ??= "e2e-local-secret";
const PORT = 3100;
// short salon addresses: demo-salon.localhost:3100
process.env.SITE_DOMAIN ??= `localhost:${PORT}`;

export default defineConfig({
  ...base,
  workers: 4,
  expect: { timeout: 10_000 },
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/ka/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    // tests never send real SMS, even when .env.local has the sender.ge key
    env: { SMS_PROVIDER: "fake", ALLOW_FAKE_SMS: "1", CRON_SECRET: process.env.CRON_SECRET },
  },
});
