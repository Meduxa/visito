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
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  tone?: keyof typeof chip;
  /** e.g. the change against the previous period */
  extra?: ReactNode;
}) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5",
            chip[tone],
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
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
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {extra}
    </Card>
  );
}
