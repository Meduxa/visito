"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { memberContext, type MemberContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { normalizePhone } from "@/lib/phone";
import { DEFAULT_TZ } from "@/lib/time";
import { getAvailableSlots, validateBooking, type Conflict } from "./engine/availability";
import { notifyBooking } from "../sms/booking-sms";
import { buildItems } from "./build-items";
import { loadEngineData, loadServiceRequests } from "./load-data";

const uuid = z.uuid();
const picksSchema = z
  .array(z.object({ serviceId: z.uuid(), variantId: z.uuid().nullable().optional() }))
  .min(1)
  .max(10);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// the branch of the booking (decision 032); missing = the main branch
const locationSchema = z.uuid().nullable().optional();

function bookingError(error: { code?: string }): string {
  if (error.code === "23P01") return "slotTaken";
  if (error.code === "P0003") return "cannotPerform";
  if (error.code === "P0001") return "invalidTransition";
  if (error.code === "42501") return "notAllowed";
  if (error.code === "P0002") return "notFound";
  console.error("booking error", error.code);
  return "generic";
}

// Staff may only work with their own calendar (the RPCs enforce it too).
const allowedStaff = (ctx: MemberContext, staffId: string) => ctx.isManager || ctx.staffId === staffId;

async function localDate(ctx: MemberContext, iso: string) {
  const { data } = await ctx.supabase
    .from("tenants")
    .select("timezone")
    .eq("id", ctx.tenant.tenantId)
    .single();
  return formatInTimeZone(new Date(iso), data?.timezone ?? DEFAULT_TZ, "yyyy-MM-dd");
}

const done = (ctx: MemberContext) => {
  revalidatePath(`/${ctx.locale}/calendar`);
  revalidatePath(`/${ctx.locale}/my-day`);
};

// Free start times for the new-booking panel.
export async function findSlots(input: {
  date: string;
  staffId: string | "any";
  picks: { serviceId: string; variantId?: string | null }[];
  locationId?: string | null;
}): Promise<ActionResult<{ start: string; staffId: string; staffName: string }[]>> {
  const ctx = await memberContext({ read: true });
  const picks = picksSchema.safeParse(input.picks);
  if (!ctx || !picks.success || !dateSchema.safeParse(input.date).success) return fail("invalidInput");
  if (input.staffId !== "any" && !uuid.safeParse(input.staffId).success) return fail("invalidInput");
  if (!locationSchema.safeParse(input.locationId).success) return fail("invalidInput");
  const staffId = ctx.isManager ? input.staffId : ctx.staffId;
  if (!staffId) return fail("notAllowed");

  const data = await loadEngineData(ctx.supabase, ctx.tenant.tenantId, input.date, input.date, {
    locationId: input.locationId,
  });
  const services = await loadServiceRequests(ctx.supabase, ctx.tenant.tenantId, picks.data);
  if (!services) return fail("notFound");
  const slots = getAvailableSlots({ dates: [input.date], services, staffId }, data);
  return ok(
    slots.map((s) => ({
      start: s.start.toISOString(),
      staffId: s.staffId,
      staffName: data.staffNames[s.staffId]?.name ?? "",
    })),
  );
}

const createSchema = z.object({
  clientId: z.uuid().nullable(),
  newClient: z
    .object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().max(80),
      phone: z.string().trim(),
    })
    .nullable(),
  picks: picksSchema,
  staffId: z.uuid(),
  start: z.iso.datetime({ offset: true }),
  note: z.string().max(2000).optional(),
  source: z.enum(["admin", "phone", "walk_in"]),
  force: z.boolean().optional(), // book outside working hours anyway (managers)
  locationId: locationSchema,
});

