import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Branches of a business (decision 032).

export type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  slug: string | null;
  isPrimary: boolean;
  active: boolean;
};

export type BranchInfo = {
  all: Branch[]; // every branch, main first
  usable: Branch[]; // active and within the plan's limit: what the calendar and booking page offer
  max: number | null; // the plan's limit (null = no limit)
};

type Db = SupabaseClient<Database>;

export const sortBranches = <T extends { isPrimary: boolean; sortOrder: number; name: string }>(list: T[]) =>
  [...list].sort(
    (a, b) =>
      Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );

/** Active branches beyond the plan's limit (after a downgrade) are kept but not offered. */
export function usableBranches<T extends { active: boolean }>(sorted: T[], max: number | null): T[] {
  const active = sorted.filter((b) => b.active);
  return max === null ? active : active.slice(0, max);
}

export async function getBranchInfo(db: Db, tenantId: string): Promise<BranchInfo> {
  const [{ data: rows }, { data: tenant }] = await Promise.all([
    db
      .from("locations")
      .select("id, name, address, phone, slug, is_primary, active, sort_order")
      .eq("tenant_id", tenantId),
    db.from("tenants").select("plans(max_locations)").eq("id", tenantId).single(),
  ]);
  const max = (tenant?.plans as { max_locations: number | null } | null)?.max_locations ?? null;
  const all = sortBranches(
    (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      phone: r.phone,
      slug: r.slug,
      isPrimary: r.is_primary,
      active: r.active,
      sortOrder: r.sort_order,
    })),
  ).map((b): Branch => ({
    id: b.id,
    name: b.name,
    address: b.address,
    phone: b.phone,
    slug: b.slug,
    isPrimary: b.isPrimary,
    active: b.active,
  }));
  return { all, usable: usableBranches(all, max), max };
}

/** The branch asked for (by id) if usable, else the main one. */
export function pickBranch(info: BranchInfo, id: string | null | undefined): Branch | undefined {
  return info.usable.find((b) => b.id === id) ?? info.usable[0];
}
