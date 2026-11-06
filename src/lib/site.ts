// Short addresses: every business's website at {slug}.{site domain}
// (decision 016). The site domain is visito.ge in production; empty = off.

// Names a business may not take as its address (the database refuses them too).
export const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "auth",
  "book",
  "login",
  "signup",
  "dashboard",
  "mail",
  "email",
  "smtp",
  "help",
  "support",
  "status",
  "blog",
  "docs",
  "cdn",
  "static",
  "assets",
  "media",
  "img",
  "dev",
  "staging",
  "test",
  "demo",
  "preview",
  "m",
  "u",
  "legal",
  "bookeria",
  "visito",
  "billing",
  "pay",
  "payments",
]);

/** The business slug when the request came to {slug}.{siteDomain}, else null. */
export function slugFromHost(host: string | null, siteDomain: string): string | null {
  if (!host || !siteDomain) return null;
  const h = host.toLowerCase();
  const suffix = `.${siteDomain.toLowerCase()}`;
  if (!h.endsWith(suffix)) return null;
  const sub = h.slice(0, -suffix.length);
  if (!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(sub) || RESERVED_SLUGS.has(sub)) return null;
  return sub;
}

/** The business's short address, or null when short addresses are off. */
export function shortUrl(slug: string, siteDomain: string, secure: boolean): string | null {
  if (!siteDomain) return null;
  return `${secure ? "https" : "http"}://${slug}.${siteDomain}`;
}

/** Server side: the configured site domain (localhost in development). */
export function siteDomain(): string {
  return process.env.SITE_DOMAIN || (process.env.NODE_ENV === "development" ? "localhost:3000" : "");
}
