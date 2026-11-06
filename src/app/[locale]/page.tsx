import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LandingPage } from "@/features/landing/components/landing-page";
import { demoSalonExists, getLandingPlans } from "@/features/landing/queries";
import { getCurrentUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { shortUrl, siteDomain } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  return {
    title: { absolute: t("meta.title") },
    description: t("meta.description"),
    openGraph: {
      title: t("meta.title"),
      description: t("meta.description"),
      images: [`/landing/calendar-${locale}.webp`],
    },
  };
}

// visito.ge: visitors see what Visito is; signed-in people go to their work.
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getCurrentUser()) redirect(`/${locale}/dashboard`);

  const [plans, demo] = await Promise.all([getLandingPlans(), demoSalonExists()]);
  const app = publicEnv.NEXT_PUBLIC_APP_URL;
  const demoUrl = demo
    ? (shortUrl("orchidea", siteDomain(), app.startsWith("https")) ?? `${app}/${locale}/book/orchidea`)
    : null;
  return <LandingPage plans={plans} demoUrl={demoUrl} />;
}
