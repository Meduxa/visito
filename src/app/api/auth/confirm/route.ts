import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/features/auth/schema";
import { locales } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

// Where the links in sign-in emails land (confirm the address, new password,
// changed address). The email carries a one-time token; checking it here signs
// the person in on this device, then they continue to `next` (our own pages only).
// Links made by Supabase's default emails arrive with ?code= instead: handled too.
const TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite", "magiclink"];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"), "/ka/dashboard");
  const first = next.split("/")[1];
  const locale = (locales as readonly string[]).includes(first) ? first : "ka";
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const supabase = await createClient();

  if (tokenHash && type && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  // used, expired, or opened in another browser: sign in (or ask for a new link)
  const back =
    type === "recovery" ? `/${locale}/forgot-password?link=expired` : `/${locale}/login?link=expired`;
  return NextResponse.redirect(new URL(back, url.origin));
}
