import {
  CalendarDays,
  Check,
  Globe,
  MessageSquareText,
  Receipt,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Users,
} from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { APP_NAME } from "@/lib/app";
import type { LandingPlan } from "../queries";
import { PricingSection } from "./pricing-section";

const FEATURES = [
  { key: "website", icon: Globe },
  { key: "booking", icon: CalendarDays },
  { key: "sms", icon: MessageSquareText },
  { key: "clients", icon: Users },
  { key: "checkout", icon: Receipt },
  { key: "team", icon: Smartphone },
  { key: "dental", icon: Stethoscope },
  { key: "privacy", icon: ShieldCheck },
] as const;
const FAQ = ["card", "phone", "sms", "data", "switch", "dental"] as const;

// Bookeria's own front page (bookeria.ge): what it does, why it is different,
// prices and questions — with one action everywhere: start the free trial.
export async function LandingPage({
  locale,
  plans,
  demoUrl,
}: {
  locale: string;
  plans: LandingPlan[];
  demoUrl: string | null;
}) {
  const t = await getTranslations("landing");
  const tl = await getTranslations("legal.links");
  const shot = (name: "booking" | "calendar") => `/landing/${name}-${locale}.webp`;
  const start = (
    <Button asChild className="h-12 px-6 text-base">
      <Link href="/signup">{t("cta")}</Link>
    </Button>
  );

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link
            href="/"
            className="mr-auto shrink-0 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {/* narrow phones: just the "b." mark, so the bar never pushes the page wider */}
            <BrandLogo variant="mark" className="h-8 sm:hidden" />
            <BrandLogo className="hidden h-8 sm:block" />
          </Link>
          <nav aria-label={t("navLabel")} className="hidden items-center gap-1 lg:flex">
            {(["features", "pricing", "faq"] as const).map((id) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {t(`nav.${id}`)}
              </a>
            ))}
          </nav>
          <LanguageSwitcher />
          <Button variant="ghost" asChild className="h-10">
            <Link href="/login">{t("signIn")}</Link>
          </Button>
          <Button asChild className="hidden h-10 sm:inline-flex">
            <Link href="/signup">{t("ctaShort")}</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div className="flex flex-col gap-5">
            <p className="text-sm font-medium text-accent-foreground">{t("hero.kicker")}</p>
            <h1 className="text-3xl leading-tight font-semibold text-balance md:text-4xl xl:text-5xl">
              {t("hero.title")}
            </h1>
            <p className="text-lg text-muted-foreground">{t("hero.subtitle")}</p>
            <div className="flex flex-wrap items-center gap-3">
              {start}
              {demoUrl && (
                <Button variant="outline" asChild className="h-12 px-6 text-base">
                  <a href={demoUrl} target="_blank" rel="noopener noreferrer">
                    {t("demo")}
                  </a>
                </Button>
              )}
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {(["noCard", "languages", "eu"] as const).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <Check className="size-4 text-primary" aria-hidden />
                  {t(`hero.${k}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-xl pb-8 md:pb-0">
            <Image
              src={shot("calendar")}
              alt={t("shots.calendar")}
              width={1280}
              height={800}
              priority
              className="rounded-xl border shadow-lg"
            />
            <Image
              src={shot("booking")}
              alt={t("shots.booking")}
              width={390}
              height={844}
              className="absolute right-0 bottom-0 w-[30%] rounded-2xl border-4 border-card shadow-xl lg:bottom-[-12%]"
            />
          </div>
        </section>

        <section id="features" className="scroll-mt-20 bg-muted/40 py-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4">
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 className="text-2xl font-semibold md:text-3xl">{t("features.title")}</h2>
              <p className="text-muted-foreground">{t("features.subtitle")}</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ key, icon: Icon }) => (
                <li key={key}>
                  {/* under the mouse the icon turns solid green and pops a little (no movement
                      for people who switched animations off) */}
                  <Card className="group h-full gap-3 p-5 transition-shadow duration-200 hover:shadow-md">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-[background-color,color,transform] duration-300 ease-out group-hover:bg-primary group-hover:text-primary-foreground motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-6">
                      <Icon
                        className="size-5 transition-transform duration-300 ease-out motion-safe:group-hover:scale-110"
                        aria-hidden
                      />
                    </span>
                    <h3 className="font-semibold">{t(`features.${key}.title`)}</h3>
                    <p className="text-sm text-muted-foreground">{t(`features.${key}.text`)}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold md:text-3xl">{t("yours.title")}</h2>
            <p className="text-muted-foreground">{t("yours.text")}</p>
            <ul className="flex flex-col gap-2">
              {(["noCompetitors", "export", "law"] as const).map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  {t(`yours.${k}`)}
                </li>
              ))}
            </ul>
          </div>
          <ol className="flex flex-col gap-3">
            {([1, 2, 3] as const).map((n) => (
              <li key={n}>
                <Card className="flex-row items-start gap-4 p-5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                    {n}
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold">{t(`steps.${n}.title`)}</h3>
                    <p className="text-sm text-muted-foreground">{t(`steps.${n}.text`)}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" className="scroll-mt-20 bg-muted/40 py-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4">
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 className="text-2xl font-semibold md:text-3xl">{t("pricing.title")}</h2>
              <p className="text-muted-foreground">{t("pricing.subtitle")}</p>
            </div>
            {plans.length > 0 ? (
              <PricingSection plans={plans} />
            ) : (
              <>
                <Card className="max-w-2xl gap-3 p-6">
                  <h3 className="text-lg font-semibold">{t("pricing.trialTitle")}</h3>
                  <p className="text-muted-foreground">{t("pricing.soon")}</p>
                </Card>
                <div>{start}</div>
              </>
            )}
          </div>
        </section>

        <section id="faq" className="mx-auto flex max-w-3xl scroll-mt-20 flex-col gap-6 px-4 py-16">
          <h2 className="text-2xl font-semibold md:text-3xl">{t("faq.title")}</h2>
          <div className="flex flex-col gap-2">
            {FAQ.map((k) => (
              <details key={k} className="group rounded-xl border bg-card px-4 py-3">
                <summary className="flex min-h-8 cursor-pointer items-center font-medium">
                  {t(`faq.${k}.q`)}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`faq.${k}.a`)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-brand py-14 text-brand-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 md:flex-row md:items-center">
            <div className="flex flex-1 flex-col gap-1">
              <h2 className="text-2xl font-semibold">{t("final.title")}</h2>
              <p className="opacity-90">{t("final.text")}</p>
            </div>
            {start}
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4">
          <BrandLogo className="h-6" />
          <span className="mr-auto">
            © {new Date().getFullYear()} {APP_NAME}
          </span>
          <Link href="/legal/privacy" className="underline">
            {tl("privacy")}
          </Link>
          <Link href="/legal/terms" className="underline">
            {tl("terms")}
          </Link>
          <Link href="/legal/dpa" className="underline">
            {tl("dpa")}
          </Link>
          <Link href="/login" className="underline">
            {t("signIn")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
