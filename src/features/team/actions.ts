"use server";

import { refusal } from "@/lib/action-context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { getEmailProvider } from "@/integrations/email";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { APP_NAME } from "@/lib/app";
import { requireUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant, isReadOnly, rememberActiveTenant } from "@/lib/tenant";
import { inviteSchema, type InviteInput } from "./schema";

export async function inviteMember(
  input: InviteInput,
): Promise<ActionResult<{ link: string; emailed: boolean }>> {
  await requireUser(await getLocale());
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");

  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role) || isReadOnly(tenant)) return fail(await refusal());

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_tenant: tenant.tenantId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) {
    if (error.code === "P0002") return fail("alreadyMember", "email");
    if (error.code === "42501") return fail(await refusal());
    console.error("create_invitation failed", error.code);
    return fail("generic");
  }

  const locale = await getLocale();
  const link = `${publicEnv.NEXT_PUBLIC_APP_URL}/${locale}/invite/${token}`;
  const t = await getTranslations("email.invite");
  const result = await getEmailProvider().sendTransactional({
    to: parsed.data.email,
    subject: t("subject", { business: tenant.name, app: APP_NAME }),
    text: t("body", { business: tenant.name, app: APP_NAME, link }),
    idempotencyKey: `invite:${token.slice(0, 16)}`,
  });

  revalidatePath(`/${locale}/settings/team`);
  return ok({ link, emailed: result.ok });
}

export async function revokeInvite(invitationId: string): Promise<ActionResult> {
  await requireUser(await getLocale());
  const id = z.uuid().safeParse(invitationId);
  if (!id.success) return fail("invalidInput");

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation: id.data });
  if (error) return fail(error.code === "42501" ? "notAllowed" : "generic");

  revalidatePath(`/${await getLocale()}/settings/team`);
  return ok(undefined);
}

export async function acceptInvite(token: string): Promise<ActionResult> {
  if (!/^[0-9a-f]{64}$/.test(token)) return fail("inviteInvalid");
  const locale = await getLocale();
  await requireUser(locale, `/${locale}/invite/${token}`);

  const supabase = await createClient();
  const { data: tenantId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) {
    if (error.code === "42501")
      return fail(error.message.includes("another email") ? "inviteWrongEmail" : "notSignedIn");
    return fail("inviteInvalid");
  }

  await rememberActiveTenant(tenantId);
  redirect(`/${locale}/dashboard`);
}
