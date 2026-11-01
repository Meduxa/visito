import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  EMAIL_PROVIDER: z.enum(["fake", "resend"]).default("fake"),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(), // e.g. "Bookeria <no-reply@bookeria.ge>" — a domain verified in Resend
  SMS_PROVIDER: z.enum(["fake", "senderge"]).default("fake"),
  SMS_API_KEY: z.string().optional(),
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
  });
  return cached;
}
