"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { parseMoneyToMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { SUPPORT_COOKIE } from "@/lib/tenant";

// Platform admin (Levan) only. The database checks is_platform_admin() again
// in every function and policy; this check just gives a clean error.
async function platform() {
  const locale = await getLocale();
  await requireUser(locale);
  const db = await createClient();
  const { data } = await db.rpc("is_platform_admin");
  return data === true ? { db, locale } : null;
}

const STATUSES = ["trial", "active", "past_due", "suspended", "cancelled"] as const;

export async function updateTenant(input: {
  tenantId: string;
  plan: string;
  status: string;
  trialEndsAt: string;
}): Promise<ActionResult> {
  const ctx = await platform();
  const p = z
    .object({
      tenantId: z.uuid(),
      plan: z.string().min(2).max(30),
      status: z.enum(STATUSES),
      trialEndsAt: z.iso.date(),
    })
    .safeParse(input);
  if (!ctx || !p.success) return fail(ctx ? "invalidInput" : "notAllowed");
  const { error } = await ctx.db.rpc("admin_update_tenant", {
    p_tenant: p.data.tenantId,
    p_plan: p.data.plan,
    p_status: p.data.status,
    p_trial_ends_at: `${p.data.trialEndsAt}T23:59:59+04:00`,
  });
  if (error) return fail(error.code === "23503" ? "invalidInput" : "generic");
  revalidatePath(`/${ctx.locale}/admin`, "layout");
  return ok(undefined);
}

export async function topUpSms(input: {
  tenantId: string;
  segments: number;
  note: string;
}): Promise<ActionResult> {
  const ctx = await platform();
  const p = z
    .object({
      tenantId: z.uuid(),
      segments: z
        .number()
        .int()
        .min(-100000)
        .max(100000)
        .refine((n) => n !== 0),
      note: z.string().trim().max(200),
    })
    .safeParse(input);
  if (!ctx || !p.success) return fail(ctx ? "invalidInput" : "notAllowed");
  const { error } = await ctx.db.rpc("admin_topup_sms", {
    p_tenant: p.data.tenantId,
    p_segments: p.data.segments,
    p_note: p.data.note,
  });
  if (error) return fail("generic");
  revalidatePath(`/${ctx.locale}/admin`, "layout");
  return ok(undefined);
}

const planSchema = z.object({
  code: z.string().regex(/^[a-z0-9_-]{2,30}$/),
  name: z.string().trim().min(1).max(60),
  price: z.string().trim(),
  maxStaff: z.union([z.literal(""), z.coerce.number<string>().int().min(1).max(1000)]),
  smsPerMonth: z.coerce.number<string>().int().min(0).max(100000),
  active: z.boolean(),
  features: z.array(z.enum(["payroll"])).max(5),
});

export async function savePlan(input: z.input<typeof planSchema>): Promise<ActionResult> {
  const ctx = await platform();
  const p = planSchema.safeParse(input);
  if (!ctx || !p.success) return fail(ctx ? "invalidInput" : "notAllowed");
  const price = p.data.price === "" ? 0 : parseMoneyToMinor(p.data.price);
  if (price === null) return fail("priceInvalid", "price");
  const { error } = await ctx.db.from("plans").upsert({
    code: p.data.code,
    name: p.data.name,
    price_minor: price,
    max_staff: p.data.maxStaff === "" ? null : p.data.maxStaff,
    sms_per_month: p.data.smsPerMonth,
    active: p.data.active,
    features: [...new Set(p.data.features)],
    updated_at: new Date().toISOString(),
  });
  if (error) return fail("generic");
  revalidatePath(`/${ctx.locale}/admin`, "layout");
  return ok(undefined);
}

// Opens a business in support view (owner's consent required, logged by the database).
export async function openSupportView(tenantId: string): Promise<ActionResult> {
  const ctx = await platform();
  if (!ctx || !z.uuid().safeParse(tenantId).success) return fail("notAllowed");
  const { error } = await ctx.db.rpc("start_support_view", { p_tenant: tenantId });
  if (error) return fail("noSupportAccess");
  (await cookies()).set(SUPPORT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 72,
  });
  redirect(`/${ctx.locale}/dashboard`);
}

export async function leaveSupportView() {
  const locale = await getLocale();
  (await cookies()).delete(SUPPORT_COOKIE);
  redirect(`/${locale}/admin`);
}
