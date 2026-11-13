"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { PLATFORM_TEXT_TYPES } from "@/features/sms/texts";
import { unknownVariables } from "@/features/sms/render";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Visito's SMS texts for every business (decision 033). Platform admins only;
// the table's policies check is_platform_admin() again.

async function platform() {
  const locale = await getLocale();
  const user = await requireUser(locale);
  const db = await createClient();
  const { data } = await db.rpc("is_platform_admin");
  return data === true ? { db, locale, userId: user.id } : null;
}

const keySchema = z.object({
  type: z.enum(PLATFORM_TEXT_TYPES),
  locale: z.enum(["ka", "en", "ru"]),
});
const textSchema = keySchema.extend({ body: z.string().trim().min(1).max(600) });

export async function savePlatformText(input: z.input<typeof textSchema>): Promise<ActionResult> {
  const ctx = await platform();
  const p = textSchema.safeParse(input);
  if (!ctx) return fail("notAllowed");
  if (!p.success) return fail("invalidInput", "body");
  if (unknownVariables(p.data.body).length) return fail("templateVariable", "body");
  const { error } = await ctx.db
    .from("sms_platform_templates")
    .upsert({ ...p.data, updated_at: new Date().toISOString(), updated_by: ctx.userId });
  if (error) return fail("generic");
  revalidatePath(`/${ctx.locale}/admin/sms-texts`);
  return ok(undefined);
}

export async function resetPlatformText(input: z.input<typeof keySchema>): Promise<ActionResult> {
  const ctx = await platform();
  const p = keySchema.safeParse(input);
  if (!ctx || !p.success) return fail("notAllowed");
  const { error } = await ctx.db
    .from("sms_platform_templates")
    .delete()
    .eq("type", p.data.type)
    .eq("locale", p.data.locale);
  if (error) return fail("generic");
  revalidatePath(`/${ctx.locale}/admin/sms-texts`);
  return ok(undefined);
}
