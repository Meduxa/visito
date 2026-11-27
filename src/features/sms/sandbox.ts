import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Demo and test businesses never send a real SMS (decision 038, Levan 2026-11-25).
// They live in the same database as real salons: the demo salons on visito.ge and
// the businesses the automatic tests create. Their clients have made-up numbers,
// which may belong to real people. Such a business is recognised by its owners:
// every owner signs in with a reserved test address (…@demo.test, …@example.test).
// A business with no owner left is treated the same way.

/** True for the reserved test domains (RFC 2606 ".test", plus example.*). */
export function isTestEmail(email: string | null | undefined): boolean {
  const domain = (email ?? "").trim().toLowerCase().split("@")[1] ?? "";
  return /(^|\.)test$/.test(domain) || /^example\.(com|org|net)$/.test(domain);
}

const cache = new Map<string, { sandbox: boolean; until: number }>();

export async function isSandboxTenant(tenantId: string): Promise<boolean> {
  const hit = cache.get(tenantId);
  if (hit && hit.until > Date.now()) return hit.sandbox;
  const db = createAdminClient();
  const { data: owners } = await db
    .from("memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner");
  let sandbox = true;
  if (owners?.length) {
    const emails = await Promise.all(
      owners.map(async (o) => (await db.auth.admin.getUserById(o.user_id)).data.user?.email ?? null),
    );
    sandbox = emails.every(isTestEmail);
  }
  cache.set(tenantId, { sandbox, until: Date.now() + 10 * 60_000 });
  return sandbox;
}
