// Decision 032: branches. Uses the dental demo (the salon tests use the salon's
// booking page, which a second branch would change). Removes the branch at the end.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { expect, test, type Page } from "@playwright/test";
import { assertDevProject } from "../scripts/dev-project.mts";

config({ path: ".env.local", quiet: true });
test.describe.configure({ timeout: 120_000 });

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assertDevProject(url, "The end-to-end tests");
  return createClient(url!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
}

async function signIn(page: Page, email: string) {
  await page.goto("/ka/login");
  await page.getByLabel("ელფოსტა").fill(email);
  await page.getByLabel("პაროლი").fill("Demo-Visito-2026");
  await page.getByRole("button", { name: "შესვლა" }).click();
  await page.waitForURL("**/ka/dashboard", { waitUntil: "commit" });
}

test("owner adds a branch; clients choose it on the booking page and get its own link", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop"); // changes shared demo data
  const db = admin();
  const { data: tenant } = await db.from("tenants").select("id").eq("slug", "demo-dental").single();
  const name = "E2E ფილიალი";
  await db.from("locations").delete().eq("tenant_id", tenant!.id).eq("name", name); // a crashed earlier run
  try {
    await signIn(page, "dental.owner@demo.test");
    await page.goto("/ka/settings/branches");
    await page.getByLabel("ფილიალის სახელი").fill(name);
    await page.getByLabel("მისამართი").fill("ვაკე, ტესტის ქ. 1");
    await page.getByRole("button", { name: "ფილიალის დამატება" }).click();
    await page.waitForURL("**/ka/settings/branches/*");
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    // its own booking link (?branch=…) with a QR code
    await expect(page.getByRole("heading", { name: "ამ ფილიალის ჯავშნის ბმული" })).toBeVisible();
    await expect(page.getByText(/\?branch=branch-\d+/)).toBeVisible();
    // new branches start with the main branch's hours
    const { data: loc } = await db
      .from("locations")
      .select("id, slug, location_hours(id)")
      .eq("tenant_id", tenant!.id)
      .eq("name", name)
      .single();
    expect(loc!.location_hours.length).toBeGreaterThan(0);

    // the booking page asks for the branch first
    await page.goto("/ka/book/demo-dental");
    const picker = page.getByTestId("branch-picker");
    await expect(picker.getByRole("link")).toHaveCount(2);
    await picker.getByRole("link", { name: new RegExp(name) }).click();
    await page.waitForURL(`**/book/demo-dental?branch=${loc!.slug}`);
    // nobody works there yet: the page says so and lets the client choose again
    await expect(page.getByTestId("chosen-branch")).toContainText(name);
    await page.getByTestId("chosen-branch").getByRole("link", { name: "შეცვლა" }).click();
    await expect(page.getByTestId("branch-picker")).toBeVisible();
  } finally {
    await db.from("locations").delete().eq("tenant_id", tenant!.id).eq("name", name);
  }
});
