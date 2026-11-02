import {
  Activity,
  Baby,
  Bath,
  Brush,
  Droplet,
  Droplets,
  Eye,
  Flame,
  Footprints,
  Gift,
  Hand,
  Leaf,
  Palette,
  PenTool,
  ScanFace,
  Scissors,
  Smile,
  Sparkles,
  Stethoscope,
  Sun,
  Syringe,
  ToothbrushSparkles,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryIconKey, type CategoryIconKey } from "../category-icon";

const ICONS: Record<CategoryIconKey, LucideIcon> = {
  lymph: Droplets,
  pedicure: Footprints,
  nails: Hand,
  laser: Zap,
  wax: Droplet,
  injection: Syringe,
  massage: Waves,
  device: Activity,
  color: Palette,
  hair: Scissors,
  lashes: Eye,
  makeup: Brush,
  face: ScanFace,
  body: Flame,
  tan: Sun,
  spa: Bath,
  dentalCare: ToothbrushSparkles,
  dental: Smile,
  consult: Stethoscope,
  tattoo: PenTool,
  kids: Baby,
  gift: Gift,
  care: Leaf,
  other: Sparkles,
};

/** The category's icon in a soft circle in the business's theme colour. */
export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[categoryIconKey(name)];
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground",
        className,
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.75} />
    </span>
  );
}
