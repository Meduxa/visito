import "server-only";
import { createClient } from "@/lib/supabase/server";
import { asInviteRole, asRole, type Role } from "@/lib/tenant";

export type TeamMember = {
  id: string;
  userId: string;
  fullName: string;
  role: Role;
  status: string;
  /** the specialist profile this login is linked to, if any */
  staffName: string | null;
};
export type PendingInvite = { id: string; email: string; role: "admin" | "staff"; expiresAt: string };

// tenantId comes from getActiveTenant() (server-resolved), and RLS limits rows anyway.
export async function getTeam(tenantId: string) {
  const supabase = await createClient();
  const [members, invites] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, user_id, role, status, created_at, staff_id")
      .eq("tenant_id", tenantId)
      .order("created_at"),
    supabase
      .from("invitations")
      .select("id, email, role, expires_at")
      .eq("tenant_id", tenantId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);
  if (members.error || invites.error) throw new Error("Could not load team");

  const userIds = members.data.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const staffIds = members.data.map((m) => m.staff_id).filter((x): x is string => !!x);
  const { data: staffRows } = staffIds.length
    ? await supabase.from("staff").select("id, display_name").in("id", staffIds)
    : { data: [] };
  const staffNames = new Map((staffRows ?? []).map((s) => [s.id, s.display_name]));

  return {
    members: members.data.map((m): TeamMember => ({
      id: m.id,
      userId: m.user_id,
      fullName: names.get(m.user_id) ?? "",
      role: asRole(m.role),
      status: m.status,
      staffName: (m.staff_id && staffNames.get(m.staff_id)) || null,
    })),
    invites: invites.data.map((i): PendingInvite => ({
      id: i.id,
      email: i.email,
      role: asInviteRole(i.role),
      expiresAt: i.expires_at,
    })),
  };
}
