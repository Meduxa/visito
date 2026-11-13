"use client";

// /admin/sms-texts (decision 033): Visito's SMS texts for every business, per language.
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { renderSms, SMS_VARIABLES, unknownVariables } from "@/features/sms/render";
import { countSegments } from "@/features/sms/segments";
import { resetPlatformText, savePlatformText } from "../sms-text-actions";

const LOCALES = ["ka", "en", "ru"] as const;
type Locale = (typeof LOCALES)[number];
export type TextType = "confirmed" | "pending" | "reminder" | "rescheduled" | "cancelled" | "review";

export function SmsTextsEditor({
  types,
  saved,
  defaults,
}: {
  types: readonly TextType[];
  saved: { type: TextType; locale: Locale; body: string }[];
  defaults: Record<Locale, Record<TextType, string>>;
}) {
  return (
    <Tabs defaultValue="ka">
      <TabsList>
        {LOCALES.map((l) => (
          <TabsTrigger key={l} value={l} className="min-h-9 px-3">
            {l.toUpperCase()}
          </TabsTrigger>
        ))}
      </TabsList>
      {LOCALES.map((l) => (
        <TabsContent key={l} value={l} className="flex flex-col gap-4 pt-4">
          {types.map((type) => (
            <TextEditor
              key={`${l}-${type}`}
              type={type}
              locale={l}
              fallback={defaults[l][type]}
              saved={saved.find((x) => x.type === type && x.locale === l)?.body ?? null}
            />
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function TextEditor({
  type,
  locale,
  fallback,
  saved,
}: {
  type: TextType;
  locale: Locale;
  fallback: string;
  saved: string | null;
}) {
  const t = useTranslations("smsSettings");
  const tp = useTranslations("platform.smsTexts");
  const [body, setBody] = useState(saved ?? fallback);
  const [current, setCurrent] = useState(saved);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const id = `ptxt-${locale}-${type}`;

  const sample = {
    client_name: t("sample.client_name"),
    business_name: tp("sampleBusiness"),
    service: t("sample.service"),
    staff: t("sample.staff"),
    date: t("sample.date"),
    time: t("sample.time"),
    address: t("sample.address"),
    phone: t("sample.phone"),
    manage_link: "https://visito.ge/m/Xk3pQ9vRm2LbT7wZ4nYc8dHf6gJs1aEq",
  };
  const preview = renderSms(body, sample);
  const seg = countSegments(preview);
  const unknown = unknownVariables(body);

  const insert = (v: string) => {
    const el = area.current;
    const at = el?.selectionStart ?? body.length;
    setBody(`${body.slice(0, at)}{${v}}${body.slice(el?.selectionEnd ?? at)}`);
    requestAnimationFrame(() => el?.focus());
  };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after: () => void) =>
    startTransition(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      after();
      toast.success(t("saved"));
    });

  return (
    <Card className="gap-2 p-4" data-testid={id}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`${id}-label`} className="text-sm font-semibold">
          {tp(`types.${type}`)}
        </h2>
        <StatusPill tone={current ? "info" : "neutral"}>{current ? tp("edited") : t("default")}</StatusPill>
      </div>
      {type === "review" && <p className="text-xs text-muted-foreground">{tp("reviewHint")}</p>}
      <Textarea
        id={id}
        ref={area}
        rows={3}
        maxLength={600}
        aria-labelledby={`${id}-label`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex flex-wrap gap-1">
        {SMS_VARIABLES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => insert(v)}
            className="min-h-8 rounded-full border px-2.5 text-xs hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {t(`vars.${v}`)}
          </button>
        ))}
      </div>
      <div className="rounded-lg bg-muted/60 p-3 text-sm">
        <p className="mb-1 text-xs text-muted-foreground">{t("preview")}</p>
        <p className="break-words whitespace-pre-line">{preview}</p>
        <p
          className={`mt-2 text-xs ${seg.segments > 2 ? "text-warning-ink" : "text-muted-foreground"}`}
          aria-live="polite"
        >
          {t("counter", { chars: seg.length, segments: seg.segments })}
        </p>
      </div>
      {unknown.length > 0 && (
        <p className="text-sm text-destructive" role="alert">
          {t("unknownVars", { names: unknown.join(", ") })}
        </p>
      )}
      <FieldError code={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="h-11 md:h-8"
          disabled={pending || body.trim() === (current ?? fallback).trim() || unknown.length > 0}
          onClick={() =>
            run(
              () => savePlatformText({ type, locale, body }),
              () => setCurrent(body.trim()),
            )
          }
        >
          {t("saveText")}
        </Button>
        {current && (
          <Button
            size="sm"
            variant="ghost"
            className="h-11 md:h-8"
            disabled={pending}
            onClick={() =>
              run(
                () => resetPlatformText({ type, locale }),
                () => {
                  setCurrent(null);
                  setBody(fallback);
                },
              )
            }
          >
            {t("reset")}
          </Button>
        )}
      </div>
    </Card>
  );
}
