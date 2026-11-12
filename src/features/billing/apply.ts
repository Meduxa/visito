import "server-only";
import type { PaymentEvent } from "@/integrations/payments";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Applies a VERIFIED payment event (Flitt's signed notice, or Flitt's own status
 * answer fetched by the server). The database grants the plan / SMS once, on
 * the first "approved" with the expected amount (billing_apply).
 */
export async function applyPaymentEvent(e: PaymentEvent): Promise<string | null> {
  const { data, error } = await createAdminClient().rpc("billing_apply", {
    p_order: e.orderId,
    p_status: e.status ?? "unknown",
    p_amount: e.amountMinor as number,
    p_payment_id: e.paymentId as string,
    p_card: e.maskedCard as string,
    p_parent: (e.parentOrderId ?? undefined) as string,
  });
  if (error) {
    console.error("billing apply failed", error.code);
    return null;
  }
  return data;
}
