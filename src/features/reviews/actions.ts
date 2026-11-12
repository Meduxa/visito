"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { allow, clientIp, hmac } from "@/features/public-booking/security";
import { dbErrorCode, managerContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { createAdminClient } from "@/lib/supabase/admin";

// Reviews (decision 030). Moderation and settings: owner/admin (checked again by
// the database). The public review page: only through the private SMS link,
// whose key is stored as an HMAC; one review per visit; rate limited.

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);

export async function moderateReview(
  id: string,
  input: { status: "published" | "hidden"; reply: string },
): Promise<ActionResult> {
  const ctx = await managerContext();
  const p = z
    .object({ status: z.enum(["published", "hidden"]), reply: z.string().trim().max(1000) })
    .safeParse(input);
  if (!ctx || !z.uuid().safeParse(id).success) return fail("notAllowed");
  if (!p.success) return fail("invalidInput");
  const { error } = await ctx.supabase.rpc("moderate_review", {
    p_id: id,
    p_status: p.data.status,
    p_reply: p.data.reply,
  });
  if (error) return fail(dbErrorCode(error));
  revalidatePath(`/${ctx.locale}/reviews`);
  return ok(undefined);
}

const settingsSchema = z.object({
  ask: z.boolean(),
  delayHours: z.coerce.number<string | number>().int().min(1).max(48),
  showOnPage: z.boolean(),
});
export type ReviewSettingsInput = z.input<typeof settingsSchema>;

export async function saveReviewSettings(input: ReviewSettingsInput): Promise<ActionResult> {
  const ctx = await managerContext();
  const p = settingsSchema.safeParse(input);
  if (!ctx) return fail("notAllowed");
  if (!p.success) return fail("invalidInput");
  const { data, error } = await ctx.supabase
    .from("tenant_settings")
    .update({
      reviews_ask: p.data.ask,
      reviews_delay_hours: p.data.delayHours,
      reviews_public: p.data.showOnPage,
    })
    .eq("tenant_id", ctx.tenant.tenantId)
    .select("tenant_id");
  if (error) return fail(dbErrorCode(error));
  if (!data?.length) return fail("notAllowed");
  revalidatePath(`/${ctx.locale}/settings/reviews`);
  return ok(undefined);
}

export type ReviewLinkView = {
  business: string;
  slug: string;
  startsAt: string;
  timeZone: string;
  firstName: string | null;
  services: string;
  staff: string;
  done: boolean;
  expired: boolean;
};

/** What a review link is about; null = unknown link. */
export async function reviewLinkView(token: string): Promise<ReviewLinkView | null> {
  if (!tokenSchema.safeParse(token).success) return null;
  const { data } = await createAdminClient().rpc("public_review_get", { p_token_hash: hmac(token) });
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return {
    business: d.business as string,
    slug: d.slug as string,
    startsAt: d.starts_at as string,
    timeZone: d.timezone as string,
    firstName: (d.first_name as string) ?? null,
    services: (d.services as string) ?? "",
    staff: (d.staff as string) ?? "",
    done: !!d.done,
    expired: !!d.expired,
  };
}

export async function submitReview(
  token: string,
  input: { rating: number; comment: string },
): Promise<ActionResult> {
  const p = z
    .object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000) })
    .safeParse(input);
  if (!tokenSchema.safeParse(token).success) return fail("notFound");
  if (!p.success) return fail("invalidInput");
  if (!(await allow("managePerToken", token)) || !(await allow("bookPerIp", await clientIp())))
    return fail("tooMany");
  const { data, error } = await createAdminClient().rpc("public_review_submit", {
    p_token_hash: hmac(token),
    p_rating: p.data.rating,
    p_comment: p.data.comment,
  });
  if (error) return fail("generic");
  if (data === "not_found") return fail("notFound");
  if (data === "expired") return fail("reviewExpired");
  if (data === "done") return fail("reviewDone");
  return ok(undefined);
}
