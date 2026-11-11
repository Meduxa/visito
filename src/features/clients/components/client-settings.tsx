"use client";

// Settings → Clients (decision 026): the business's own client fields, and the
// numbers behind the automatic groups.
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionResult } from "@/lib/action-result";
import { deleteClientField, moveClientField, saveClientField, saveSegmentRules } from "../actions";
import { fieldKinds, MAX_FIELDS, type ClientField, type FieldKind, type SegmentRules } from "../fields";

function useRun() {
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ code: string; field?: string }>();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) return setError({ code: r.error, field: r.field });
      toast.success(t("saved"));
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

export function ClientFieldsCard({ fields }: { fields: ClientField[] }) {
  const t = useTranslations("clientSettings");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const list = useRun();
  return (
    <Card className="gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t("fields.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("fields.hint")}</p>
        <p className="text-xs text-muted-foreground">{t("fields.privacy")}</p>
      </div>
      {fields.length === 0 && editing !== "new" && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t("fields.empty")}
        </p>
      )}
      {fields.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {fields.map((f, i) =>
            editing === f.id ? (
              <li key={f.id} className="p-3">
                <FieldEditor field={f} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={f.id} className="flex items-center gap-2 px-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{f.label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t(`kinds.${f.kind}`)}
                    {f.kind === "choice" && `: ${f.options.join(", ")}`}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 md:size-8"
                  aria-label={t("fields.up", { label: f.label })}
                  disabled={i === 0 || list.pending}
                  onClick={() => list.run(() => moveClientField(f.id, -1))}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 md:size-8"
                  aria-label={t("fields.down", { label: f.label })}
                  disabled={i === fields.length - 1 || list.pending}
                  onClick={() => list.run(() => moveClientField(f.id, 1))}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 md:size-8"
                  aria-label={t("fields.edit", { label: f.label })}
                  onClick={() => setEditing(f.id)}
                >
                  <Pencil aria-hidden />
                </Button>
                <ConfirmDialog
                  description={t("fields.removeConfirm", { label: f.label })}
                  onConfirm={() => list.run(() => deleteClientField(f.id))}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 md:size-8"
                      aria-label={t("fields.remove", { label: f.label })}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  }
                />
              </li>
            ),
          )}
        </ul>
      )}
      <FieldError code={list.error?.code} />
      {editing === "new" ? (
        <div className="rounded-lg border p-3">
          <FieldEditor field={null} onDone={() => setEditing(null)} />
        </div>
      ) : (
        <Button
          variant="outline"
          className="h-11 self-start md:h-9"
          disabled={fields.length >= MAX_FIELDS}
          onClick={() => setEditing("new")}
        >
          <Plus aria-hidden />
          {t("fields.add")}
        </Button>
      )}
      {fields.length >= MAX_FIELDS && <p className="text-xs text-muted-foreground">{t("fields.max")}</p>}
    </Card>
  );
}

function FieldEditor({ field, onDone }: { field: ClientField | null; onDone: () => void }) {
  const t = useTranslations("clientSettings");
  const common = useTranslations("common");
  const { run, pending, error } = useRun();
  const [label, setLabel] = useState(field?.label ?? "");
  const [kind, setKind] = useState<FieldKind>(field?.kind ?? "text");
  const [options, setOptions] = useState(field?.options.join(", ") ?? "");
  const id = `field-${field?.id ?? "new"}`;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const opts = options
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        run(() => saveClientField(field?.id ?? null, { label, kind, options: opts }), onDone);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id={`${id}-label`} label={t("fields.label")}>
          <Input
            id={`${id}-label`}
            maxLength={60}
            className="h-11 md:h-9"
            placeholder={t("fields.labelPlaceholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          />
        </FormField>
        <FormField
          id={`${id}-kind`}
          label={t("fields.kind")}
          hint={field ? t("fields.kindFixed") : undefined}
        >
          <Select value={kind} onValueChange={(k) => setKind(k as FieldKind)} disabled={!!field}>
            <SelectTrigger id={`${id}-kind`} className="h-11 w-full md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fieldKinds.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`kinds.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      {kind === "choice" && (
        <FormField id={`${id}-options`} label={t("fields.options")} hint={t("fields.optionsHint")}>
          <Input
            id={`${id}-options`}
            className="h-11 md:h-9"
            placeholder={t("fields.optionsPlaceholder")}
            value={options}
            onChange={(e) => setOptions(e.target.value)}
          />
        </FormField>
      )}
      <FieldError code={error?.code} />
      <div className="flex gap-2">
        <Button type="submit" className="h-11 md:h-9" disabled={pending || !label.trim()}>
          {common("save")}
        </Button>
        <Button type="button" variant="ghost" className="h-11 md:h-9" onClick={onDone}>
          {common("cancel")}
        </Button>
      </div>
    </form>
  );
}

export function SegmentRulesCard({ rules }: { rules: SegmentRules }) {
  const t = useTranslations("clientSettings");
  const common = useTranslations("common");
  const { run, pending, error } = useRun();
  const [v, setV] = useState({
    vipVisits: String(rules.vipVisits),
    atRiskDays: String(rules.atRiskDays),
    lostDays: String(rules.lostDays),
  });
  const num = (key: keyof typeof v, label: string, hint: string) => (
    <FormField
      id={`rule-${key}`}
      label={label}
      hint={hint}
      error={error?.field === key ? error.code : undefined}
    >
      <Input
        id={`rule-${key}`}
        inputMode="numeric"
        className="h-11 md:h-9"
        value={v[key]}
        onChange={(e) => setV({ ...v, [key]: e.target.value.replace(/\D/g, "") })}
      />
    </FormField>
  );
  return (
    <Card className="gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t("rules.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("rules.hint")}</p>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveSegmentRules(v));
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {num("vipVisits", t("rules.vipVisits"), t("rules.vipVisitsHint"))}
          {num("atRiskDays", t("rules.atRiskDays"), t("rules.atRiskDaysHint"))}
          {num("lostDays", t("rules.lostDays"), t("rules.lostDaysHint"))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("rules.summary", {
            vip: v.vipVisits || "?",
            atRisk: v.atRiskDays || "?",
            lost: v.lostDays || "?",
          })}
        </p>
        {error && !error.field && <FieldError code={error.code} />}
        <div className="flex gap-2">
          <Button type="submit" className="h-11 md:h-9" disabled={pending}>
            {common("save")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 md:h-9"
            onClick={() => setV({ vipVisits: "5", atRiskDays: "60", lostDays: "180" })}
          >
            {t("rules.defaults")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
