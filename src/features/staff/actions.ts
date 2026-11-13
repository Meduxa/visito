"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorCode, managerContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DEFAULT_TZ, zonedToUtcIso } from "@/lib/time";
import {
  overrideSchema,
  staffSchema,
  staffServicesSchema,
  timeOffSchema,
  weekSchema,
  type OverrideInput,
  type StaffInput,
  type StaffServicesInput,
  type TimeOffInput,
  type WeekInput,
} from "./schema";

const uuid = z.uuid();
const done = (locale: string, id?: string) => {
  revalidatePath(`/${locale}/staff`);
  if (id) revalidatePath(`/${locale}/staff/${id}`);
};

export async function saveStaff(id: string | null, input: StaffInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await managerContext();
  if (!ctx || (id && !uuid.safeParse(id).success)) return fail("notAllowed");
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;
  const row = {
    display_name: v.displayName,
    position: v.position,
    position_type: v.positionType,
    color: v.color,
    phone: v.phone,
    email: v.email,
    bio: v.bio,
    bookable_online: v.bookableOnline,
    active: v.active,
    commission_pct: v.commissionPct,
  };
  const { supabase, tenant } = ctx;
  const { data, error } = id
    ? await supabase
        .from("staff")
        .update(row)
        .eq("id", id)
        .eq("tenant_id", tenant.tenantId)
        .select("id")
        .single()
    : await supabase
        .from("staff")
        .insert({ ...row, tenant_id: tenant.tenantId })
        .select("id")
        .single();
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale, data.id);
  return ok({ id: data.id });
}

// The browser uploads the file straight to storage (RLS: own tenant folder,
// owner/admin only); this only records the path.
export async function setStaffPhoto(id: string, path: string | null): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(id).success) return fail("notAllowed");
  if (path !== null && !path.startsWith(`${ctx.tenant.tenantId}/`)) return fail("notAllowed");
  const { error } = await ctx.supabase
    .from("staff")
    .update({ photo_path: path })
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.tenantId);
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale, id);
  return ok(undefined);
}

export async function deleteStaff(id: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(id).success) return fail("notAllowed");
  const { error } = await ctx.supabase
    .from("staff")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.tenantId);
  if (error) return fail(error.code === "23503" ? "staffHasBookings" : dbErrorCode(error));
  await ctx.supabase.rpc("log_audit", {
    p_tenant: ctx.tenant.tenantId,
    p_action: "staff.deleted",
    p_entity: "staff",
    p_entity_id: id,
  });
  done(ctx.locale);
  return ok(undefined);
}

export async function saveWeek(staffId: string, week: WeekInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(staffId).success) return fail("notAllowed");
  const parsed = weekSchema.safeParse(week);
  if (!parsed.success) return fail("scheduleInvalid");
  const rows = Object.entries(parsed.data).flatMap(([day, list]) =>
    list.map((i) => ({
      weekday: Number(day),
      start_time: i.start,
      end_time: i.end,
      location_id: i.locationId ?? null,
    })),
  );
  const { error } = await ctx.supabase.rpc("set_staff_schedule", { p_staff: staffId, p_rows: rows });
  if (error) return fail(error.code === "23P01" ? "scheduleInvalid" : dbErrorCode(error));
  done(ctx.locale, staffId);
  return ok(undefined);
}

export async function saveStaffServices(staffId: string, input: StaffServicesInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(staffId).success) return fail("notAllowed");
  const parsed = staffServicesSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const { error } = await ctx.supabase.rpc("set_staff_services", { p_staff: staffId, p_rows: parsed.data });
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale, staffId);
  revalidatePath(`/${ctx.locale}/services`);
  return ok(undefined);
}

export async function addOverride(staffId: string, input: OverrideInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(staffId).success) return fail("notAllowed");
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;
  const { supabase, tenant } = ctx;
  // one date = one rule: replace whatever was set for that date before
  await supabase.from("staff_schedule_overrides").delete().eq("staff_id", staffId).eq("date", v.date);
  const { error } = await supabase.from("staff_schedule_overrides").insert({
    tenant_id: tenant.tenantId,
    staff_id: staffId,
    date: v.date,
    is_day_off: v.dayOff,
    start_time: v.dayOff ? null : v.start,
    end_time: v.dayOff ? null : v.end,
    location_id: v.dayOff ? null : (v.locationId ?? null),
  });
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale, staffId);
  return ok(undefined);
}

export async function addTimeOff(staffId: string, input: TimeOffInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(staffId).success) return fail("notAllowed");
  const parsed = timeOffSchema.safeParse(input);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message === "endBeforeStart" ? "endBeforeStart" : "invalidInput");
  const v = parsed.data;
  const { data: tz } = await ctx.supabase
    .from("tenants")
    .select("timezone")
    .eq("id", ctx.tenant.tenantId)
    .single();
  const zone = tz?.timezone ?? DEFAULT_TZ;
  const { error } = await ctx.supabase.from("time_off").insert({
    tenant_id: ctx.tenant.tenantId,
    staff_id: staffId,
    starts_at: zonedToUtcIso(v.startDate, v.startTime, zone),
    ends_at: zonedToUtcIso(v.endDate, v.endTime, zone),
    reason: v.reason,
    note: v.note,
  });
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale, staffId);
  return ok(undefined);
}

export async function deleteScheduleItem(
  kind: "override" | "timeOff",
  id: string,
  staffId: string,
): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(id).success) return fail("notAllowed");
  const table = kind === "override" ? "staff_schedule_overrides" : "time_off";
  const { error } = await ctx.supabase.from(table).delete().eq("id", id).eq("tenant_id", ctx.tenant.tenantId);
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale, staffId);
  return ok(undefined);
}

export async function linkLogin(staffId: string, membershipId: string | null): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(staffId).success || (membershipId && !uuid.safeParse(membershipId).success)) {
    return fail("notAllowed");
  }
  const { error } = await ctx.supabase.rpc("link_staff_login", {
    p_staff: staffId,
    p_membership: membershipId as string,
  });
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale, staffId);
  return ok(undefined);
}
