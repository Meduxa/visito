import { ChevronRight, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { PublicBranch } from "../queries";

// Several branches (decision 032): the client picks one before anything else.
// Each choice is a plain link (?branch=…), the same address as the branch's own link and QR code.
export async function BranchPicker({ branches, basePath }: { branches: PublicBranch[]; basePath: string }) {
  const t = await getTranslations("publicBooking.branches");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 md:px-0">
      <Card id="book" className="gap-4 p-4 md:p-6">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
        </div>
        <ul className="flex flex-col gap-2" data-testid="branch-picker">
          {branches.map((b) => (
            <li key={b.slug}>
              <Link
                href={`${basePath}?branch=${b.slug}`}
                className="flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50"
              >
                <MapPin aria-hidden className="size-5 shrink-0 text-primary" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{b.name}</span>
                  {b.address && <span className="text-sm text-muted-foreground">{b.address}</span>}
                </span>
                <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
