import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Levan's platform admin area. Anyone else gets "not found": the page does not
// even reveal that it exists. Every query also checks is_platform_admin() in the database.
export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);
  const { data: isAdmin } = await (await createClient()).rpc("is_platform_admin");
  if (isAdmin !== true) notFound();
  const t = await getTranslations("platform");

  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <header className="sticky top-0 z-30 border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <BrandLogo variant="mark" className="h-8" />
            <span className="font-semibold">{t("title")}</span>
          </Link>
          <nav aria-label={t("title")} className="flex flex-wrap gap-4 text-sm">
            <Link href="/admin" className="hover:underline">
              {t("nav.businesses")}
            </Link>
            <Link href="/admin/plans" className="hover:underline">
              {t("nav.plans")}
            </Link>
            <Link href="/admin/sms" className="hover:underline">
              {t("nav.sms")}
            </Link>
            <Link href="/admin/sms-texts" className="hover:underline">
              {t("nav.smsTexts")}
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
              {t("nav.app")}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
