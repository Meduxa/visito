import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { addDays } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TZ } from "@/lib/time";

export type TimeOffRequest = {
  id: string;
  staffName: string;
  from: string; // first day, business-local
  to: string; // last day
  reason: "vacation" | "sick" | "other";
  note: string | null;
  status: "pending" | "approved" | "declined" | "cancelled";
  decisionNote: string | null;
  createdAt: string;
  /** bookings in that period (pending requests, for managers) */
  conflicts: number;
};

/**
 * Requests the signed-in person may see (RLS: managers all, staff their own):
 * every pending one plus decisions of the last 60 days.
 */
export async function listTimeOffRequests(
  tenantId: string,
  opts: { manager: boolean },
): Promise<TimeOffRequest[]> {
  const db = await createClient();
  const [{ data: tz }, { data }] = await Promise.all([
    db.from("tenants").select("timezone").eq("id", tenantId).single(),
    db
      .from("time_off_requests")
      .select("id, starts_at, ends_at, reason, note, status, decision_note, created_at, staff(display_name)")
      .eq("tenant_id", tenantId)
      .or(`status.eq.pending,created_at.gte.${new Date(Date.now() - 60 * 86_400_000).toISOString()}`)
      .order("status", { ascending: false }) // pending first
      .order("starts_at")
      .limit(100),
  ]);
  const zone = tz?.timezone ?? DEFAULT_TZ;
  const rows = data ?? [];
  const conflicts = opts.manager
    ? await Promise.all(
        rows.map(async (r) =>
          r.status === "pending" ? ((await db.rpc("time_off_conflicts", { p_id: r.id })).data ?? 0) : 0,
        ),
      )
    : rows.map(() => 0);
  return rows.map((r, i) => {
    const end = formatInTimeZone(r.ends_at, zone, "yyyy-MM-dd'T'HH:mm");
    // a whole-day request ends at the next midnight: show the last day
    const to = end.endsWith("T00:00") ? addDays(end.slice(0, 10), -1) : end.slice(0, 10);
    return {
      id: r.id,
      staffName: (r.staff as unknown as { display_name: string } | null)?.display_name ?? "—",
      from: formatInTimeZone(r.starts_at, zone, "yyyy-MM-dd"),
      to,
      reason: r.reason as TimeOffRequest["reason"],
      note: r.note,
      status: r.status as TimeOffRequest["status"],
      decisionNote: r.decision_note,
      createdAt: r.created_at,
      conflicts: conflicts[i],
    };
  });
}
