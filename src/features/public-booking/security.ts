import "server-only";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/server-env";

// Codes, passes and manage-link keys are stored only as an HMAC whose key never
// leaves the server, so a copy of the database reveals none of them.
export const hmac = (value: string) =>
  createHmac("sha256", serverEnv().SUPABASE_SECRET_KEY).update(`visito:${value}`).digest("hex");

export const newToken = () => randomBytes(24).toString("base64url"); // 32 characters
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

// The visitor's IP as set by the hosting proxy. On this computer (dev server,
// tests) it is the loopback address, which never limits anything; per-phone
// limits still apply everywhere.
const LOOPBACK = /^(127\.|::1$|::ffff:127\.)/;
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return ip && !LOOPBACK.test(ip) ? ip : null;
}

export const LIMITS = {
  slotsPerIp: [120, 600], // searches per 10 minutes
  codePerPhone: [3, 3600],
  codePerIp: [10, 3600], // salons and cafés share one network
  bookPerPhone: [5, 3600],
  bookPerIp: [20, 3600],
  managePerToken: [30, 3600],
} as const satisfies Record<string, readonly [number, number]>;

// true = allowed. Keys are hashed, so no phone numbers or IPs are stored in clear.
export async function allow(kind: keyof typeof LIMITS, subject: string | null): Promise<boolean> {
  if (subject === null) return true;
  const [limit, windowSec] = LIMITS[kind];
  const { data, error } = await createAdminClient().rpc("rate_hit", {
    p_key: `${kind}:${hmac(subject).slice(0, 32)}`,
    p_limit: limit,
    p_window_sec: windowSec,
  });
  return !error && data === true;
}
