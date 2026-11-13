"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { weekSchema, type WeekInput } from "@/features/staff/schema";
import { dbErrorCode, managerContext, type ManagerContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { branchSchema, branchServicesSchema, type BranchInput, type BranchServicesInput } from "./schema";

// Settings → Branches (decision 032). Owner and admins; RLS agrees. The plan's
// limit is enforced by the database (P0006 → "branchLimit").

const uuid = z.uuid();

const done = (ctx: ManagerContext) => {
  revalidatePath(`/${ctx.locale}/settings`, "layout");
  revalidatePath(`/${ctx.locale}/calendar`);
};

const branchError = (error: { code?: string; message?: string }) =>
  error.code === "P0006" ? "branchLimit" : error.code === "23505" ? "slugTaken" : dbErrorCode(error);

async function audit(ctx: ManagerContext, action: string, id: string) {
  await ctx.supabase.rpc("log_audit", {
    p_tenant: ctx.tenant.tenantId,
    p_action: action,
    p_entity: "location",
    p_entity_id: id,
  });
}

export async function saveBranch(
  id: string | null,
  input: BranchInput,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await managerContext();
  if (!ctx || (id && !uuid.safeParse(id).success)) return fail("notAllowed");
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.message ?? "invalidInput", issue?.path[0]?.toString());
  }
  const v = parsed.data;
  const { supabase, tenant } = ctx;

  if (id) {
    const { error } = await supabase
      .from("locations")
      .update({
        name: v.name,
        address: v.address || null,
        phone: v.phone,
        ...(v.slug ? { slug: v.slug } : {}),
      })
      .eq("id", id)
      .eq("tenant_id", tenant.tenantId);
    if (error) return fail(branchError(error), error.code === "23505" ? "slug" : undefined);
    await audit(ctx, "location.updated", id);
    done(ctx);
    return ok({ id });
  }

  const { data: existing } = await supabase
    .from("locations")
    .select("slug, sort_order")
    .eq("tenant_id", tenant.tenantId);
  const taken = new Set((existing ?? []).map((l) => l.slug));
  let slug = v.slug;
  for (let n = (existing?.length ?? 0) + 1; !slug || taken.has(slug); n++) slug = `branch-${n}`;
  const { data, error } = await supabase
    .from("locations")
    .insert({
      tenant_id: tenant.tenantId,
      name: v.name,
      address: v.address || null,
      phone: v.phone,
      slug,
      sort_order: Math.max(0, ...(existing ?? []).map((l) => l.sort_order)) + 1,
    })
    .select("id")
    .single();
  if (error) return fail(branchError(error), error.code === "23505" ? "slug" : undefined);
  // a new branch starts with the main branch's opening hours (changed on its page)
  const { data: hours } = await supabase
    .from("location_hours")
    .select("weekday, start_time, end_time, locations!inner(is_primary)")
    .eq("tenant_id", tenant.tenantId)
    .eq("locations.is_primary", true);
  if (hours?.length)
    await supabase.rpc("set_location_hours", {
      p_location: data.id,
      p_rows: hours.map((h) => ({ weekday: h.weekday, start_time: h.start_time, end_time: h.end_time })),
    });
  await audit(ctx, "location.created", data.id);
  done(ctx);
  return ok({ id: data.id });
}

// Switch a branch off (keeps its history) or on again (counts against the plan).
export async function setBranchActive(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(id).success) return fail("notAllowed");
  const { error } = await ctx.supabase
    .from("locations")
    .update({ active })
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.tenantId)
    .eq("is_primary", false);
  if (error) return fail(branchError(error));
  await audit(ctx, active ? "location.activated" : "location.deactivated", id);
  done(ctx);
  return ok(undefined);
}

// Delete a branch that never had a booking (a mistake); otherwise switch it off.
export async function deleteBranch(id: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(id).success) return fail("notAllowed");
  const { count } = await ctx.supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenant.tenantId)
    .eq("location_id", id);
  if (count) return fail("branchHasBookings");
  const { error } = await ctx.supabase
    .from("locations")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.tenantId)
    .eq("is_primary", false);
  if (error) return fail(branchError(error));
  await audit(ctx, "location.deleted", id);
  done(ctx);
  return ok(undefined);
}

export async function saveBranchHours(id: string, week: WeekInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(id).success) return fail("notAllowed");
  const parsed = weekSchema.safeParse(week);
  if (!parsed.success) return fail("scheduleInvalid");
  const rows = Object.entries(parsed.data).flatMap(([day, list]) =>
    list.map((i) => ({ weekday: Number(day), start_time: i.start, end_time: i.end })),
  );
  const { error } = await ctx.supabase.rpc("set_location_hours", { p_location: id, p_rows: rows });
  if (error) return fail(error.code === "23P01" ? "scheduleInvalid" : dbErrorCode(error));
  done(ctx);
  return ok(undefined);
}

export async function saveBranchServices(id: string, input: BranchServicesInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(id).success) return fail("notAllowed");
  const parsed = branchServicesSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const rows = parsed.data
    .filter((r) => !r.offered || r.priceMinor !== null)
    .map((r) => ({
      service_id: r.serviceId,
      offered: r.offered,
      price_minor: r.offered ? r.priceMinor : null,
      price_max_minor: r.offered && r.priceMinor !== null ? r.priceMaxMinor : null,
    }));
  const { error } = await ctx.supabase.rpc("set_location_services", { p_location: id, p_rows: rows });
  if (error) return fail(dbErrorCode(error));
  await audit(ctx, "location.services_updated", id);
  done(ctx);
  revalidatePath(`/${ctx.locale}/services`);
  return ok(undefined);
}
