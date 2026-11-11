"use server";

import { formatInTimeZone } from "date-fns-tz";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { getEmailProvider } from "@/integrations/email";
import { notifyBooking } from "@/features/sms/booking-sms";
import { sendNow } from "@/features/sms/send";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { fullDateTime } from "@/lib/date-format";
import { publicEnv } from "@/lib/env";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildItems } from "../booking/build-items";
import { getAvailableSlots } from "../booking/engine/availability";
import { loadEngineData, loadServiceRequests } from "../booking/load-data";
import { getPublicBusiness } from "./queries";
import { allow, clientIp, hmac, newCode, newToken } from "./security";

// The public booking page (no sign-in). Every step re-checks on the server:
// the business from the slug, real availability with the online rules, the
// SMS code, rate limits. Errors are generic on purpose.

const slugSchema = z.string().regex(/^[a-z0-9-]{3,50}$/);
const dateSchema = z.iso.date();
const picksSchema = z
  .array(z.object({ serviceId: z.uuid(), variantId: z.uuid().nullable().optional() }))
  .min(1)
  .max(5);
const staffSchema = z.union([z.literal("any"), z.uuid()]);
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);

type Slot = { start: string; staffId: string; staffName: string };

async function slotsFor(
  tenantId: string,
  date: string,
  staffId: string,
  picks: z.infer<typeof picksSchema>,
  excludeBookingId?: string,
) {
  const db = createAdminClient();
  const data = await loadEngineData(db, tenantId, date, date, { excludeBookingId });
  const services = await loadServiceRequests(db, tenantId, picks);
  if (!services) return null;
  return {
    data,
    services,
    slots: getAvailableSlots({ dates: [date], services, staffId, online: true }, data),
  };
}

export async function findPublicSlots(input: {
  slug: string;
  date: string;
  staffId: string;
  picks: { serviceId: string; variantId?: string | null }[];
}): Promise<ActionResult<Slot[]>> {
  const p = z
    .object({ slug: slugSchema, date: dateSchema, staffId: staffSchema, picks: picksSchema })
    .safeParse(input);
  if (!p.success) return fail("invalidInput");
  if (!(await allow("slotsPerIp", await clientIp()))) return fail("tooMany");
  const business = await getPublicBusiness(p.data.slug, await getLocale());
  if (!business) return fail("notFound");
  const r = await slotsFor(business.tenantId, p.data.date, p.data.staffId, p.data.picks);
  if (!r) return fail("notFound");
  return ok(
    r.slots.map((s) => ({
      start: s.start.toISOString(),
      staffId: s.staffId,
      staffName: r.data.staffNames[s.staffId]?.name ?? "",
    })),
  );
}

export async function sendCode(input: {
  slug: string;
  phone: string;
  website?: string;
}): Promise<ActionResult> {
  if (input.website) return ok(undefined); // honeypot: bots fill every field; pretend it worked
  const business = slugSchema.safeParse(input.slug).success
    ? await getPublicBusiness(input.slug, "ka")
    : null;
  if (!business) return fail("notFound");
  const phone = normalizePhone(input.phone ?? "");
  if (!phone) return fail("phoneInvalid", "phone");
  if (!(await allow("codePerPhone", phone)) || !(await allow("codePerIp", await clientIp())))
    return fail("tooMany");

  const code = newCode();
  const { error } = await createAdminClient().rpc("otp_issue", {
    p_tenant: business.tenantId,
    p_phone: phone,
    p_code_hash: hmac(`${business.tenantId}:${phone}:${code}`),
  });
  if (error) return fail("generic");
  const t = await getTranslations("publicBooking.sms");
  const sent = await sendNow({
    tenantId: business.tenantId,
    to: phone,
    text: t("code", { code, business: business.name }),
    storedText: t("code", { code: "••••••", business: business.name }), // the log never shows codes
    kind: "service",
    type: "otp",
    key: `otp:${phone}:${hmac(code).slice(0, 16)}`,
  });
  return sent ? ok(undefined) : fail("smsFailed");
}

