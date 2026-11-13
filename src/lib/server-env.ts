import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  EMAIL_PROVIDER: z.enum(["fake", "resend"]).default("fake"),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(), // e.g. "Visito <no-reply@visito.ge>" — a domain verified in Resend
  SMS_PROVIDER: z.enum(["fake", "tnet", "senderge"]).default("fake"),
  SMS_API_KEY: z.string().optional(), // sender.ge only
  // TNET (decision 027): all supplied by TNET at onboarding
  TNET_BASE_URL: z.url().optional(),
  TNET_CLIENT_ID: z.string().optional(),
  TNET_SECRET_HASH: z.string().optional(),
  TNET_SENDER: z.string().optional(), // default sender title, exact spelling and case
  TNET_WEBHOOK_SECRET: z.string().optional(), // delivery-report signing secret (not the login secret)
  // Visito's own card payments (decision 031): Flitt merchant of Visito
  PAYMENTS_PROVIDER: z.enum(["none", "flitt"]).default("none"),
  FLITT_MERCHANT_ID: z
    .string()
    .regex(/^\d{1,12}$/)
    .optional(),
  FLITT_SECRET_KEY: z.string().optional(),
});

let cached: z.infer<typeof serverSchema> | undefined;

// Read lazily so a missing secret fails the request that needs it, not the build.
export function serverEnv() {
  cached ??= serverSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || undefined,
    EMAIL_API_KEY: process.env.EMAIL_API_KEY || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
    SMS_PROVIDER: process.env.SMS_PROVIDER || undefined,
    SMS_API_KEY: process.env.SMS_API_KEY || undefined,
    TNET_BASE_URL: process.env.TNET_BASE_URL || undefined,
    TNET_CLIENT_ID: process.env.TNET_CLIENT_ID || undefined,
    TNET_SECRET_HASH: process.env.TNET_SECRET_HASH || undefined,
    TNET_SENDER: process.env.TNET_SENDER || undefined,
    TNET_WEBHOOK_SECRET: process.env.TNET_WEBHOOK_SECRET || undefined,
    PAYMENTS_PROVIDER: process.env.PAYMENTS_PROVIDER || undefined,
    FLITT_MERCHANT_ID: process.env.FLITT_MERCHANT_ID || undefined,
    FLITT_SECRET_KEY: process.env.FLITT_SECRET_KEY || undefined,
  });
  return cached;
}
