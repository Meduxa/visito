import "server-only";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { publicEnv } from "@/lib/env";
import { shortUrl, siteDomain } from "@/lib/site";
import { canManage, getActiveTenant } from "@/lib/tenant";
import type { SettingsSectionKey } from "./sections";

/** Owner/admin only (or owner only / dental only); everyone else goes elsewhere. */
export async function requireSettingsAccess(locale: string, only?: "owner" | "dental") {
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/dashboard`);
  if (only === "owner" && tenant.role !== "owner") redirect(`/${locale}/settings`);
  if (only === "dental" && tenant.type !== "dental") redirect(`/${locale}/settings`);
  return tenant;
}

/** Page title and the header text of a section. */
export async function sectionText(locale: string, key: SettingsSectionKey) {
  const t = await getTranslations({ locale, namespace: "settingsNav.sections" });
  return { title: t(`${key}.title`), description: t(`${key}.hint`) };
}

/**
 * The public booking address: the short one (name.visito.ge) when switched on,
 * else the long link. Language-neutral: it opens in Georgian, clients can switch.
 */
export function bookingUrl(slug: string) {
  return (
    shortUrl(slug, siteDomain(), publicEnv.NEXT_PUBLIC_APP_URL.startsWith("https")) ??
    `${publicEnv.NEXT_PUBLIC_APP_URL}/book/${slug}`
  );
}

/** The booking form made for a frame on the salon's own website (decision 023). */
export const embedUrl = (slug: string, locale: string) =>
  `${publicEnv.NEXT_PUBLIC_APP_URL}/${locale}/embed/${slug}`;

export const photoUrl = (path: string) =>
  `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/business-photos/${path}`;
