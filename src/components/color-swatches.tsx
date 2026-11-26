"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Static class names so Tailwind can see them; values come from design tokens.
export const SWATCH_BG: Record<string, string> = {
  green: "bg-staff-green",
  teal: "bg-staff-teal",
  sky: "bg-staff-sky",
  blue: "bg-staff-blue",
  indigo: "bg-staff-indigo",
  violet: "bg-staff-violet",
  pink: "bg-staff-pink",
  rose: "bg-staff-rose",
  orange: "bg-staff-orange",
  amber: "bg-staff-amber",
};

export function ColorSwatches({
  value,
  onChange,
  label,
  allowNone,
  noneLabel,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const t = useTranslations("colors");
  const options = [...(allowNone ? [null] : []), ...Object.keys(SWATCH_BG)];
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((c) => {
        const selected = value === c;
        return (
          <button
            key={c ?? "none"}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c ? t(c as "green") : noneLabel}
            onClick={() => onChange(c)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border-2 border-transparent outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              c ? SWATCH_BG[c] : "border-dashed border-border bg-card",
              selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            )}
          >
            {selected && <Check className={cn("size-4", c ? "text-white" : "text-foreground")} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
