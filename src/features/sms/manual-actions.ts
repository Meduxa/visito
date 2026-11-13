"use server";

import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { managerContext } from "@/lib/action-context";
import { SMS_SALON_TOOLS } from "@/lib/pilot";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTime } from "./render";
import { countSegments } from "./segments";
import { processQueue, queueSms, sendNow } from "./send";
import { readUnsubscribeKey, unsubscribeLink } from "./unsubscribe";

// Messages the team writes themselves. A note to one client ("running late")
// is a service message; a promotion needs SMS consent and gets an unsubscribe link.

const text = z.string().trim().min(1).max(600);

async function optOut(clientId: string, locale: string) {
  const t = await getTranslations({ locale, namespace: "smsTemplates" });
  return `\n${t("optOut", { link: unsubscribeLink(clientId) })}`;
}

export async function sendClientSms(input: {
  clientId: string;
  text: string;
  marketing: boolean;
}): Promise<ActionResult> {
  if (!SMS_SALON_TOOLS) return fail("notAllowed"); // pilot, decision 033
  const ctx = await managerContext();
  const p = z.object({ clientId: z.uuid(), text, marketing: z.boolean() }).safeParse(input);
  if (!ctx || !p.success) return fail("invalidInput", "text");
  const { data: c } = await ctx.supabase
    .from("clients")
    .select("id, phone_e164, anonymized_at")
    .eq("id", p.data.clientId)
    .eq("tenant_id", ctx.tenant.tenantId)
    .single();
  if (!c?.phone_e164 || c.anonymized_at) return fail("noPhone");
  const body = p.data.marketing ? p.data.text + (await optOut(c.id, ctx.locale)) : p.data.text;
  const sent = await sendNow({
    tenantId: ctx.tenant.tenantId,
    to: c.phone_e164,
    text: body,
    kind: p.data.marketing ? "marketing" : "service",
    type: p.data.marketing ? "marketing" : "manual",
    key: `manual:${randomBytes(8).toString("hex")}`,
    clientId: c.id,
  });
  // a promotion to someone without consent is logged as skipped, not sent
  return sent ? ok(undefined) : fail(p.data.marketing ? "noConsentOrSms" : "smsFailed");
}

const bulkSchema = z.object({ tag: z.string().trim().max(50).optional() });

// Clients who said yes to promotional SMS (latest answer), with a phone.
async function recipients(ctx: NonNullable<Awaited<ReturnType<typeof managerContext>>>, tag?: string) {
  const { data: yes } = await ctx.supabase
    .from("client_consent_state")
    .select("client_id")
    .eq("tenant_id", ctx.tenant.tenantId)
    .eq("channel", "sms")
    .eq("granted", true);
  const ids = (yes ?? []).map((r) => r.client_id!);
  if (!ids.length) return [];
  let q = ctx.supabase
    .from("clients")
    .select("id, phone_e164")
    .eq("tenant_id", ctx.tenant.tenantId)
    .is("anonymized_at", null)
    .not("phone_e164", "is", null)
    .in("id", ids);
  if (tag) q = q.contains("tags", [tag]);
  const { data } = await q;
  return (data ?? []) as { id: string; phone_e164: string }[];
}

export async function bulkSmsPreview(input: {
  tag?: string;
}): Promise<ActionResult<{ count: number; balance: number }>> {
  if (!SMS_SALON_TOOLS) return fail("notAllowed"); // pilot, decision 033
  const ctx = await managerContext({ read: true });
  const p = bulkSchema.safeParse(input);
  if (!ctx || !p.success) return fail("invalidInput");
  const [list, { data: balance }] = await Promise.all([
    recipients(ctx, p.data.tag || undefined),
    ctx.supabase.rpc("sms_balance", { p_tenant: ctx.tenant.tenantId }),
  ]);
  return ok({ count: list.length, balance: (balance as number) ?? 0 });
}

export async function sendBulkSms(input: {
  text: string;
  tag?: string;
}): Promise<ActionResult<{ queued: number }>> {
  if (!SMS_SALON_TOOLS) return fail("notAllowed"); // pilot, decision 033
  const ctx = await managerContext();
  const p = bulkSchema.extend({ text }).safeParse(input);
  if (!ctx || !p.success) return fail("invalidInput", "text");
  const list = await recipients(ctx, p.data.tag || undefined);
  if (!list.length) return fail("noRecipients");

  // check the credits up front: a half-sent campaign helps nobody
  const sample = p.data.text + (await optOut(list[0].id, ctx.locale));
  const need = countSegments(sample).segments * list.length;
  const { data: balance } = await ctx.supabase.rpc("sms_balance", { p_tenant: ctx.tenant.tenantId });
  if (((balance as number) ?? 0) < need) return fail("notEnoughSms");

  const { data: s } = await createAdminClient()
    .from("tenant_settings")
    .select("quiet_start, quiet_end")
    .eq("tenant_id", ctx.tenant.tenantId)
    .single();
  const { data: tenant } = await ctx.supabase
    .from("tenants")
    .select("timezone")
    .eq("id", ctx.tenant.tenantId)
    .single();
  const when =
    sendTime(
      new Date(),
      tenant?.timezone ?? "Asia/Tbilisi",
      { start: s?.quiet_start ?? "22:00", end: s?.quiet_end ?? "09:00" },
      new Date(Date.now() + 86_400_000),
    ) ?? new Date();

  const campaign = randomBytes(6).toString("hex");
  let queued = 0;
  for (const c of list) {
    const id = await queueSms({
      tenantId: ctx.tenant.tenantId,
      to: c.phone_e164,
      text: p.data.text + (await optOut(c.id, ctx.locale)),
      kind: "marketing",
      type: "marketing",
      key: `bulk:${campaign}:${c.id}`,
      clientId: c.id,
      sendAfter: when,
    });
    if (id) queued++;
  }
  after(() => processQueue(200)); // start sending now instead of waiting for the next minute
  return ok({ queued });
}

// The unsubscribe page's button (a click, so link scanners cannot unsubscribe people).
export async function unsubscribe(key: string): Promise<ActionResult> {
  const clientId = readUnsubscribeKey(key);
  if (!clientId) return fail("notFound");
  const { error } = await createAdminClient().rpc("sms_unsubscribe", { p_client: clientId });
  return error ? fail("generic") : ok(undefined);
}
