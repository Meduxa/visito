"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { weekSchema, type WeekInput } from "@/features/staff/schema";
import { dbErrorCode, managerContext, type ManagerContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Database } from "@/lib/supabase/database.types";
import {
  businessSchema,
  closureSchema,
  resourceSchema,
  accessSchema,
  bookingRulesSchema,
  notifySchema,
  type AccessInput,
  type BookingRulesInput,
  type BusinessInput,
  type NotifyInput,
} from "./schema";

const done = (ctx: ManagerContext) => revalidatePath(`/${ctx.locale}/settings`, "layout");

async function primaryLocationId(ctx: ManagerContext) {
  const { data } = await ctx.supabase
    .from("locations")
    .select("id")
    .eq("tenant_id", ctx.tenant.tenantId)
    .eq("is_primary", true)
    .single();
  return data?.id ?? null;
}

export async function saveBusiness(input: BusinessInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;
  const { supabase, tenant } = ctx;

  // The business name is the owner's to change (RLS on tenants agrees).
  if (tenant.role === "owner") {
    const { error } = await supabase.from("tenants").update({ name: v.name }).eq("id", tenant.tenantId);
    if (error) return fail(dbErrorCode(error));
  }
  const s = await supabase
    .from("tenant_settings")
    .update({ phone: v.phone, email: v.email })
    .eq("tenant_id", tenant.tenantId);
  if (s.error) return fail(dbErrorCode(s.error));
  const loc = await primaryLocationId(ctx);
  if (loc) {
    const l = await supabase
      .from("locations")
      .update({ address: v.address || null, phone: v.phone })
      .eq("id", loc);
    if (l.error) return fail(dbErrorCode(l.error));
  }
  await supabase.rpc("log_audit", {
    p_tenant: tenant.tenantId,
    p_action: "settings.updated",
    p_entity: "tenant",
    p_entity_id: tenant.tenantId,
  });
  done(ctx);
  revalidatePath(`/${ctx.locale}`, "layout");
  return ok(undefined);
}

async function updateSettings(
  ctx: ManagerContext,
  values: Database["public"]["Tables"]["tenant_settings"]["Update"],
  action: string,
): Promise<ActionResult> {
  const { error } = await ctx.supabase
    .from("tenant_settings")
    .update(values)
    .eq("tenant_id", ctx.tenant.tenantId);
  if (error) return fail(dbErrorCode(error));
  await ctx.supabase.rpc("log_audit", {
    p_tenant: ctx.tenant.tenantId,
    p_action: action,
    p_entity: "tenant",
    p_entity_id: ctx.tenant.tenantId,
  });
  done(ctx);
  return ok(undefined);
}

export async function saveBookingRules(input: BookingRulesInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const parsed = bookingRulesSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;
  return updateSettings(
    ctx,
    {
      min_notice_min: v.minNoticeHours * 60,
      max_days_ahead: v.maxDaysAhead,
      cancel_window_min: v.cancelWindowHours * 60,
      slot_step_min: v.slotStepMin,
      online_requires_approval: v.onlineRequiresApproval,
      online_otp_required: v.onlineOtpRequired,
      online_show_prices: v.onlineShowPrices,
      online_max_upcoming: v.maxUpcoming,
    },
    "settings.rules_updated",
  );
}

export async function saveAccess(input: AccessInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const parsed = accessSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;
  return updateSettings(
    ctx,
    {
      staff_sees_all_clients: v.staffSeesAllClients,
      staff_sees_all_bookings: v.staffSeesAllBookings,
      // only the owner decides whether admins see money
      ...(ctx.tenant.role === "owner" ? { admins_see_revenue: v.adminsSeeRevenue } : {}),
    },
    "settings.access_updated",
  );
}

export async function saveNotifications(input: NotifyInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const parsed = notifySchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;
  return updateSettings(
    ctx,
    {
      notify_online_managers: v.onlineManagers,
      notify_online_staff: v.onlineStaff,
      notify_overdue_managers: v.overdueManagers,
      notify_overdue_staff: v.overdueStaff,
    },
    "settings.notifications_updated",
  );
}

export async function saveOpeningHours(week: WeekInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const parsed = weekSchema.safeParse(week);
  if (!parsed.success) return fail("scheduleInvalid");
  const loc = await primaryLocationId(ctx);
  if (!loc) return fail("notFound");
  const rows = Object.entries(parsed.data).flatMap(([day, list]) =>
    list.map((i) => ({ weekday: Number(day), start_time: i.start, end_time: i.end })),
  );
  const { error } = await ctx.supabase.rpc("set_location_hours", { p_location: loc, p_rows: rows });
  if (error) return fail(error.code === "23P01" ? "scheduleInvalid" : dbErrorCode(error));
  done(ctx);
  return ok(undefined);
}

export async function addClosure(input: z.input<typeof closureSchema>): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const parsed = closureSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const { error } = await ctx.supabase.from("closures").insert({
    tenant_id: ctx.tenant.tenantId,
    date: parsed.data.date,
    reason: parsed.data.reason || null,
    location_id: parsed.data.locationId ?? null,
  });
  if (error) return fail(dbErrorCode(error));
  done(ctx);
  return ok(undefined);
}

export async function addResource(input: z.input<typeof resourceSchema>): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const { locationId, ...v } = parsed.data;
  const loc = locationId ?? (await primaryLocationId(ctx));
  const { error } = await ctx.supabase
    .from("resources")
    .insert({ tenant_id: ctx.tenant.tenantId, location_id: loc, ...v });
  if (error) return fail(dbErrorCode(error));
  done(ctx);
  return ok(undefined);
}

export async function deleteSettingsItem(kind: "closure" | "resource", id: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !z.uuid().safeParse(id).success) return fail("notAllowed");
  const table = kind === "closure" ? "closures" : "resources";
  const { error } = await ctx.supabase.from(table).delete().eq("id", id).eq("tenant_id", ctx.tenant.tenantId);
  if (error) return fail(dbErrorCode(error));
  done(ctx);
  return ok(undefined);
}
