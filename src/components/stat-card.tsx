import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const chip = {
  brand: "bg-accent text-accent-foreground",
  info: "bg-info-soft text-info-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-destructive-soft text-destructive-ink",
} as const;

// Number card with a tinted icon chip and an optional arrow link (SUB QC / PolicyPilot).
export function StatCard({
  icon,
  label,
  value,
  hint,
  href,
  tone = "brand",
  extra,
  compact,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  tone?: keyof typeof chip;
  /** e.g. the change against the previous period */
  extra?: ReactNode;
  /** small, for three in a row on a phone: no icon chip on phones, smaller number */
  compact?: boolean;
}) {
  return (
    <Card className={cn("gap-3 p-4", compact && "gap-1.5 p-3 sm:gap-3 sm:p-4")}>
      {/* the label has its own line: long Georgian words do not fit next to the icon and the arrow */}
      <div className={cn("flex items-center justify-between gap-3", compact && "max-sm:hidden")}>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5",
            chip[tone],
          )}
        >
          {icon}
        </span>
        {href && (
          <Link
            href={href}
            aria-label={label}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      <span
        className={cn(
          "-mb-2 text-sm font-medium [overflow-wrap:anywhere]",
          compact && "max-sm:mb-0 max-sm:text-xs",
        )}
      >
        {label}
      </span>
      <div className={cn("text-2xl font-semibold tabular-nums", compact && "max-sm:text-xl")}>{value}</div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {extra}
    </Card>
  );
}
