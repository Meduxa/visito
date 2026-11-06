import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type LandingPlan = {
  code: string;
  name: string;
  priceMinor: number;
  maxStaff: number | null;
  smsPerMonth: number;
};

// Plans Levan edits at /admin/plans. Shown only once they have prices: until then
// the page shows the free trial and "prices coming soon".
export async function getLandingPlans(): Promise<LandingPlan[]> {
  const { data } = await createAdminClient()
    .from("plans")
    .select("code, name, price_minor, max_staff, sms_per_month")
    .eq("active", true)
    .neq("code", "trial")
    .order("sort_order");
  const plans = (data ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    priceMinor: p.price_minor,
    maxStaff: p.max_staff,
    smsPerMonth: p.sms_per_month,
  }));
  return plans.every((p) => p.priceMinor > 0) ? plans : [];
}

/** The demo salon's website, when this installation has one (dev and sales demos). */
export async function demoSalonExists(): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("tenants")
    .select("id")
    .eq("slug", "orchidea")
    .in("status", ["trial", "active", "past_due"])
    .maybeSingle();
  return !!data;
}
