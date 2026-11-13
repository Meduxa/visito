"use client";

import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// The public booking link with copy / open, and a QR code to print.
// `qrSvg` is generated on the server by the qrcode library from our own URL.
export function ShareCard({
  url,
  slug,
  qrSvg,
  title,
  hint,
}: {
  url: string;
  slug: string;
  qrSvg: string;
  title?: string;
  hint?: string;
}) {
  const t = useTranslations("settings.share");
  const [copied, setCopied] = useState(false);

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([qrSvg], { type: "image/svg+xml" }));
    a.download = `${slug}-qr.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card className="gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title ?? t("title")}</h2>
        <p className="text-sm text-muted-foreground">{hint ?? t("hint")}</p>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">{url}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          className="h-11 md:h-9"
          onClick={async () => {
            await navigator.clipboard.writeText(url).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
        </Button>
        <Button variant="outline" asChild className="h-11 md:h-9">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            {t("open")}
          </a>
        </Button>
      </div>
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center">
        <div
          role="img"
          aria-label={t("qr")}
          className="size-36 shrink-0 rounded-lg bg-white p-2 [&_svg]:size-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t("qrHint")}</p>
          <Button variant="outline" className="h-11 self-start md:h-9" onClick={download}>
            <Download aria-hidden />
            {t("download")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
