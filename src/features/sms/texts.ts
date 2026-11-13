import "server-only";
import { getTranslations } from "next-intl/server";
import { SMS_SALON_TOOLS } from "@/lib/pilot";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEMPLATE_TYPES } from "./render";

// The text of an automatic SMS (decision 033): the business's own text (only
// when salons may edit texts) → the Visito team's text (/admin/sms-texts) →
// the built-in default from the language files.

export const PLATFORM_TEXT_TYPES = [...TEMPLATE_TYPES, "review"] as const;
export type PlatformTextType = (typeof PLATFORM_TEXT_TYPES)[number];

export async function smsText(tenantId: string, type: PlatformTextType, locale: string): Promise<string> {
  const db = createAdminClient();
  if (SMS_SALON_TOOLS && type !== "review") {
    const { data } = await db
      .from("sms_templates")
      .select("body")
      .eq("tenant_id", tenantId)
      .eq("type", type)
      .eq("locale", locale)
      .maybeSingle();
    if (data) return data.body;
  }
  const { data } = await db
    .from("sms_platform_templates")
    .select("body")
    .eq("type", type)
    .eq("locale", locale)
    .maybeSingle();
  if (data) return data.body;
  return builtInText(type, locale);
}

export async function builtInText(type: PlatformTextType, locale: string): Promise<string> {
  const t = await getTranslations({ locale, namespace: "smsTemplates" });
  return t.raw(type) as string;
}
