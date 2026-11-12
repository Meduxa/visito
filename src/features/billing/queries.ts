import "server-only";
import { getBillingProvider } from "@/integrations/payments";
import { createClient } from "@/lib/supabase/server";

export type BillingPage = {
  plan: { code: string; name: string; priceMinor: number } | null;
  status: string;
  trialEndsAt: string;
  paidUntil: string | null;
  autopay: boolean;
  smsBalance: number;
  cardPayments: boolean; // Flitt connected
  plans: {
    code: string;
    name: string;
    priceMinor: number;
    maxStaff: number | null;
    smsPerMonth: number;
    payroll: boolean;
  }[];
  payments: {
    id: string;
    kind: "plan" | "sms_pack";
    name: string;
    amountMinor: number;
    status: string;
    createdAt: string;
    paidAt: string | null;
    card: string | null;
  }[];
};

/** Everything the owner's Subscription page shows (RLS: payments for the owner only). */
export async function loadBilling(tenantId: string): Promise<BillingPage> {
  const db = await createClient();
  const [tenant, plans, payments, balance] = await Promise.all([
    db.from("tenants").select("plan, status, trial_ends_at, paid_until, autopay").eq("id", tenantId).single(),
    db
      .from("plans")
      .select("code, name, price_minor, max_staff, sms_per_month, features, active")
      .order("sort_order"),
    db
      .from("billing_payments")
      .select(
        "id, kind, plan_code, pack_code, segments, amount_minor, status, created_at, paid_at, masked_card",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
    db.rpc("sms_balance", { p_tenant: tenantId }, { get: true }),
  ]);
  let cardPayments = false;
  try {
    cardPayments = !!getBillingProvider();
  } catch {
    cardPayments = false;
  }
  const allPlans = plans.data ?? [];
  const current = allPlans.find((p) => p.code === tenant.data?.plan);
  const planName = new Map(allPlans.map((p) => [p.code, p.name]));
  return {
    plan: current ? { code: current.code, name: current.name, priceMinor: current.price_minor } : null,
    status: tenant.data?.status ?? "trial",
    trialEndsAt: tenant.data?.trial_ends_at ?? new Date().toISOString(),
    paidUntil: tenant.data?.paid_until ?? null,
    autopay: !!tenant.data?.autopay,
    smsBalance: (balance.data as number) ?? 0,
    cardPayments,
    plans: allPlans
      .filter((p) => p.active && p.code !== "trial" && p.price_minor > 0)
      .map((p) => ({
        code: p.code,
        name: p.name,
        priceMinor: p.price_minor,
        maxStaff: p.max_staff,
        smsPerMonth: p.sms_per_month,
        payroll: p.features.includes("payroll"),
      })),
    // only what was really started; "created" ones the owner left on the card page are noise
    payments: (payments.data ?? [])
      .filter((p) => p.status !== "created")
      .map((p) => ({
        id: p.id,
        kind: p.kind as "plan" | "sms_pack",
        name:
          p.kind === "plan" ? (planName.get(p.plan_code ?? "") ?? p.plan_code ?? "") : `SMS × ${p.segments}`,
        amountMinor: p.amount_minor,
        status: p.status,
        createdAt: p.created_at,
        paidAt: p.paid_at,
        card: p.masked_card,
      })),
  };
}

/** The status of one payment (the page after returning from the card page). */
export async function paymentStatus(tenantId: string, id: string) {
  const { data } = await (
    await createClient()
  )
    .from("billing_payments")
    .select("status, kind")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return data;
}