// Returns a one-off pass proving the phone; the booking spends it.
export async function verifyCode(input: {
  slug: string;
  phone: string;
  code: string;
}): Promise<ActionResult<{ pass: string }>> {
  const business = slugSchema.safeParse(input.slug).success
    ? await getPublicBusiness(input.slug, "ka")
    : null;
  const phone = normalizePhone(input.phone ?? "");
  if (!business || !phone || !/^\d{6}$/.test(input.code ?? "")) return fail("codeWrong", "code");
  const pass = newToken();
  const { data, error } = await createAdminClient().rpc("otp_verify", {
    p_tenant: business.tenantId,
    p_phone: phone,
    p_code_hash: hmac(`${business.tenantId}:${phone}:${input.code}`),
    p_pass_hash: hmac(pass),
  });
  if (error) return fail("generic");
  if (data === "ok") return ok({ pass });
  return fail(data === "wrong" ? "codeWrong" : "codeExpired", "code");
}

const bookSchema = z.object({
  slug: slugSchema,
  picks: picksSchema,
  staffId: staffSchema,
  start: z.iso.datetime({ offset: true }),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80),
  phone: z.string().trim().min(5).max(30),
  email: z.union([z.literal(""), z.email().max(200)]),
  comment: z.string().trim().max(500),
  marketingSms: z.boolean(),
  marketingEmail: z.boolean(),
  pass: z.string().max(64).nullable(),
  website: z.string().optional(),
});

export type BookedSummary = {
  token: string;
  status: "pending" | "confirmed";
  start: string;
  end: string;
  staffName: string;
};

export async function bookOnline(input: z.input<typeof bookSchema>): Promise<ActionResult<BookedSummary>> {
  const p = bookSchema.safeParse(input);
  if (!p.success) return fail("invalidInput");
  const v = p.data;
  if (v.website) return fail("generic"); // honeypot
  const phone = normalizePhone(v.phone);
  if (!phone) return fail("phoneInvalid", "phone");
  if (!(await allow("bookPerPhone", phone)) || !(await allow("bookPerIp", await clientIp())))
    return fail("tooMany");
  const locale = await getLocale();
  const business = await getPublicBusiness(v.slug, locale);
  if (!business) return fail("notFound");
  if (business.otpRequired && !v.pass) return fail("phoneNotVerified");

  // The chosen time must be one the engine offers right now, online rules included.
  const date = formatInTimeZone(v.start, business.timeZone, "yyyy-MM-dd");
  const r = await slotsFor(business.tenantId, date, v.staffId, v.picks);
  const startMs = new Date(v.start).getTime();
  const slot = r?.slots.find((s) => s.start.getTime() === startMs);
  if (!r || !slot) return fail("slotTaken");
  const items = buildItems(r.data, {
    staffId: slot.staffId,
    start: slot.start,
    services: r.services,
    picks: v.picks,
    resourceId: slot.resourceId,
  });

  const token = newToken();
  const { data, error } = await createAdminClient().rpc("public_create_booking", {
    p_tenant: business.tenantId,
    p_first_name: v.firstName,
    p_last_name: v.lastName,
    p_phone: phone,
    p_email: v.email,
    p_comment: v.comment,
    p_items: items,
    p_marketing_sms: v.marketingSms,
    p_marketing_email: v.marketingEmail && v.email !== "",
    p_locale: locale,
    p_manage_token_hash: hmac(token),
    p_otp_pass_hash: (v.pass ? hmac(v.pass) : null) as string,
  });
  if (error) {
    if (error.code === "23P01") return fail("slotTaken");
    if (error.code === "28000") return fail("phoneNotVerified");
    if (error.code === "P0004") return fail("blockedOnline");
    if (error.code === "P0006") return fail("tooManyUpcoming");
    if (error.code === "P0003") return fail("slotTaken");
    return fail("generic");
  }
  const booked = data as { booking_id: string; status: "pending" | "confirmed" };
  const staffName = r.data.staffNames[slot.staffId]?.name ?? "";

  // Confirmation with the manage link: right away, the client is waiting for it.
  await notifyBooking(booked.booking_id, booked.status, { immediate: true, manageToken: token });
  if (v.email) {
    const t = await getTranslations();
    await getEmailProvider().sendTransactional({
      to: v.email,
      subject: t("publicBooking.emailMessage.subject", { business: business.name }),
      text: t("publicBooking.emailMessage.body", {
        business: business.name,
        when: fullDateTime(t, slot.start.toISOString(), business.timeZone),
        link: `${publicEnv.NEXT_PUBLIC_APP_URL}/m/${token}`,
      }),
      idempotencyKey: `booked:${booked.booking_id}`,
    });
  }

  return ok({
    token,
    status: booked.status,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    staffName,
  });
}

