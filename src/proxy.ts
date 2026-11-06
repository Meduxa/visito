import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { locales, routing } from "@/i18n/routing";
import { siteDomain, slugFromHost } from "@/lib/site";

const intl = createIntlMiddleware(routing);

// Pages that need a signed-in user (path without the locale prefix).
const PROTECTED = [
  /^\/dashboard/,
  /^\/onboarding/,
  /^\/settings/,
  /^\/calendar/,
  /^\/clients/,
  /^\/services/,
  /^\/staff/,
  /^\/more/,
  /^\/my-day/,
  /^\/cash/,
  /^\/reports/,
  /^\/admin/,
];

export async function proxy(request: NextRequest) {
  const slug = slugFromHost(request.headers.get("host"), siteDomain());
  if (slug) {
    const site = siteRequest(request, slug);
    if (site) return site;
  }

  const response = intl(request);
  if (response.headers.has("location")) return response;

  // Refresh the Supabase session cookie on every page request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims();

  // Optimistic redirect for page visits only. Server actions are POSTs to the
  // page URL; redirecting them returns a login page where the client expects
  // an action result. Actions check the session themselves (requireUser).
  const isPageVisit = request.method === "GET" || request.method === "HEAD";
  const [, locale, ...rest] = request.nextUrl.pathname.split("/");
  const path = `/${rest.join("/")}`;
  if (isPageVisit && !data?.claims && PROTECTED.some((re) => re.test(path))) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

// A business's short address ({slug}.visito.ge, decision 016): its home page is
// the booking page, in any language (/en, /ru). Public pages (legal texts, manage
// and unsubscribe links) work there as usual; anything else belongs to the main site.
const PUBLIC_ON_SITE = /^\/(?:legal|m|u)(?:\/|$)/;
function siteRequest(request: NextRequest, slug: string): NextResponse | null {
  const [, first = "", ...rest] = request.nextUrl.pathname.split("/");
  const locale = (locales as readonly string[]).includes(first) ? first : null;
  const path = `/${(locale ? rest : [first, ...rest]).join("/")}`.replace(/\/+$/, "") || "/";
  if (path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale ?? routing.defaultLocale}/book/${slug}`;
    return NextResponse.rewrite(url);
  }
  if (PUBLIC_ON_SITE.test(path)) return null;
  const main = new URL(request.nextUrl.pathname + request.nextUrl.search, process.env.NEXT_PUBLIC_APP_URL);
  // Next.js points redirects to "localhost" back at the current host, which would
  // loop on this laptop; there the page simply opens on the short address.
  if (main.hostname === "localhost") return null;
  return NextResponse.redirect(main);
}
