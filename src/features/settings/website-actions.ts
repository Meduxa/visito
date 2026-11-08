"use server";

import { revalidatePath } from "next/cache";
import { managerContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { imagePath, socialHandle, websiteSchema, type WebsiteInput } from "./website";

// The business's website (public booking page): texts, links, theme, cover and logo.
// Owner and admin, like the other business settings; the database checks again.

function refresh(locale: string) {
  revalidatePath(`/${locale}/settings`, "layout");
  revalidatePath(`/${locale}/book`, "layout");
}

export async function saveWebsite(input: WebsiteInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const p = websiteSchema.safeParse(input);
  if (!p.success) return fail("invalidInput");
  const instagram = socialHandle(p.data.instagram, "instagram");
  if (instagram === undefined) return fail("invalidHandle", "instagram");
  const facebook = socialHandle(p.data.facebook, "facebook");
  if (facebook === undefined) return fail("invalidHandle", "facebook");
  const about = Object.fromEntries(Object.entries(p.data.about).filter(([, v]) => v));
  const { error } = await ctx.supabase
    .from("tenant_settings")
    .update({
      site_about: about,
      site_instagram: instagram,
      site_facebook: facebook,
      site_theme: p.data.theme,
    })
    .eq("tenant_id", ctx.tenant.tenantId);
  if (error) return fail("generic");
  refresh(ctx.locale);
  return ok(undefined);
}

// The browser uploads into the business's own folder (storage RLS); here we
// record the new path (or none) and delete the old file.
export async function setWebsiteImage(kind: "cover" | "logo", path: string | null): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || (kind !== "cover" && kind !== "logo")) return fail("notAllowed");
  if (path !== null && !imagePath(ctx.tenant.tenantId).safeParse(path).success) return fail("invalidInput");
  const column = kind === "cover" ? "site_cover_path" : "site_logo_path";
  const { data: before } = await ctx.supabase
    .from("tenant_settings")
    .select("site_cover_path, site_logo_path")
    .eq("tenant_id", ctx.tenant.tenantId)
    .single();
  const { error } = await ctx.supabase
    .from("tenant_settings")
    .update(kind === "cover" ? { site_cover_path: path } : { site_logo_path: path })
    .eq("tenant_id", ctx.tenant.tenantId);
  if (error) return fail("generic");
  const old = before?.[column];
  if (old && old !== path) await ctx.supabase.storage.from("business-photos").remove([old]);
  refresh(ctx.locale);
  return ok(undefined);
}
