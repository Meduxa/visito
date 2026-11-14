import { TriangleAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CompanyFooter } from "@/components/company-footer";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { fullDate } from "@/lib/date-format";

// Privacy policy, terms of service, payments and refunds, data processing agreement. Drafts until the
// lawyer's texts arrive (ROADMAP 6b); the texts live in messages/*.json → legal.
const DOCS = ["privacy", "terms", "payments", "dpa"] as const;
type Doc = (typeof DOCS)[number];
const UPDATED = "2026-10-26";

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/legal/[doc]">) {
  const { locale, doc } = await params;
  if (!(DOCS as readonly string[]).includes(doc)) return {};
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t(`${doc as Doc}.title`) };
}

export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[doc]">) {
  const { locale, doc } = await params;
  if (!(DOCS as readonly string[]).includes(doc)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  const sections = t.raw(`legal.${doc as Doc}.sections`) as { h: string; p: string }[];

  return (
    <Card className="gap-5 p-5 md:p-8">
      <h1 className="text-2xl font-semibold">{t(`legal.${doc as Doc}.title`)}</h1>
      <p role="note" className="flex gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning-ink">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("legal.draft")}
      </p>
      {sections.map((s) => (
        <section key={s.h} className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{s.h}</h2>
          <p className="text-sm leading-relaxed">{s.p}</p>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">{t("legal.updated", { date: fullDate(t, UPDATED) })}</p>
      <nav
        aria-label={t("legal.links.privacy")}
        className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-sm"
      >
        {DOCS.filter((d) => d !== doc).map((d) => (
          <Link key={d} href={`/legal/${d}`} className="underline">
            {t(`legal.links.${d}`)}
          </Link>
        ))}
      </nav>
      <CompanyFooter />
    </Card>
  );
}
