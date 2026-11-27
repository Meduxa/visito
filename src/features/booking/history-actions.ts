"use server";

import { z } from "zod";
import { memberContext, refusal } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const uuid = z.uuid();

// Dental treatment notes: the database allows only the owner and doctors, and
// logs every read. Loaded only when someone presses "show", never in passing.
export async function readDentalNotes(
  clientId: string,
): Promise<ActionResult<{ id: string; author: string; body: string; at: string }[]>> {
  const ctx = await memberContext({ read: true });
  if (!ctx || !uuid.safeParse(clientId).success) return fail(await refusal());
  const { data, error } = await ctx.supabase.rpc("read_dental_notes", { p_client: clientId });
  if (error) return fail(error.code === "42501" ? "notAllowed" : "generic");
  return ok((data ?? []).map((n) => ({ id: n.id, author: n.author_name, body: n.body, at: n.created_at })));
}

export async function addDentalNote(
  clientId: string,
  bookingId: string | null,
  body: string,
): Promise<ActionResult> {
  const ctx = await memberContext();
  const text = body.trim();
  if (!ctx || !uuid.safeParse(clientId).success || !text || text.length > 4000) return fail("invalidInput");
  if (bookingId && !uuid.safeParse(bookingId).success) return fail("invalidInput");
  const { error } = await ctx.supabase.rpc("add_dental_note", {
    p_client: clientId,
    p_booking: bookingId as string,
    p_body: text,
  });
  if (error) return fail(error.code === "42501" ? "notAllowed" : "generic");
  return ok(undefined);
}
