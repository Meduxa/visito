"use server";

import { refusal } from "@/lib/action-context";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";

// Deleting the business: the owner types its name; it is removed after 14 days
// unless they change their mind. Works even when the account is suspended.
async function ownerOnly() {
  const locale = await getLocale();
  await requireUser(locale);
  const tenant = await getActiveTenant();
  return tenant?.role === "owner" ? { tenant, locale } : null;
}

export async function requestDeletion(confirmName: string): Promise<ActionResult<{ due: string }>> {
  const ctx = await ownerOnly();
  if (!ctx) return fail(await refusal());
  const { data, error } = await (
    await createClient()
  ).rpc("request_tenant_deletion", {
    p_tenant: ctx.tenant.tenantId,
    p_confirm_name: (confirmName ?? "").slice(0, 200),
  });
  if (error) return fail(error.code === "22023" ? "nameMismatch" : "generic", "confirmName");
  revalidatePath(`/${ctx.locale}`, "layout");
  return ok({ due: data as string });
}

export async function cancelDeletion(): Promise<ActionResult> {
  const ctx = await ownerOnly();
  if (!ctx) return fail(await refusal());
  const { error } = await (
    await createClient()
  ).rpc("cancel_tenant_deletion", { p_tenant: ctx.tenant.tenantId });
  if (error) return fail("generic");
  revalidatePath(`/${ctx.locale}`, "layout");
  return ok(undefined);
}
