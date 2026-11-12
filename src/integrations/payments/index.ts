import "server-only";
import { serverEnv } from "@/lib/server-env";
import { flittProvider } from "./providers/flitt";
import type { PaymentProvider } from "./types";

/** Visito's own payments (plans, SMS packs); null = card payment not set up (pay by transfer). */
export function getBillingProvider(): PaymentProvider | null {
  const env = serverEnv();
  if (env.PAYMENTS_PROVIDER !== "flitt") return null;
  if (!env.FLITT_MERCHANT_ID || !env.FLITT_SECRET_KEY)
    throw new Error("FLITT_MERCHANT_ID and FLITT_SECRET_KEY are required");
  return flittProvider({ merchantId: env.FLITT_MERCHANT_ID, secretKey: env.FLITT_SECRET_KEY });
}

export type { PaymentEvent, PaymentProvider } from "./types";
