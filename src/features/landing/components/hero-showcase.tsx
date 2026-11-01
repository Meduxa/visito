"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SLIDES = ["calendar", "reports"] as const;
const EVERY_MS = 5000;

// Hero pictures: the calendar and the reports take turns every 5 seconds (or by
// clicking their names); the salon website on a phone stays in front. Turning
// stops while the mouse or keyboard focus is on it, and for people who switched
// animations off.
export function HeroShowcase() {
  const t = useTranslations("landing.shots");
  const locale = useLocale();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // restarts after every change, so a click gets the full 5 seconds
    const id = window.setTimeout(() => setCurrent((c) => (c + 1) % SLIDES.length), EVERY_MS);
    return () => window.clearTimeout(id);
  }, [current, paused]);

  return (
    <div
      className="mx-auto flex w-full max-w-xl flex-col gap-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="mx-auto flex gap-1 rounded-full border bg-card p-1"
      >
        {SLIDES.map((s, i) => (
          <button
            key={s}
            type="button"
            role="tab"
            id={`hero-tab-${s}`}
            aria-selected={current === i}
            aria-controls="hero-slides"
            onClick={() => setCurrent(i)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              current === i
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`tabs.${s}`)}
          </button>
        ))}
      </div>
      <div
        id="hero-slides"
        role="tabpanel"
        aria-labelledby={`hero-tab-${SLIDES[current]}`}
        className="relative pb-8 md:pb-0"
      >
        <div className="relative">
          {SLIDES.map((s, i) => (
            <Image
              key={s}
              src={`/landing/${s}-${locale}.webp`}
              alt={t(s)}
              width={1280}
              height={800}
              priority={i === 0}
              aria-hidden={current !== i}
              className={cn(
                "rounded-xl border shadow-lg transition-opacity duration-700 ease-in-out",
                i > 0 && "absolute inset-0",
                current === i ? "opacity-100" : "opacity-0",
              )}
            />
          ))}
        </div>
        <Image
          src={`/landing/booking-${locale}.webp`}
          alt={t("booking")}
          width={390}
          height={844}
          className="absolute right-0 bottom-0 w-[30%] rounded-2xl border-4 border-card shadow-xl lg:bottom-[-12%]"
        />
      </div>
    </div>
  );
}
