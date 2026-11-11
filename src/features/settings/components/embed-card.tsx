"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Code to paste into the salon's own website (decision 023): the booking form in
// a frame, or a plain button linking to the booking page. The snippets are text
// for another site, so they carry their own inline styles (the brand navy).
export function EmbedCard({
  embedUrl,
  bookingUrl,
  name,
}: {
  embedUrl: string;
  bookingUrl: string;
  name: string;
}) {
  const t = useTranslations("settings.embed");
  const title = name.replace(/["<>&]/g, "");
  const snippets = [
    {
      key: "iframe",
      code: `<iframe src="${embedUrl}" title="${title}" loading="lazy" style="width:100%;max-width:640px;height:780px;border:0;border-radius:12px"></iframe>`,
    },
    {
      key: "button",
      code: `<a href="${bookingUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#16233A;color:#fff;font:600 16px sans-serif;text-decoration:none">${t("buttonText")}</a>`,
    },
  ] as const;

  return (
    <Card className="gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      {snippets.map((s) => (
        <Snippet key={s.key} label={t(s.key)} code={s.code} />
      ))}
      <Button variant="outline" asChild className="h-11 self-start md:h-9">
        <a href={embedUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden />
          {t("preview")}
        </a>
      </Button>
    </Card>
  );
}

function Snippet({ label, code }: { label: string; code: string }) {
  const t = useTranslations("settings.embed");
  const [copied, setCopied] = useState(false);
  const id = `embed-${label.length}-${code.length}`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        readOnly
        rows={3}
        value={code}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full resize-none rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      />
      <Button
        variant="outline"
        className="h-11 self-start md:h-9"
        onClick={async () => {
          await navigator.clipboard.writeText(code).catch(() => undefined);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
      </Button>
    </div>
  );
}
