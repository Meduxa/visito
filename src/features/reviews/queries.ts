import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  status: "published" | "hidden";
  reply: string | null;
  createdAt: string;
  visitAt: string | null;
  client: string | null;
  staff: string | null;
  services: string;
};

/** Reviews the signed-in person may see (RLS: managers all, staff about their visits). */
export async function listReviews(tenantId: string) {
  const db = await createClient();
  const { data } = await db
    .from("reviews")
    .select(
      "id, rating, comment, status, reply, created_at, staff(display_name), clients(first_name, last_name), bookings(starts_at, booking_items(name_snapshot, sort_order))",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(300);
  const rows: ReviewRow[] = (data ?? []).map((r) => {
    const c = r.clients as unknown as { first_name: string; last_name: string | null } | null;
    const b = r.bookings as unknown as {
      starts_at: string;
      booking_items: { name_snapshot: string; sort_order: number }[];
    } | null;
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      status: r.status as ReviewRow["status"],
      reply: r.reply,
      createdAt: r.created_at,
      visitAt: b?.starts_at ?? null,
      client: c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : null,
      staff: (r.staff as unknown as { display_name: string } | null)?.display_name ?? null,
      services: (b?.booking_items ?? [])
        .sort((x, y) => x.sort_order - y.sort_order)
        .map((i) => i.name_snapshot)
        .join(", "),
    };
  });
  const published = rows.filter((r) => r.status === "published");
  const average = published.length ? published.reduce((a, r) => a + r.rating, 0) / published.length : null;
  const byStars = [5, 4, 3, 2, 1].map((s) => ({
    stars: s,
    count: rows.filter((r) => r.rating === s).length,
  }));
  return { rows, average, byStars };
}

export type PublicReviews = {
  count: number;
  average: number | null;
  items: { rating: number; comment: string; reply: string | null; createdAt: string; firstName: string }[];
};

/** For the public booking page; null when the business hides reviews. */
export async function publicReviews(tenantId: string): Promise<PublicReviews | null> {
  const { data } = await createAdminClient().rpc("public_reviews", { p_tenant: tenantId, p_limit: 6 });
  if (!data) return null;
  const d = data as { count: number; average: number | null; items: Record<string, unknown>[] };
  return {
    count: Number(d.count) || 0,
    average: d.average === null ? null : Number(d.average),
    items: d.items.map((i) => ({
      rating: Number(i.rating),
      comment: String(i.comment ?? ""),
      reply: (i.reply as string) ?? null,
      createdAt: String(i.created_at),
      firstName: String(i.first_name ?? ""),
    })),
  };
}
