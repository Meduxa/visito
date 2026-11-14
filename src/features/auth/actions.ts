"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { fail, type ActionResult } from "@/lib/action-result";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getMyTenants } from "@/lib/tenant";
import {
  forgotSchema,
  newPasswordSchema,
  safeNext,
  signInSchema,
  signUpSchema,
  type ForgotInput,
  type NewPasswordInput,
  type SignInInput,
  type SignUpInput,
} from "./schema";

// Links in sign-in emails go through /api/auth/confirm, which signs the person in
// on that device and then opens `next` (decision 034).
const emailLink = (next: string) =>
  `${publicEnv.NEXT_PUBLIC_APP_URL}/api/auth/confirm?next=${encodeURIComponent(next)}`;

export async function signIn(input: SignInInput, next?: string): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(error.code === "email_not_confirmed" ? "emailNotConfirmed" : "invalidCredentials");

  const locale = await getLocale();
  redirect(safeNext(next, `/${locale}/dashboard`));
}

export async function signUp(
  input: SignUpInput,
  next?: string,
): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");

  const locale = await getLocale();
  const target = safeNext(next, `/${locale}/onboarding`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, locale },
      emailRedirectTo: emailLink(target),
    },
  });
  if (error) {
    if (error.code === "user_already_exists") return fail("emailTaken", "email");
    if (error.code === "weak_password") return fail("passwordWeak", "password");
    console.error("signUp failed", error.code);
    return fail("generic");
  }
  // Supabase hides "already registered" behind an empty identities list.
  if (data.user && data.user.identities?.length === 0) return fail("emailTaken", "email");

  if (!data.session) return { ok: true, data: { needsConfirmation: true } };
  redirect(target);
}

// "Forgot password": always the same answer, so nobody can find out which
// addresses have an account. Supabase limits how often emails go out.
export async function requestPasswordReset(input: ForgotInput): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return fail("email", "email");
  const locale = await getLocale();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: emailLink(`/${locale}/reset-password`),
  });
  if (error && error.code !== "user_not_found") console.error("password reset email failed", error.code);
  return { ok: true, data: undefined };
}

// The new password, after the person opened the link from the email (signed in by it).
export async function setNewPassword(input: NewPasswordInput): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalidInput", "password");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("linkExpired");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return fail("samePassword", "password");
    if (error.code === "weak_password") return fail("passwordWeak", "password");
    console.error("password update failed", error.code);
    return fail("generic");
  }
  for (const t of await getMyTenants()) {
    await supabase.rpc("log_audit", {
      p_tenant: t.tenantId,
      p_action: "auth.password_changed",
      p_entity: "user",
    });
  }
  const locale = await getLocale();
  redirect(`/${locale}/dashboard`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect(`/${locale}/login`);
}

// Ends every session of this account (lost phone, shared computer) — SPEC 4.14.
// Recorded in the audit log of each business the user belongs to.
export async function signOutEverywhere() {
  const supabase = await createClient();
  for (const t of await getMyTenants()) {
    await supabase.rpc("log_audit", {
      p_tenant: t.tenantId,
      p_action: "auth.signed_out_everywhere",
      p_entity: "user",
    });
  }
  await supabase.auth.signOut({ scope: "global" });
  const locale = await getLocale();
  redirect(`/${locale}/login`);
}