export async function createBooking(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string }> | { ok: false; error: "conflicts"; conflicts: Conflict[] }> {
  const ctx = await memberContext();
  const parsed = createSchema.safeParse(input);
  if (!ctx || !parsed.success) return fail("invalidInput");
  const v = parsed.data;
  if (!allowedStaff(ctx, v.staffId)) return fail("notAllowed");
  const { supabase, tenant } = ctx;

  const date = await localDate(ctx, v.start);
  const fullData = await loadEngineData(supabase, tenant.tenantId, date, date, { locationId: v.locationId });
  const services = await loadServiceRequests(supabase, tenant.tenantId, v.picks);
  if (!services) return fail("notFound");

  const conflicts = validateBooking(
    { staffId: v.staffId, start: new Date(v.start), services },
    fullData,
  ).filter((c) => !(v.force && ctx.isManager && (c === "outsideHours" || c === "closed")));
  if (conflicts.length) return { ok: false, error: "conflicts", conflicts };

  // A new client is created first (staff: as their own preferred client).
  let clientId = v.clientId;
  if (!clientId && v.newClient) {
    const phone = v.newClient.phone ? normalizePhone(v.newClient.phone) : null;
    if (v.newClient.phone && !phone) return fail("phoneInvalid", "phone");
    const { data: c, error } = await supabase
      .from("clients")
      .insert({
        tenant_id: tenant.tenantId,
        first_name: v.newClient.firstName,
        last_name: v.newClient.lastName || null,
        phone_e164: phone,
        source: v.source === "walk_in" ? "walk_in" : v.source === "phone" ? "phone" : null,
        preferred_staff_id: ctx.isManager ? null : ctx.staffId,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select("id")
      .single();
    if (error) return fail(error.code === "23505" ? "phoneTaken" : "generic", "phone");
    clientId = c.id;
  }

  const items = buildItems(fullData, {
    staffId: v.staffId,
    start: new Date(v.start),
    services,
    picks: v.picks,
  });

  const { data: id, error } = await supabase.rpc("create_booking", {
    p_tenant: tenant.tenantId,
    p_client: clientId as string,
    p_items: items,
    p_source: v.source,
    p_note: v.note ?? "",
    p_status: "confirmed",
    p_locale: ctx.locale,
    p_location: fullData.locationId || undefined,
  });
  if (error) return fail(bookingError(error));
  done(ctx);
  if (v.source !== "walk_in") after(() => notifyBooking(id, "confirmed"));
  return ok({ id });
}

const moveSchema = z.object({
  bookingId: z.uuid(),
  staffId: z.uuid(),
  start: z.iso.datetime({ offset: true }),
  durationMin: z.number().int().min(5).max(720).optional(), // resize (single-service bookings)
  force: z.boolean().optional(),
});

// Move / resize / reassign. All items move together, keeping their order.
export async function moveBooking(
  input: z.input<typeof moveSchema>,
): Promise<ActionResult | { ok: false; error: "conflicts"; conflicts: Conflict[] }> {
  const ctx = await memberContext();
  const parsed = moveSchema.safeParse(input);
  if (!ctx || !parsed.success) return fail("invalidInput");
  const v = parsed.data;
  if (!allowedStaff(ctx, v.staffId)) return fail("notAllowed");
  const { supabase, tenant } = ctx;

  const { data: items } = await supabase
    .from("booking_items")
    .select("id, service_id, staff_id, starts_at, duration_min_snapshot")
    .eq("booking_id", v.bookingId)
    .order("sort_order");
  if (!items?.length) return fail("notFound");
  if (items.some((i) => !allowedStaff(ctx, i.staff_id))) return fail("notAllowed");

  const date = await localDate(ctx, v.start);
  const { data: own } = await supabase.from("bookings").select("location_id").eq("id", v.bookingId).single();
  const data = await loadEngineData(supabase, tenant.tenantId, date, date, {
    excludeBookingId: v.bookingId,
    locationId: own?.location_id,
  });
  const delta = new Date(v.start).getTime() - new Date(items[0].starts_at).getTime();

  // Validate with the durations agreed at booking time (snapshots), not the
  // current service settings: the engine gets those durations and no own override.
  const services = await loadServiceRequests(
    supabase,
    tenant.tenantId,
    items.filter((i) => i.service_id).map((i) => ({ serviceId: i.service_id! })),
  );
  if (services && services.length === items.length) {
    const snap = services.map((s, k) => ({
      ...s,
      durationMin: items.length === 1 && v.durationMin ? v.durationMin : items[k].duration_min_snapshot,
    }));
    const asAgreed = {
      ...data,
      staff: data.staff.map((s) =>
        s.id === v.staffId
          ? {
              ...s,
              services: Object.fromEntries(Object.keys(s.services).map((k) => [k, { durationMin: null }])),
            }
          : s,
      ),
    };
    const conflicts = validateBooking(
      { staffId: v.staffId, start: new Date(v.start), services: snap },
      asAgreed,
    ).filter((c) => !(v.force && ctx.isManager && (c === "outsideHours" || c === "closed")));
    if (conflicts.length) return { ok: false, error: "conflicts", conflicts };
  }

  const { error } = await supabase.rpc("move_booking", {
    p_booking: v.bookingId,
    p_items: items.map((i) => ({
      item_id: i.id,
      staff_id: v.staffId,
      starts_at: new Date(new Date(i.starts_at).getTime() + delta).toISOString(),
      duration_min: items.length === 1 ? (v.durationMin ?? null) : null,
    })),
  });
  if (error) return fail(bookingError(error));
  done(ctx);
  if (delta !== 0) after(() => notifyBooking(v.bookingId, "rescheduled"));
  return ok(undefined);
}

const statuses = [
  "pending",
  "confirmed",
  "arrived",
  "in_progress",
  "completed",
  "cancelled_by_client",
  "cancelled_by_business",
  "no_show",
] as const;

export async function setBookingStatus(
  bookingId: string,
  status: (typeof statuses)[number],
  reason?: string,
): Promise<ActionResult> {
  const ctx = await memberContext();
  if (!ctx || !uuid.safeParse(bookingId).success || !statuses.includes(status)) return fail("invalidInput");
  const { error } = await ctx.supabase.rpc("set_booking_status", {
    p_booking: bookingId,
    p_status: status,
    p_reason: (reason ?? "").slice(0, 300),
  });
  if (error) return fail(bookingError(error));
  done(ctx);
  // approving a pending (online) booking confirms it; one message per booking, so an undo never resends
  if (status === "confirmed") after(() => notifyBooking(bookingId, "confirmed"));
  if (status === "cancelled_by_business") after(() => notifyBooking(bookingId, "cancelled"));
  return ok(undefined);
}

export async function setBookingNote(bookingId: string, note: string): Promise<ActionResult> {
  const ctx = await memberContext();
  if (!ctx || !uuid.safeParse(bookingId).success) return fail("invalidInput");
  const { error } = await ctx.supabase.rpc("set_booking_note", {
    p_booking: bookingId,
    p_note: note.slice(0, 2000),
  });
  if (error) return fail(bookingError(error));
  done(ctx);
  return ok(undefined);
}

// For the new-booking panel: clients matching a search (RLS limits staff).
export async function findClients(q: string) {
  const ctx = await memberContext({ read: true });
  const term = q
    .trim()
    .replace(/[%,()*\\]/g, " ")
    .trim();
  if (!ctx || term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const parts = [`first_name.ilike.%${term}%`, `last_name.ilike.%${term}%`];
  if (digits.length >= 3) parts.push(`phone_e164.like.%${digits}%`);
  const { data } = await ctx.supabase
    .from("clients")
    .select("id, first_name, last_name, phone_e164, important_note, no_show_count")
    .eq("tenant_id", ctx.tenant.tenantId)
    .is("anonymized_at", null)
    .or(parts.join(","))
    .limit(8);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Recurring bookings
// ---------------------------------------------------------------------------

const recurringSchema = z.object({
  clientId: z.uuid().nullable(),
  picks: picksSchema,
  staffId: z.uuid(),
  start: z.iso.datetime({ offset: true }),
  everyWeeks: z.number().int().min(1).max(12),
  times: z.number().int().min(2).max(52),
  locationId: locationSchema,
});

// Every date of the series with its problems (empty = fine), so the user can
// skip dates that clash before anything is saved.
export async function previewRecurring(
  input: z.input<typeof recurringSchema>,
): Promise<ActionResult<{ start: string; conflicts: Conflict[] }[]>> {
  const ctx = await memberContext({ read: true });
  const parsed = recurringSchema.safeParse(input);
  if (!ctx || !parsed.success) return fail("invalidInput");
  const v = parsed.data;
  if (!allowedStaff(ctx, v.staffId)) return fail("notAllowed");

  const starts = Array.from(
    { length: v.times },
    (_, k) => new Date(new Date(v.start).getTime() + k * v.everyWeeks * 7 * 86_400_000),
  );
  const first = await localDate(ctx, starts[0].toISOString());
  const last = await localDate(ctx, starts.at(-1)!.toISOString());
  const data = await loadEngineData(ctx.supabase, ctx.tenant.tenantId, first, last, {
    locationId: v.locationId,
  });
  const services = await loadServiceRequests(ctx.supabase, ctx.tenant.tenantId, v.picks);
  if (!services) return fail("notFound");
  return ok(
    starts.map((s) => ({
      start: s.toISOString(),
      conflicts: validateBooking({ staffId: v.staffId, start: s, services }, data),
    })),
  );
}

export async function createRecurring(input: {
  clientId: string | null;
  picks: { serviceId: string; variantId?: string | null }[];
  staffId: string;
  starts: string[];
  everyWeeks: number;
  note?: string;
  locationId?: string | null;
}): Promise<ActionResult<{ count: number }>> {
  const ctx = await memberContext();
  const parsed = z
    .object({
      clientId: z.uuid().nullable(),
      picks: picksSchema,
      staffId: z.uuid(),
      starts: z
        .array(z.iso.datetime({ offset: true }))
        .min(2)
        .max(52),
      everyWeeks: z.number().int().min(1).max(12),
      note: z.string().max(2000).optional(),
      locationId: locationSchema,
    })
    .safeParse(input);
  if (!ctx || !parsed.success) return fail("invalidInput");
  const v = parsed.data;
  if (!allowedStaff(ctx, v.staffId)) return fail("notAllowed");

  // the same back-to-back layout as a single booking, repeated per date
  const data = await loadEngineData(
    ctx.supabase,
    ctx.tenant.tenantId,
    await localDate(ctx, v.starts[0]),
    await localDate(ctx, v.starts.at(-1)!),
    { locationId: v.locationId },
  );
  const services = await loadServiceRequests(ctx.supabase, ctx.tenant.tenantId, v.picks);
  const staff = data.staff.find((s) => s.id === v.staffId);
  if (!services || !staff) return fail("notFound");
  const occurrences = v.starts.map((start) => {
    let t = new Date(start).getTime();
    return services.map((s) => {
      const item = {
        service_id: s.serviceId,
        variant_id: v.picks.find((p) => p.serviceId === s.serviceId)?.variantId ?? null,
        staff_id: v.staffId,
        starts_at: new Date(t).toISOString(),
      };
      t += ((staff.services[s.serviceId]?.durationMin ?? s.durationMin) + (s.addonMin ?? 0)) * 60_000;
      return item;
    });
  });

  const { error } = await ctx.supabase.rpc("create_recurring_booking", {
    p_tenant: ctx.tenant.tenantId,
    p_client: v.clientId as string,
    p_occurrences: occurrences,
    p_every_weeks: v.everyWeeks,
    p_source: "admin",
    p_note: v.note ?? "",
    p_locale: ctx.locale,
    p_location: data.locationId || undefined,
  });
  if (error) return fail(bookingError(error));
  done(ctx);
  return ok({ count: v.starts.length });
}

export async function cancelFollowing(
  bookingId: string,
  status: "cancelled_by_client" | "cancelled_by_business",
  reason?: string,
): Promise<ActionResult<{ count: number }>> {
  const ctx = await memberContext();
  if (!ctx || !uuid.safeParse(bookingId).success) return fail("invalidInput");
  const { data, error } = await ctx.supabase.rpc("cancel_following", {
    p_booking: bookingId,
    p_status: status,
    p_reason: (reason ?? "").slice(0, 300),
  });
  if (error) return fail(bookingError(error));
  done(ctx);
  return ok({ count: data });
}
