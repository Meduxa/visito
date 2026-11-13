"use client";

import { MessageSquare, Send, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { describedBy, FormField } from "@/components/form-field";
import { StatCard } from "@/components/stat-card";
import { StatusPill, type PillTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";
import { SMS_SALON_TOOLS } from "@/lib/pilot";
import { resetTemplate, saveSmsSettings, saveTemplate, sendTestSms } from "../actions";
import type { SmsOverview } from "../queries";
import { renderSms, SMS_VARIABLES, TEMPLATE_TYPES, unknownVariables, type TemplateType } from "../render";
import { countSegments } from "../segments";

const LOCALES = ["ka", "en", "ru"] as const;
type Locale = (typeof LOCALES)[number];
const SENDER_TONE: Record<SmsOverview["settings"]["senderStatus"], PillTone> = {
  none: "neutral",
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

function useRun() {
  const t = useTranslations("smsSettings");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ code: string; field?: string }>();
  const run = (fn: () => Promise<ActionResult>, done = t("saved")) =>
    startTransition(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) return setError({ code: r.error, field: r.field });
      toast.success(done);
    });
  return { pending, error, run };
}

export function SmsSettingsView({
  data,
  defaults,
  businessName,
  previews,
}: {
  data: SmsOverview;
  /** each automatic SMS as clients get it, with an example date and time */
  previews: Record<TemplateType | "review", string>;
  defaults: Record<Locale, Record<TemplateType, string>>;
  businessName: string;
}) {
  const t = useTranslations("smsSettings");
  const [s, setS] = useState(data.settings);
  const save = useRun();
  const test = useRun();
  const [testPhone, setTestPhone] = useState("");
  const low = data.balance <= data.lowBalance;

  return (
    <div className="flex flex-col gap-6">
      {low && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning-ink"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {data.balance <= 0 ? t("empty") : t("low", { count: data.balance })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={<MessageSquare />}
          label={t("balance")}
          value={data.balance}
          hint={t("balanceHint")}
          tone={low ? "warning" : "brand"}
        />
        <StatCard
          icon={<Send />}
          label={t("sentThisMonth")}
          value={data.sentThisMonth}
          hint={t("log")}
          href="/settings/sms/log"
        />
      </div>

      <Card className="gap-4 p-4 md:p-6">
        {/* pilot (decision 033): Visito's sender name and texts for everyone */}
        {!SMS_SALON_TOOLS && <p className="text-sm text-muted-foreground">{t("pilotNote")}</p>}
        {SMS_SALON_TOOLS && (
          <FormField
            id="sms-sender"
            label={t("sender")}
            hint={t("senderHint")}
            error={save.error?.field === "senderName" ? save.error.code : undefined}
          >
            <div className="flex flex-wrap items-center gap-3">
              <Input
                id="sms-sender"
                maxLength={11}
                className="h-11 max-w-56 md:h-9"
                value={s.senderName}
                onChange={(e) => setS({ ...s, senderName: e.target.value })}
                {...describedBy(
                  "sms-sender",
                  save.error?.field === "senderName" ? save.error.code : undefined,
                )}
              />
              <StatusPill
                tone={SENDER_TONE[s.senderName === data.settings.senderName ? s.senderStatus : "none"]}
                dot
              >
                {t(`senderStatus.${s.senderName === data.settings.senderName ? s.senderStatus : "none"}`)}
              </StatusPill>
            </div>
          </FormField>
        )}

        <h2 className="pt-2 text-base font-semibold">{t("messagesTitle")}</h2>
        <ul className="flex flex-col gap-3" data-testid="auto-sms">
          <MessageRow
            label={t("onConfirm")}
            hint={t("onConfirmHint")}
            text={previews.confirmed}
            on={s.onConfirm}
            extra={
              <>
                <span className="text-muted-foreground">{t("pendingNote")} </span>
                {previews.pending}
              </>
            }
          >
            <Switch
              checked={s.onConfirm}
              onCheckedChange={(v) => setS({ ...s, onConfirm: v })}
              aria-label={t("onConfirm")}
            />
          </MessageRow>
          <MessageRow label={t("onReschedule")} text={previews.rescheduled} on={s.onReschedule}>
            <Switch
              checked={s.onReschedule}
              onCheckedChange={(v) => setS({ ...s, onReschedule: v })}
              aria-label={t("onReschedule")}
            />
          </MessageRow>
          <MessageRow label={t("onCancel")} text={previews.cancelled} on={s.onCancel}>
            <Switch
              checked={s.onCancel}
              onCheckedChange={(v) => setS({ ...s, onCancel: v })}
              aria-label={t("onCancel")}
            />
          </MessageRow>
          <MessageRow label={t("reminder24h")} text={previews.reminder} on={s.reminder24h}>
            <Switch
              checked={s.reminder24h}
              onCheckedChange={(v) => setS({ ...s, reminder24h: v })}
              aria-label={t("reminder24h")}
            />
          </MessageRow>
          <MessageRow label={t("reminder2h")} text={previews.reminder} on={s.reminder2h}>
            <Switch
              checked={s.reminder2h}
              onCheckedChange={(v) => setS({ ...s, reminder2h: v })}
              aria-label={t("reminder2h")}
            />
          </MessageRow>
          <MessageRow
            label={t("reviewRequest")}
            hint={t("reviewRequestHint")}
            text={previews.review}
            on={s.reviewAsk}
          >
            <Switch
              checked={s.reviewAsk}
              onCheckedChange={(v) => setS({ ...s, reviewAsk: v })}
              aria-label={t("reviewRequest")}
            />
          </MessageRow>
        </ul>

        <h2 className="pt-2 text-base font-semibold">{t("quietTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("quietHint")}</p>
        <div className="flex gap-4">
          <FormField id="sms-qs" label={t("quietStart")}>
            <Input
              id="sms-qs"
              type="time"
              className="h-11 w-32 md:h-9"
              value={s.quietStart}
              onChange={(e) => setS({ ...s, quietStart: e.target.value })}
            />
          </FormField>
          <FormField id="sms-qe" label={t("quietEnd")}>
            <Input
              id="sms-qe"
              type="time"
              className="h-11 w-32 md:h-9"
              value={s.quietEnd}
              onChange={(e) => setS({ ...s, quietEnd: e.target.value })}
            />
          </FormField>
        </div>
        {save.error && save.error.field !== "senderName" && <FieldError code={save.error.code} />}
        <Button
          className="h-11 self-start md:h-9"
          disabled={save.pending}
          onClick={() => save.run(() => saveSmsSettings(s))}
        >
          {t("save")}
        </Button>
      </Card>

      {SMS_SALON_TOOLS && (
        <Card className="gap-4 p-4 md:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">{t("templatesTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("templatesHint")}</p>
          </div>
          <Tabs defaultValue={data.locale}>
            <TabsList>
              {LOCALES.map((l) => (
                <TabsTrigger key={l} value={l} className="min-h-9 px-3">
                  {l.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
            {LOCALES.map((l) => (
              <TabsContent key={l} value={l} className="flex flex-col gap-6 pt-4">
                {TEMPLATE_TYPES.map((type) => (
                  <TemplateEditor
                    key={`${l}-${type}`}
                    type={type}
                    locale={l}
                    fallback={defaults[l][type]}
                    custom={data.templates.find((x) => x.type === type && x.locale === l)?.body ?? null}
                    businessName={businessName}
                  />
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      )}

      {SMS_SALON_TOOLS && (
        <Card className="gap-3 p-4 md:p-6">
          <h2 className="text-base font-semibold">{t("test")}</h2>
          <p className="text-sm text-muted-foreground">{t("testHint")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <FormField id="sms-test" label={t("testPhone")} error={test.error?.code}>
              <Input
                id="sms-test"
                type="tel"
                className="h-11 w-48 md:h-9"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </FormField>
            <Button
              variant="outline"
              className="h-11 md:h-9"
              disabled={test.pending || !testPhone.trim()}
              onClick={() => test.run(() => sendTestSms(testPhone), t("testSent"))}
            >
              {t("testSend")}
            </Button>
          </div>
        </Card>
      )}

      <Button variant="link" asChild className="self-start px-0">
        <Link href="/settings/sms/log">{t("log")}</Link>
      </Button>
    </div>
  );
}

// One automatic SMS: its name, on/off, and the text clients get (an SMS bubble).
function MessageRow({
  label,
  hint,
  text,
  on,
  extra,
  children,
}: {
  label: string;
  hint?: string;
  text: string;
  on: boolean;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("smsSettings");
  const seg = countSegments(text);
  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium">{label}</span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        {children}
      </div>
      <div>
        <p className="sr-only">{t("textLabel")}</p>
        <p
          className={cn(
            "w-fit max-w-full rounded-2xl rounded-bl-sm px-3 py-2 text-sm break-words whitespace-pre-line",
            // switched off: an outline instead of a filled bubble (fading would fail contrast)
            on ? "bg-muted" : "border border-dashed text-muted-foreground",
          )}
        >
          {text}
        </p>
        {extra && <p className="mt-1 text-xs break-words">{extra}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {t("counter", { chars: seg.length, segments: seg.segments })}
        </p>
      </div>
    </li>
  );
}

function TemplateEditor({
  type,
  locale,
  fallback,
  custom,
  businessName,
}: {
  type: TemplateType;
  locale: Locale;
  fallback: string;
  custom: string | null;
  businessName: string;
}) {
  const t = useTranslations("smsSettings");
  const [body, setBody] = useState(custom ?? fallback);
  const area = useRef<HTMLTextAreaElement>(null);
  const action = useRun();
  const id = `tpl-${locale}-${type}`;

  const sample = {
    client_name: t("sample.client_name"),
    business_name: businessName,
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
    const next = `${body.slice(0, at)}{${v}}${body.slice(el?.selectionEnd ?? at)}`;
    setBody(next);
    requestAnimationFrame(() => el?.focus());
  };

  return (
    <section className="flex flex-col gap-2" aria-labelledby={`${id}-label`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${id}-label`} className="text-sm font-medium">
          {t(`types.${type}`)}
        </h3>
        <StatusPill tone={custom ? "info" : "neutral"}>{custom ? t("custom") : t("default")}</StatusPill>
      </div>
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
      <FieldError code={action.error?.code} />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="h-11 md:h-8"
          disabled={action.pending || body.trim() === (custom ?? fallback).trim() || unknown.length > 0}
          onClick={() => action.run(() => saveTemplate({ type, locale, body }))}
        >
          {t("saveText")}
        </Button>
        {custom && (
          <Button
            size="sm"
            variant="ghost"
            className="h-11 md:h-8"
            disabled={action.pending}
            onClick={() => {
              setBody(fallback);
              action.run(() => resetTemplate({ type, locale }));
            }}
          >
            {t("reset")}
          </Button>
        )}
      </div>
    </section>
  );
}
