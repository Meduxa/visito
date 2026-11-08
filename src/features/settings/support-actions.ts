"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";

// The owner lets Visito support VIEW the business for 24 or 72 hours, or ends it
// (SPEC 4.15). Works even while the business is read-only, so support can help then.
async function owner() {
  const locale = await getLocale();
  await requireUser(locale);
  const tenant = await getActiveTenant();
  return tenant?.role === "owner" && !tenant.supportUntil ? { locale, tenant } : null;
}

export async function allowSupport(hours: number): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return fail("notAllowed");
  if (hours !== 24 && hours !== 72) return fail("invalidInput");
  const { error } = await (
    await createClient()
  ).rpc("grant_support_access", {
    p_tenant: ctx.tenant.tenantId,
    p_hours: hours,
  });
  if (error) return fail("generic");
  revalidatePath(`/${ctx.locale}/settings`, "layout");
  return ok(undefined);
}

export async function endSupport(): Promise<ActionResult> {
  const ctx = await owner();
  if (!ctx) return fail("notAllowed");
  const { error } = await (
    await createClient()
  ).rpc("revoke_support_access", {
    p_tenant: ctx.tenant.tenantId,
  });
  if (error) return fail("generic");
  revalidatePath(`/${ctx.locale}/settings`, "layout");
  return ok(undefined);
}
