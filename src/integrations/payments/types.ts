// Payment adapter (integrations-adapter skill). Used today for Visito's own
// subscription and SMS packs (decision 031); per-salon payments (deposits,
// Phase 8) will use the same shape with the salon's own merchant account.

export type CheckoutInput = {
  orderId: string; // our payment id (UUID)
  amountMinor: number; // tetri
  description: string;
  returnUrl: string; // the payer's browser comes back here (not proof of payment)
  callbackUrl: string; // the provider's signed server-to-server notice
  lang?: "ka" | "en" | "ru";
  /** monthly automatic charge of the same amount */
  monthly?: boolean;
};

export type PaymentStatus = "created" | "processing" | "approved" | "declined" | "expired" | "reversed";

/** A verified notice or status answer from the provider. */
export type PaymentEvent = {
  orderId: string;
  status: PaymentStatus | null; // null = a status we don't know (kept, nothing granted)
  amountMinor: number | null;
  paymentId: string | null;
  maskedCard: string | null;
  /** for a monthly charge of a subscription: the first order's id */
  parentOrderId: string | null;
};

export interface PaymentProvider {
  name: string;
  createCheckout(input: CheckoutInput): Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  /** Asks the provider for the order's current state (the return page checks this). */
  getStatus(orderId: string): Promise<PaymentEvent | null>;
  stopSubscription(orderId: string): Promise<boolean>;
  /** Verifies the signature of a notice and reads it; null = not authentic or unreadable. */
  parseCallback(rawBody: string): PaymentEvent | null;
}
