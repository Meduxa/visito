"use client";

import { Plus, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { DetailPanel } from "@/components/detail-panel";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { WEEKDAYS } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { StaffMember } from "../queries";
import { StaffAvatar } from "./staff-avatar";
import { StaffForm } from "./staff-form";

export function StaffList({
  staff,
  canManage,
  isDental,
  top,
}: {
  staff: StaffMember[];
  canManage: boolean;
  isDental: boolean;
  /** shown under the page title (time-off requests, decision 029) */
  top?: ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title={t("staff.title")}
        description={t("staff.subtitle")}
        actions={
          canManage && (
            <Button className="h-11 md:h-9" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              {t("staff.new")}
            </Button>
          )
        }
      />
      {top && <div className="mb-5">{top}</div>}

      {staff.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={<UserRound />}
            title={t("staff.emptyTitle")}
            description={t("staff.emptyBody")}
            action={
              canManage && (
                <Button className="h-11 md:h-9" onClick={() => setCreating(true)}>
                  {t("staff.new")}
                </Button>
              )
            }
          />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <li key={s.id}>
              <Link
                href={`/staff/${s.id}`}
                className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex items-center gap-3">
                  <StaffAvatar name={s.displayName} color={s.color} photoUrl={s.photoUrl} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium break-words">{s.displayName}</span>
                    <span className="text-sm text-muted-foreground">
                      {s.position || t(`staff.positionTypes.${s.positionType}`)}
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {!s.active && <StatusPill tone="neutral">{t("staff.inactive")}</StatusPill>}
                  {s.active && !s.bookableOnline && (
                    <StatusPill tone="warning">{t("staff.notOnline")}</StatusPill>
                  )}
                  <StatusPill tone="brand">{t("staff.servicesCount", { count: s.serviceCount })}</StatusPill>
                </span>
                {s.workDays.length ? (
                  <span className="flex gap-1" aria-label={t("staff.tabs.schedule")}>
                    {WEEKDAYS.map((d) => (
                      <span
                        key={d}
                        className={cn(
                          "flex h-6 min-w-8 items-center justify-center rounded-md px-1 text-[0.7rem]",
                          s.workDays.includes(d)
                            ? "bg-accent font-medium text-accent-foreground"
                            : "bg-muted text-muted-foreground line-through",
                        )}
                      >
                        {t(`weekdays.short.${d}`)}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("staff.noSchedule")}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <DetailPanel open={creating} onOpenChange={setCreating} title={t("staff.new")}>
          {creating && (
            <StaffForm staff={null} isDental={isDental} onSaved={(id) => router.push(`/staff/${id}`)} />
          )}
        </DetailPanel>
      )}
    </>
  );
}
