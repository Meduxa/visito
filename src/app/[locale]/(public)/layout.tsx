import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";

// Frame for pages clients see without signing in: online booking, manage links,
// unsubscribe, legal pages. A business's website (data-wide) uses the whole width:
// the cover runs edge to edge and the language switcher floats over it.
export default async function PublicLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="group/public relative flex flex-1 flex-col bg-muted/40 has-[[data-wide]]:bg-background">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-end px-4 pt-3 group-has-[[data-wide]]/public:absolute group-has-[[data-wide]]/public:inset-x-0 group-has-[[data-wide]]/public:top-0 group-has-[[data-wide]]/public:z-30 group-has-[[data-wide]]/public:max-w-none group-has-[[data-wide]]/public:*:rounded-full group-has-[[data-wide]]/public:*:bg-card/85 group-has-[[data-wide]]/public:*:backdrop-blur">
        <LanguageSwitcher />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-2 pb-10 has-[[data-wide]]:max-w-none has-[[data-wide]]:px-0 has-[[data-wide]]:pt-0">
        {children}
      </main>
      <footer className="flex flex-col items-center gap-2 pb-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          {t("publicBooking.poweredBy")}
          <BrandLogo className="h-5" />
        </span>
        <nav aria-label={t("legal.links.privacy")} className="flex flex-wrap justify-center gap-x-4">
          <Link href="/legal/privacy" target="_blank" className="underline">
            {t("legal.links.privacy")}
          </Link>
          <Link href="/legal/terms" target="_blank" className="underline">
            {t("legal.links.terms")}
          </Link>
        </nav>
      </footer>
    </div>
  );
}
