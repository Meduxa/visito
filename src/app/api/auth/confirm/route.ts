import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/features/auth/schema";
import { locales } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { siteDomain } from "@/lib/site";
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
  // the address the person actually opened (behind Netlify, request.url carries
  // Netlify's internal host; the session cookie belongs to the public one)
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  // only our own addresses (the app's, a business's short address, or this laptop)
  const app = new URL(publicEnv.NEXT_PUBLIC_APP_URL);
  const domain = siteDomain();
  const ours =
    host === app.host ||
    (domain && (host === domain || host.endsWith(`.${domain}`))) ||
    /^localhost(:\d+)?$/.test(host);
  const origin = ours ? `${proto === "http" ? "http" : "https"}://${host}` : app.origin;

  if (tokenHash && type && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  // used, expired, or opened in another browser: sign in (or ask for a new link)
  const back =
    type === "recovery" ? `/${locale}/forgot-password?link=expired` : `/${locale}/login?link=expired`;
  return NextResponse.redirect(new URL(back, origin));
}
