"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorCode, managerContext, memberContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { addDays } from "@/lib/dates";
import { DEFAULT_TZ, zonedToUtcIso } from "@/lib/time";

// Time-off requests (decision 029). The database decides who may do what:
// a staff member asks only for their own profile; owner/admin decide.

const requestSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    reason: z.enum(["vacation", "sick", "other"]),
    note: z.string().trim().max(300),
  })
  .refine((v) => v.to >= v.from, { message: "endBeforeStart", path: ["to"] });
export type TimeOffRequestInput = z.input<typeof requestSchema>;

const refresh = (locale: string) => {
  revalidatePath(`/${locale}/my-day`);
  revalidatePath(`/${locale}/staff`);
};

/** Whole days: from the first day's start to the end of the last day, in the business's time zone. */
export async function requestTimeOff(input: TimeOffRequestInput): Promise<ActionResult> {
  const ctx = await memberContext();
  if (!ctx) return fail("notAllowed");
  const p = requestSchema.safeParse(input);
  if (!p.success)
    return fail(p.error.issues[0]?.message === "endBeforeStart" ? "endBeforeStart" : "invalidInput");
  const { data: tz } = await ctx.supabase
    .from("tenants")
    .select("timezone")
    .eq("id", ctx.tenant.tenantId)
    .single();
  const zone = tz?.timezone ?? DEFAULT_TZ;
  const { error } = await ctx.supabase.rpc("request_time_off", {
    p_tenant: ctx.tenant.tenantId,
    p_starts: zonedToUtcIso(p.data.from, "00:00", zone),
    p_ends: zonedToUtcIso(addDays(p.data.to, 1), "00:00", zone),
    p_reason: p.data.reason,
    p_note: p.data.note,
  });
  if (error) return fail(error.code === "P0006" ? "tooMany" : dbErrorCode(error));
  refresh(ctx.locale);
  return ok(undefined);
}

export async function decideTimeOff(id: string, approve: boolean, note = ""): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !z.uuid().safeParse(id).success) return fail("notAllowed");
  const { error } = await ctx.supabase.rpc("decide_time_off", {
    p_id: id,
    p_approve: approve,
    p_note: note.slice(0, 300),
  });
  if (error) return fail(error.code === "P0001" ? "alreadyDecided" : dbErrorCode(error));
  refresh(ctx.locale);
  revalidatePath(`/${ctx.locale}/calendar`);
  return ok(undefined);
}

export async function cancelTimeOffRequest(id: string): Promise<ActionResult> {
  const ctx = await memberContext();
  if (!ctx || !z.uuid().safeParse(id).success) return fail("notAllowed");
  const { error } = await ctx.supabase.rpc("cancel_time_off_request", { p_id: id });
  if (error) return fail(error.code === "P0001" ? "alreadyDecided" : dbErrorCode(error));
  refresh(ctx.locale);
  return ok(undefined);
}
