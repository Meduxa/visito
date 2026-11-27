"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// A 24-hour time field ("HH:MM"). The browser's own time field follows the
// phone's language and shows 10:00 AM / 07:00 PM on English phones, so this is
// two plain lists (hours, minutes) — on a phone they open as scroll wheels.
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

export function TimeInput({
  id,
  value,
  onChange,
  step = 5,
  className,
  disabled,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** minutes between choices */
  step?: number;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const t = useTranslations("common");
  const [h = "", m = ""] = /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5).split(":") : [];
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => String(i * step).padStart(2, "0"));
  // a saved time off the step stays visible
  if (m && !minutes.includes(m)) {
    minutes.push(m);
    minutes.sort();
  }
  const select =
    "h-full min-w-0 appearance-none bg-transparent px-1.5 text-center tabular-nums outline-none focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed";

  return (
    <div
      role="group"
      data-slot="time-input"
      data-value={value}
      aria-label={ariaLabel}
      data-invalid={ariaInvalid || undefined}
      className={cn(
        "inline-flex h-9 w-32 items-center justify-center gap-0.5 rounded-lg border border-input bg-transparent text-sm data-invalid:border-destructive dark:bg-input/30",
        disabled && "opacity-50",
        className,
      )}
    >
      <select
        id={id}
        value={h}
        disabled={disabled}
        // without aria-label the field's own <label htmlFor={id}> names the hours list
        aria-label={ariaLabel ? `${ariaLabel}, ${t("timeHours")}` : undefined}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        onChange={(e) => onChange(`${e.target.value}:${m || "00"}`)}
        className={select}
      >
        {!h && <option value="">--</option>}
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <span aria-hidden>:</span>
      <select
        value={m}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel}, ${t("timeMinutes")}` : t("timeMinutes")}
        onChange={(e) => onChange(`${h || "00"}:${e.target.value}`)}
        className={select}
      >
        {!m && <option value="">--</option>}
        {minutes.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </div>
  );
}
