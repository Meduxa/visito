"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { managerContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { MAX_PHOTOS } from "./photo-limits";

// Photos for the public booking page. The file is uploaded by the browser into
// the business's own storage folder (storage RLS); here we record or remove it.
export async function addBusinessPhoto(path: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  if (
    !z
      .string()
      .regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/)
      .safeParse(path).success ||
    !path.startsWith(`${ctx.tenant.tenantId}/`)
  )
    return fail("invalidInput");
  const { count } = await ctx.supabase
    .from("business_photos")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenant.tenantId);
  if ((count ?? 0) >= MAX_PHOTOS) {
    await ctx.supabase.storage.from("business-photos").remove([path]);
    return fail("tooManyPhotos");
  }
  const { error } = await ctx.supabase
    .from("business_photos")
    .insert({ tenant_id: ctx.tenant.tenantId, path, sort_order: count ?? 0 });
  if (error) return fail("generic");
  revalidatePath(`/${ctx.locale}/settings`, "layout");
  return ok(undefined);
}

export async function removeBusinessPhoto(id: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !z.uuid().safeParse(id).success) return fail("invalidInput");
  const { data } = await ctx.supabase
    .from("business_photos")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.tenantId)
    .select("path")
    .single();
  if (data) await ctx.supabase.storage.from("business-photos").remove([data.path]);
  revalidatePath(`/${ctx.locale}/settings`, "layout");
  return ok(undefined);
}
