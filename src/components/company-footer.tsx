import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CardMarks } from "@/components/card-marks";
import { Link } from "@/i18n/navigation";
import { COMPANY } from "@/lib/company";

// Company details, card marks and the legal links: what card payment providers
// (Flitt) look for on the website. On the main page and the legal pages.
export async function CompanyFooter() {
  const t = await getTranslations();
  const lines = [
    COMPANY.legalName,
    COMPANY.idCode && t("company.idCode", { code: COMPANY.idCode }),
    COMPANY.address,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-3 text-xs text-muted-foreground" data-testid="company-footer">
      {(lines.length > 0 || COMPANY.phone || COMPANY.email) && (
        <address className="flex flex-wrap gap-x-4 gap-y-1 not-italic">
          {lines.map((l) => (
            <span key={l}>{l}</span>
          ))}
          {COMPANY.phone && (
            <a href={`tel:${COMPANY.phone.replace(/\s/g, "")}`} className="underline">
              {COMPANY.phone}
            </a>
          )}
          {COMPANY.email && (
            <a href={`mailto:${COMPANY.email}`} className="underline">
              {COMPANY.email}
            </a>
          )}
        </address>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <CardMarks className="flex gap-1.5" />
        <span className="flex items-center gap-1">
          <ShieldCheck className="size-4" aria-hidden />
          {t("company.securePayment")}
        </span>
      </div>
      <nav aria-label={t("company.legalNav")} className="flex flex-wrap gap-x-4 gap-y-1">
        {(["terms", "payments", "privacy", "dpa"] as const).map((d) => (
          <Link key={d} href={`/legal/${d}`} className="underline">
            {t(`legal.links.${d}`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
