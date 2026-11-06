import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Browser security headers on every response (docs/security-review.md).
// Scripts and connections only from this site and our Supabase project; the app
// can't be framed by other sites. 'unsafe-inline' is needed for Next.js's inline
// bootstrap scripts until we move to per-request nonces.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// error reports go to the Sentry project in the DSN (only when it is set)
const sentryHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SENTRY_DSN
      ? `https://${new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).host}`
      : "";
  } catch {
    return "";
  }
})();
const dev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabase.replace(/^https/, "wss")} ${sentryHost}${dev ? " ws:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }, // ignored on http://localhost
];

const nextConfig: NextConfig = {
  // Off on purpose: almost every page depends on the signed-in user and
  // tenant, so there is nothing to prerender. See docs/decisions/001.
  cacheComponents: false,
  // Dev logging prints server action arguments in plain text — that includes
  // passwords and clients' personal data. Never log them.
  logging: { serverFunctions: false },
  poweredByHeader: false,
  // short salon addresses on this laptop: orchidea.localhost:3000
  allowedDevOrigins: ["*.localhost"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // the service worker must always be fetched fresh, or app updates would hang on old code
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
