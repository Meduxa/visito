import { Info } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CompanyFooter } from "@/components/company-footer";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { fullDate } from "@/lib/date-format";

// Terms of Service, Privacy Policy, Data Processing Agreement, Payments and Refunds
// (decision 035). The texts come from docs/legal/visito-legal.{ka,en}.json and live in
// messages/*.json → legal; Russian shows the English text with a note for now.
const DOCS = ["terms", "privacy", "dpa", "payments"] as const;
type Doc = (typeof DOCS)[number];
const VERSION = "2026-11-14";

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/legal/[doc]">) {
  const { locale, doc } = await params;
  if (!(DOCS as readonly string[]).includes(doc)) return {};
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t(`${doc as Doc}.title`) };
}

/** A section's text: lines are paragraphs; lines starting with "- " form a list. */
function Body({ text }: { text: string }) {
  const blocks: (string | string[])[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("- ")) {
      const last = blocks.at(-1);
      if (Array.isArray(last)) last.push(line.slice(2));
      else blocks.push([line.slice(2)]);
    } else if (line.trim()) blocks.push(line);
  }
  return (
    <>
      {blocks.map((b, i) =>
        Array.isArray(b) ? (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
            {b.map((li) => (
              <li key={li}>{li}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="text-sm leading-relaxed">
            {b}
          </p>
        ),
      )}
    </>
  );
}

export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[doc]">) {
  const { locale, doc } = await params;
  if (!(DOCS as readonly string[]).includes(doc)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  const sections = t.raw(`legal.${doc as Doc}.sections`) as { h: string; p: string }[];
  // Russian: the English text for now, with a note (Levan asked for Georgian and English)
  const notice = locale === "ru" ? t("legal.englishOnly") : null;

  return (
    <Card className="gap-5 p-5 md:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t(`legal.${doc as Doc}.title`)}</h1>
        <p className="text-xs text-muted-foreground">
          {t("legal.updated", { date: fullDate(t, VERSION) })} · {t("legal.version", { version: VERSION })}
        </p>
      </div>
      {notice && (
        <p role="note" className="flex gap-2 rounded-lg bg-muted p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {notice}
        </p>
      )}
      {sections.map((s) => (
        <section key={s.h} className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{s.h}</h2>
          <Body text={s.p} />
        </section>
      ))}
      <nav
        aria-label={t("company.legalNav")}
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
