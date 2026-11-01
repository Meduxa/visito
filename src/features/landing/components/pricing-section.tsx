"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { discountedMonthly, PERIODS } from "../pricing";
import type { LandingPlan } from "../queries";

// Plan cards with a prepaid-period switch. A card turns green under the mouse (or
// while its button has keyboard focus); every button leads to the free sign-up.
const card =
  "group relative flex h-full flex-col gap-4 rounded-2xl border bg-card p-6 transition-colors duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground focus-within:border-primary focus-within:bg-primary focus-within:text-primary-foreground";
const muted =
  "text-muted-foreground group-hover:text-primary-foreground/85 group-focus-within:text-primary-foreground/85";
// The button sits on a green card while the mouse is over it, so it is white with
// green text — also when the mouse is on the button itself (its own hover colour
// would otherwise be green on green).
const onGreen =
  "group-hover:border-primary-foreground group-hover:bg-primary-foreground group-hover:text-primary group-focus-within:border-primary-foreground group-focus-within:bg-primary-foreground group-focus-within:text-primary hover:border-primary-foreground hover:bg-primary-foreground/90 hover:text-primary";

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-primary group-focus-within:bg-primary-foreground/20 group-focus-within:text-primary-foreground group-hover:bg-primary-foreground/20 group-hover:text-primary-foreground">
        <Check className="size-3.5" aria-hidden />
      </span>
      <span>{children}</span>
    </li>
  );
}

export function PricingSection({ plans }: { plans: LandingPlan[] }) {
  const t = useTranslations("landing.pricing");
  const locale = useLocale();
  const [months, setMonths] = useState<number>(1);
  const period = PERIODS.find((p) => p.months === months) ?? PERIODS[0];
  const money = (minor: number) => formatMoney(minor, `${locale}-GE`);
  const popular = plans.length > 1 ? plans[1].code : null;

  return (
    <div className="flex flex-col gap-10">
      <fieldset className="flex flex-col items-center gap-3">
        <legend className="mb-3 w-full text-center text-sm font-medium">{t("periodLabel")}</legend>
        <div className="grid w-full max-w-xl grid-cols-2 gap-1 rounded-2xl border bg-card p-1.5 sm:flex sm:rounded-full">
          {PERIODS.map((p) => (
            <label
              key={p.months}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium transition-colors has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input
                type="radio"
                name="period"
                value={p.months}
                checked={months === p.months}
                onChange={() => setMonths(p.months)}
                className="sr-only"
              />
              {t("months", { count: p.months })}
              {p.discount > 0 && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
                  −{p.discount}%
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p, i) => {
          const monthly = discountedMonthly(p.priceMinor, period.discount);
          const from = i === 0 ? 1 : (plans[i - 1].maxStaff ?? 0) + 1;
          const isPopular = p.code === popular;
          return (
            <li key={p.code} className={cn(isPopular && "md:-mt-3")}>
              <div className={cn(card, isPopular && "border-primary bg-accent/40 shadow-lg")}>
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold whitespace-nowrap text-primary-foreground group-focus-within:bg-primary-foreground group-focus-within:text-primary group-hover:bg-primary-foreground group-hover:text-primary">
                    {t("popular")}
                  </span>
                )}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <div className="flex flex-col gap-1">
                  <p>
                    <span className="text-4xl font-bold tabular-nums">{money(monthly)}</span>{" "}
                    <span className={cn("text-sm", muted)}>{t("perMonth")}</span>
                  </p>
                  {period.discount > 0 && (
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <s className={muted}>{money(p.priceMinor)}</s>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground group-focus-within:bg-primary-foreground group-focus-within:text-primary group-hover:bg-primary-foreground group-hover:text-primary">
                        {t("save", { percent: period.discount })}
                      </span>
                      <span className={muted}>
                        {t("total", { total: money(monthly * period.months), months: period.months })}
                      </span>
                    </p>
                  )}
                </div>
                <ul className="flex flex-1 flex-col gap-2.5 text-sm">
                  <Feature>
                    {p.maxStaff === null
                      ? t("staffUnlimited")
                      : from >= p.maxStaff
                        ? t("staffExactly", { count: p.maxStaff })
                        : t("staffRange", { from, to: p.maxStaff })}
                  </Feature>
                  <Feature>{t("features.online")}</Feature>
                  <Feature>{t("features.website")}</Feature>
                  <Feature>{t("features.management")}</Feature>
                  <Feature>{t("features.reports")}</Feature>
                  {p.smsPerMonth > 0 && <Feature>{t("sms", { count: p.smsPerMonth })}</Feature>}
                  {i > 0 && <Feature>{t("features.marketingSms")}</Feature>}
                  <Feature>{t("features.app")}</Feature>
                </ul>
                <Button
                  asChild
                  variant={isPopular ? "default" : "outline"}
                  className={cn("h-12 w-full rounded-full text-base", onGreen)}
                >
                  <Link href="/signup">{t("choose")}</Link>
                </Button>
              </div>
            </li>
          );
        })}
        <li className="md:col-span-2 lg:col-span-1">
          <div className={card}>
            <h3 className="text-lg font-semibold">{t("premium.name")}</h3>
            <div className="flex flex-col gap-1">
              <p className="text-2xl font-bold sm:text-3xl">{t("premium.price")}</p>
              <p className={cn("text-sm", muted)}>{t("premium.for")}</p>
            </div>
            <ul className="flex flex-1 flex-col gap-2.5 text-sm">
              {(["staff", "everything", "sms", "onboarding", "support"] as const).map((k) => (
                <Feature key={k}>{t(`premium.features.${k}`)}</Feature>
              ))}
            </ul>
            <Button asChild variant="outline" className={cn("h-12 w-full rounded-full text-base", onGreen)}>
              <Link href="/signup">{t("choose")}</Link>
            </Button>
          </div>
        </li>
      </ul>
    </div>
  );
}
