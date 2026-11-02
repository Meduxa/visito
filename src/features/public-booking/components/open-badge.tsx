"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { openNow, type OpenNow } from "../open-now";

// Worked out in the visitor's browser (the page itself may be cached), and only
// after the page has loaded, so server and browser render the same HTML.
export function OpenBadge({
  hours,
  timeZone,
  className,
}: {
  hours: Record<number, [string, string][]>;
  timeZone: string;
  className?: string;
}) {
  const t = useTranslations("publicBooking");
  const [state, setState] = useState<OpenNow | null>(null);
  useEffect(() => {
    const update = () => setState(openNow(hours, timeZone, new Date()));
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [hours, timeZone]);
  if (!state) return null;
  const today = state.today.map(([s, e]) => `${s}–${e}`).join(", ");
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Clock className="size-4" aria-hidden />
      <span aria-hidden className={cn("size-2 rounded-full", state.open ? "bg-success" : "bg-destructive")} />
      {state.open ? t("openNow") : t("closedNow")}
      {" · "}
      {today ? t("todayHours", { hours: today }) : t("closedToday")}
    </span>
  );
}
