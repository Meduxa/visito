import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RegisterServiceWorker } from "@/components/pwa";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import { APP_NAME } from "@/lib/app";
import "../globals.css";

// FiraGO (SIL OFL) covers Georgian, Latin and Cyrillic in one family (decision 022).
// The files are self-hosted and trimmed to those alphabets; see src/app/fonts/.
const firago = localFont({
  variable: "--font-firago",
  display: "swap",
  src: [
    { path: "../fonts/FiraGO-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/FiraGO-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/FiraGO-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/FiraGO-Bold.woff2", weight: "700", style: "normal" },
  ],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
    description: t("description"),
    icons: { apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#16233A" };

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${firago.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <NextIntlClientProvider>
            {children}
            <Toaster />
            <RegisterServiceWorker />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
