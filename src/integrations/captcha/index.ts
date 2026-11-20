import "server-only";
import { serverEnv } from "@/lib/server-env";
import { verifyTurnstile } from "./turnstile";

// "Is this a person?" before Visito spends money or sends mail for an anonymous
// visitor: SMS codes, online bookings without a code, sign-up and password emails
// (decision 036). Off until TURNSTILE_SECRET_KEY is set.
//
// A wrong or missing token is refused. If Cloudflare itself cannot be reached, we
// let the request through (and log it): the rate limits still apply, and real
// clients are not locked out of booking by someone else's outage.
export async function isHuman(token: string | null | undefined, ip: string | null): Promise<boolean> {
  const secret = serverEnv().TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  const r = await verifyTurnstile({ secret, token, ip });
  if (!r.ok && r.reason === "unavailable") {
    console.error("turnstile unavailable — request allowed, rate limits apply");
    return true;
  }
  return r.ok;
}
