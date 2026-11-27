import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Each business the person works in gets an "signed in" line in its audit log
// (test plan #61). Uses the client that just signed in, so its session is known.
// Never blocks the sign-in.
export async function auditSignIn(supabase: SupabaseClient, how: "password" | "email_link") {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: rows } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", auth.user.id)
      .eq("status", "active");
    for (const r of rows ?? [])
      await supabase.rpc("log_audit", {
        p_tenant: r.tenant_id,
        p_action: "auth.signed_in",
        p_entity: "user",
        p_meta: { how },
      });
  } catch {
    // the log line is nice to have; the sign-in itself already worked
  }
}