// ---------------------------------------------------------------------------
// Manage link (/m/[token])
// ---------------------------------------------------------------------------

export type ManageView = {
  bookingId: string;
  tenantId: string;
  slug: string;
  business: string;
  timeZone: string;
  status: string;
  start: string;
  end: string;
  totalMinor: number;
  firstName: string | null;
  cancelWindowMin: number;
  changeable: boolean; // active and still before the cancellation window
  phone: string | null;
  address: string | null;
  items: {
    serviceId: string | null;
    variantId: string | null;
    staffId: string;
    staff: string;
    name: string;
  }[];
};

export async function manageView(token: string): Promise<ManageView | null> {
  if (!tokenSchema.safeParse(token).success) return null;
  const { data } = await createAdminClient().rpc("public_manage_view", { p_token_hash: hmac(token) });
  if (!data) return null;
  const d = data as Record<string, unknown> & { items: Record<string, string>[] | null };
  return {
    bookingId: d.booking_id as string,
    tenantId: d.tenant_id as string,
    slug: d.slug as string,
    business: d.business as string,
    timeZone: d.timezone as string,
    status: d.status as string,
    start: d.starts_at as string,
    end: d.ends_at as string,
    totalMinor: d.total_minor as number,
    firstName: (d.first_name as string) ?? null,
    cancelWindowMin: d.cancel_window_min as number,
    changeable:
      ["pending", "confirmed"].includes(d.status as string) &&
      Date.now() < new Date(d.starts_at as string).getTime() - (d.cancel_window_min as number) * 60_000,
    phone: (d.phone as string) ?? null,
    address: (d.address as string) ?? null,
    items: (d.items ?? []).map((i) => ({
      serviceId: i.service_id,
      variantId: i.variant_id,
      staffId: i.staff_id,
      staff: i.staff,
      name: i.name,
    })),
  };
}

async function manageGuard(token: string) {
  if (!tokenSchema.safeParse(token).success) return null;
  if (!(await allow("managePerToken", token))) return null;
  return manageView(token);
}

// Free times for moving the whole visit, same person (single-person visits only).
export async function manageSlots(token: string, date: string): Promise<ActionResult<Slot[]>> {
  const view = await manageGuard(token);
  if (!view || !dateSchema.safeParse(date).success) return fail("notFound");
  const staff = [...new Set(view.items.map((i) => i.staffId))];
  if (staff.length !== 1 || view.items.some((i) => !i.serviceId)) return fail("cannotMove");
  const picks = view.items.map((i) => ({ serviceId: i.serviceId!, variantId: i.variantId }));
  const r = await slotsFor(view.tenantId, date, staff[0], picks, view.bookingId);
  if (!r) return fail("cannotMove");
  return ok(
    r.slots.map((s) => ({
      start: s.start.toISOString(),
      staffId: s.staffId,
      staffName: view.items[0].staff,
    })),
  );
}

export async function manageMove(token: string, start: string): Promise<ActionResult> {
  const view = await manageGuard(token);
  if (!view || !z.iso.datetime({ offset: true }).safeParse(start).success) return fail("notFound");
  const date = formatInTimeZone(start, view.timeZone, "yyyy-MM-dd");
  const free = await manageSlots(token, date);
  if (!free.ok || !free.data.some((s) => new Date(s.start).getTime() === new Date(start).getTime()))
    return fail("slotTaken");
  const { error } = await createAdminClient().rpc("public_move_booking", {
    p_token_hash: hmac(token),
    p_starts_at: start,
  });
  if (error)
    return fail(error.code === "P0005" ? "tooLate" : error.code === "23P01" ? "slotTaken" : "generic");
  return ok(undefined);
}

export async function manageCancel(token: string): Promise<ActionResult> {
  const view = await manageGuard(token);
  if (!view) return fail("notFound");
  const { error } = await createAdminClient().rpc("public_cancel_booking", { p_token_hash: hmac(token) });
  if (error) return fail(error.code === "P0005" ? "tooLate" : "generic");
  return ok(undefined);
}
