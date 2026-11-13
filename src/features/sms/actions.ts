"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { managerContext } from "@/lib/action-context";
import { SMS_SALON_TOOLS } from "@/lib/pilot";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { normalizePhone } from "@/lib/phone";
import { TEMPLATE_TYPES, unknownVariables } from "./render";
import { sendNow } from "./send";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const settingsSchema = z.object({
  senderName: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,10}$/, "senderInvalid"),
  ]),
  reminder24h: z.boolean(),
  reminder2h: z.boolean(),
  quietStart: time,
  quietEnd: time,
  onConfirm: z.boolean(),
  onReschedule: z.boolean(),
  onCancel: z.boolean(),
  reviewAsk: z.boolean().optional(),
});

export async function saveSmsSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  const ctx = await managerContext();
  const p = settingsSchema.safeParse(input);
  if (!ctx) return fail("notAllowed");
  if (!p.success)
    return fail(
      p.error.issues[0]?.message === "senderInvalid" ? "senderInvalid" : "invalidInput",
      "senderName",
    );
  const v = p.data;
  const { error } = await ctx.supabase
    .from("tenant_settings")
    .update({
      // a new name goes to "pending" in the database; not settable during the pilot (decision 033)
      ...(SMS_SALON_TOOLS ? { sms_sender_name: v.senderName || null } : {}),
      reminder_24h: v.reminder24h,
      reminder_2h: v.reminder2h,
      quiet_start: v.quietStart,
      quiet_end: v.quietEnd,
      sms_on_confirm: v.onConfirm,
      sms_on_reschedule: v.onReschedule,
      sms_on_cancel: v.onCancel,
      ...(v.reviewAsk === undefined ? {} : { reviews_ask: v.reviewAsk }),
    })
    .eq("tenant_id", ctx.tenant.tenantId);
  if (error) return fail("generic");
  revalidatePath(`/${ctx.locale}/settings/sms`);
  revalidatePath(`/${ctx.locale}/settings/reviews`);
  return ok(undefined);
}

const templateSchema = z.object({
  type: z.enum(TEMPLATE_TYPES),
  locale: z.enum(["ka", "en", "ru"]),
  body: z.string().trim().min(1).max(600),
});

export async function saveTemplate(input: z.input<typeof templateSchema>): Promise<ActionResult> {
  const ctx = await managerContext();
  const p = templateSchema.safeParse(input);
  if (!SMS_SALON_TOOLS) return fail("notAllowed");
  if (!ctx || !p.success) return fail("invalidInput", "body");
  if (unknownVariables(p.data.body).length) return fail("templateVariable", "body");
  const { error } = await ctx.supabase
    .from("sms_templates")
    .upsert(
      { tenant_id: ctx.tenant.tenantId, ...p.data, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id,type,locale" },
    );
  if (error) return fail("generic");
  revalidatePath(`/${ctx.locale}/settings/sms`);
  return ok(undefined);
}

export async function resetTemplate(input: { type: string; locale: string }): Promise<ActionResult> {
  const ctx = await managerContext();
  const p = templateSchema.pick({ type: true, locale: true }).safeParse(input);
  if (!SMS_SALON_TOOLS) return fail("notAllowed");
  if (!ctx || !p.success) return fail("invalidInput");
  await ctx.supabase
    .from("sms_templates")
    .delete()
    .eq("tenant_id", ctx.tenant.tenantId)
    .eq("type", p.data.type)
    .eq("locale", p.data.locale);
  revalidatePath(`/${ctx.locale}/settings/sms`);
  return ok(undefined);
}

// "Send a test SMS to my phone": uses one real credit, shows up in the log.
export async function sendTestSms(phone: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !SMS_SALON_TOOLS) return fail("notAllowed");
  const to = normalizePhone(phone ?? "");
  if (!to) return fail("phoneInvalid", "phone");
  const t = await getTranslations("smsSettings");
  const sent = await sendNow({
    tenantId: ctx.tenant.tenantId,
    to,
    text: t("testText", { business: ctx.tenant.name }),
    kind: "service",
    type: "manual",
    key: `test:${randomBytes(8).toString("hex")}`,
  });
  revalidatePath(`/${ctx.locale}/settings/sms`);
  return sent ? ok(undefined) : fail("smsFailed");
}
