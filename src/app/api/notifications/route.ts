import { loadNotifications } from "@/features/notifications/queries";

// The bell polls this (decision 019). Sign-in and the active business are
// checked in the loader; the database decides who sees which notification.
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await loadNotifications();
  if (!data) return new Response(null, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
