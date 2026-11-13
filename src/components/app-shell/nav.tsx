"use client";

import {
  Banknote,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  LayoutDashboard,
  Menu,
  Scissors,
  Settings,
  Star,
  Stethoscope,
  UserRound,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { RailTip, SIDEBAR_LABEL } from "./sidebar";

type BusinessType = "salon" | "dental";

function groups(type: BusinessType, canManage: boolean, hasProfile: boolean) {
  return [
    {
      key: "main",
      items: [
        { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
        ...(hasProfile ? [{ href: "/my-day", key: "myDay", icon: CalendarClock }] : []),
        { href: "/calendar", key: "calendar", icon: CalendarDays },
      ],
    },
    {
      key: "business",
      items: [
        { href: "/clients", key: type === "dental" ? "patients" : "clients", icon: Users },
        { href: "/services", key: "services", icon: type === "dental" ? Stethoscope : Scissors },
        { href: "/staff", key: "staff", icon: UserRound },
        { href: "/reviews", key: "reviews", icon: Star },
        ...(canManage
          ? [
              { href: "/cash", key: "cash", icon: Banknote },
              { href: "/reports", key: "reports", icon: ChartColumn },
              { href: "/payroll", key: "payroll", icon: Wallet },
            ]
          : []),
      ],
    },
    {
      key: "settings",
      items: [
        // managers: every section (team, SMS…) lives under Settings (decision 021)
        canManage
          ? { href: "/settings", key: "settings", icon: Settings }
          : { href: "/settings/team", key: "team", icon: UsersRound },
      ],
    },
  ] as const;
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  type,
  canManage,
  hasProfile,
}: {
  type: BusinessType;
  canManage: boolean;
  hasProfile: boolean;
}) {
  const t = useTranslations("nav");
  const isActive = useIsActive();
  return (
    <nav aria-label={t("main")} className="flex flex-col gap-5">
      {groups(type, canManage, hasProfile).map((group) => (
        <div key={group.key} className="flex flex-col gap-0.5">
          {/* the group title; a thin line in its place when folded (same height, nothing moves) */}
          <div className="relative h-5 px-3">
            <p className={cn("text-xs font-medium text-muted-foreground", SIDEBAR_LABEL)}>
              {t(`groups.${group.key}`)}
            </p>
            <span
              aria-hidden
              className="absolute inset-x-2 top-2 h-px bg-border opacity-0 transition-opacity duration-300 group-data-[collapsed=true]/sidebar:opacity-100"
            />
          </div>
          {group.items.map(({ href, key, icon: Icon }) => (
            <RailTip key={href} label={t(key)}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  // folded: a 40 px square around the icon, so the active background sits exactly on it
                  "flex min-h-9 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 outline-none group-data-[collapsed=true]/sidebar:size-10 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive(href) &&
                    "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className={SIDEBAR_LABEL}>{t(key)}</span>
              </Link>
            </RailTip>
          ))}
        </div>
      ))}
    </nav>
  );
}

// Phone: max 5 items; "More" leads to the remaining sections.
// Staff with a profile start from "My day" instead of the dashboard.
export function BottomNav({ type, myDayFirst }: { type: BusinessType; myDayFirst: boolean }) {
  const t = useTranslations("nav");
  const isActive = useIsActive();
  const items = [
    myDayFirst
      ? ({ href: "/my-day", key: "myDay", icon: CalendarClock } as const)
      : ({ href: "/dashboard", key: "dashboard", icon: LayoutDashboard } as const),
    { href: "/calendar", key: "calendar", icon: CalendarDays },
    { href: "/clients", key: type === "dental" ? "patients" : "clients", icon: Users },
    { href: "/services", key: "services", icon: type === "dental" ? Stethoscope : Scissors },
    { href: "/more", key: "more", icon: Menu },
  ] as const;
  const moreActive = ["/more", "/staff", "/reviews", "/settings", "/cash", "/reports", "/payroll"].some((p) =>
    isActive(p),
  );

  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, key, icon: Icon }) => {
          const active = href === "/more" ? moreActive : isActive(href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[0.7rem] leading-tight text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active && "font-medium text-primary",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="line-clamp-1 text-center">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// The "More" page on phones lists what doesn't fit in the bottom bar.
export function MoreNavList({ canManage }: { canManage: boolean }) {
  const t = useTranslations("nav");
  const items = [
    { href: "/staff", key: "staff", icon: UserRound },
    { href: "/reviews", key: "reviews", icon: Star },
    ...(canManage
      ? [
          { href: "/cash", key: "cash", icon: Banknote },
          { href: "/reports", key: "reports", icon: ChartColumn },
          { href: "/payroll", key: "payroll", icon: Wallet },
        ]
      : []),
    canManage
      ? { href: "/settings", key: "settings", icon: Settings }
      : { href: "/settings/team", key: "team", icon: UsersRound },
  ] as const;
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card">
      {items.map(({ href, key, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            className="flex min-h-12 items-center gap-3 px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            {t(key)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
