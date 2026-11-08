"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type React from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { visibleSettings } from "../sections";

type Who = { isOwner: boolean; isDental: boolean };

function useActive() {
  const pathname = usePathname();
  return (href: string, also: string[] = []) =>
    [href, ...also].some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

/** The menu beside a settings section (desktop). */
export function SettingsMenu(who: Who) {
  const t = useTranslations("settingsNav");
  const isActive = useActive();
  return (
    <nav aria-label={t("label")} className="flex flex-col gap-4">
      {visibleSettings(who).map((g) => (
        <div key={g.key} className="flex flex-col gap-1">
          <p className="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t(`groups.${g.key}`)}
          </p>
          <ul className="flex flex-col gap-0.5">
            {g.sections.map(({ key, href, icon: Icon, also }) => (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={isActive(href, also) ? "page" : undefined}
                  className="flex min-h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground"
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {t(`sections.${key}.title`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** The settings home: every section with a line about what is inside. */
export function SettingsList(who: Who) {
  const t = useTranslations("settingsNav");
  return (
    <nav aria-label={t("label")} className="flex flex-col gap-6">
      {visibleSettings(who).map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t(`groups.${g.key}`)}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {g.sections.map(({ key, href, icon: Icon }) => (
              <li key={key}>
                <Link
                  href={href}
                  className="flex h-full min-h-16 items-center gap-3 rounded-xl border bg-card p-4 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{t(`sections.${key}.title`)}</span>
                    <span className="text-xs text-muted-foreground">{t(`sections.${key}.hint`)}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

/** "← Settings" above a section on phones, where the menu is not shown. */
export function SettingsBack() {
  const t = useTranslations("settingsNav");
  const pathname = usePathname();
  if (pathname === "/settings") return null;
  return (
    <Link
      href="/settings"
      className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {t("back")}
    </Link>
  );
}

/**
 * Settings frame: the section menu on the left (desktop) and "← Settings" on
 * phones. The settings home shows the full list instead, so no menu there.
 */
export function SettingsFrame({ children, ...who }: Who & { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/settings") return <>{children}</>;
  return (
    <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8">
      <aside className="hidden md:block">
        <div className="sticky top-6">
          <SettingsMenu {...who} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col gap-2">
        <SettingsBack />
        {children}
      </div>
    </div>
  );
}
