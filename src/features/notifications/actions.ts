"use server";

import { z } from "zod";
import { dbErrorCode, memberContext } from "@/lib/action-context";

const items = z
  .array(z.object({ kind: z.enum(["online_booking", "needs_action"]), bookingId: z.uuid() }))
  .max(100)
  .nullable();

// Marks the given notifications (or, with null, all of them) read for the
// signed-in user. The database accepts only items from the user's own feed.
export async function markNotificationsRead(input: unknown) {
  const parsed = items.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalidInput" };
  const ctx = await memberContext({ read: true });
  if (!ctx) return { ok: false as const, error: "notAllowed" };
  const { error } = await ctx.supabase.rpc("mark_notifications_read", {
    p_tenant: ctx.tenant.tenantId,
    p_items: parsed.data ? parsed.data.map((i) => ({ kind: i.kind, booking_id: i.bookingId })) : undefined,
  });
  if (error) return { ok: false as const, error: dbErrorCode(error) };
  return { ok: true as const };
}
