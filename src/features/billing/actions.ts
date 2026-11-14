"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBillingProvider } from "@/integrations/payments";
import { dbErrorCode } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { getLocale } from "next-intl/server";

// Visito's own billing (decision 031): the owner pays the plan by card (monthly,
// automatic) or buys an SMS pack. The price comes from the database
// (billing_start), the payment page is Flitt's; only Flitt's signed notice or a
// server-side status check marks a payment as paid — never the browser.

async function ownerContext() {
  const locale = await getLocale();
  await requireUser(locale);
  const tenant = await getActiveTenant();
  if (!tenant || tenant.role !== "owner" || tenant.supportUntil) return null;
  return { locale, tenant, supabase: await createClient() };
}

export async function startPayment(
  kind: "plan", // SMS packs are not offered yet (Levan, 2026-11-12)
  code: string,
  agreed: boolean, // ticked "monthly automatic charge" (card provider requirement)
): Promise<ActionResult<{ url: string }>> {
  const ctx = await ownerContext();
  if (agreed !== true) return fail("consentNeeded");
  const p = z
    .object({ kind: z.literal("plan"), code: z.string().regex(/^[a-z0-9_-]{2,30}$/) })
    .safeParse({ kind, code });
  if (!ctx) return fail("notAllowed");
  if (!p.success) return fail("invalidInput");
  let provider: ReturnType<typeof getBillingProvider>;
  try {
    provider = getBillingProvider();
  } catch {
    provider = null;
  }
  if (!provider) return fail("paymentsOff");

  const { data, error } = await ctx.supabase.rpc("billing_start", {
    p_tenant: ctx.tenant.tenantId,
    p_kind: p.data.kind,
    p_code: p.data.code,
  });
  if (error || !data?.[0]) return fail(error ? dbErrorCode(error) : "generic");
  const row = data[0];
  // evidence of the agreement: who, when, which plan and amount
  await ctx.supabase.rpc("log_audit", {
    p_tenant: ctx.tenant.tenantId,
    p_action: "billing.recurring_consent",
    p_entity: "billing_payment",
    p_entity_id: row.id,
    p_meta: { plan: p.data.code, amount_minor: row.amount_minor },
  });
  const base = publicEnv.NEXT_PUBLIC_APP_URL;
  const r = await provider.createCheckout({
    orderId: row.id,
    amountMinor: row.amount_minor,
    description:
      p.data.kind === "plan"
        ? `Visito ${row.name} — ${ctx.tenant.name}`
        : `Visito SMS × ${row.segments} — ${ctx.tenant.name}`,
    returnUrl: `${base}/api/billing/return?order=${row.id}&locale=${ctx.locale}`,
    callbackUrl: `${base}/api/webhooks/flitt`,
    lang: ctx.locale as "ka" | "en" | "ru",
    monthly: p.data.kind === "plan",
  });
  if (!r.ok) {
    console.error("billing checkout failed", r.error);
    return fail("paymentUnavailable");
  }
  return ok({ url: r.url });
}

/** Stops the monthly charge; the plan stays until the paid period ends. */
export async function stopAutopay(): Promise<ActionResult> {
  const ctx = await ownerContext();
  if (!ctx) return fail("notAllowed");
  const provider = getBillingProvider();
  // the first approved plan payment of the subscription
  const { data: first } = await ctx.supabase
    .from("billing_payments")
    .select("id")
    .eq("tenant_id", ctx.tenant.tenantId)
    .eq("kind", "plan")
    .eq("status", "approved")
    .is("parent_id", null)
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (provider && first && !(await provider.stopSubscription(first.id))) return fail("paymentUnavailable");
  const { error } = await ctx.supabase.rpc("billing_autopay_off", { p_tenant: ctx.tenant.tenantId });
  if (error) return fail(dbErrorCode(error));
  revalidatePath(`/${ctx.locale}/settings/subscription`);
  return ok(undefined);
}
