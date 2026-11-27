"use client";

import { FileUp, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { fileToTable, textToTable } from "@/lib/spreadsheet";
import { existingPhones, importClients } from "../actions";
import { blocking, parseClientTable, type ParsedClientRow } from "../import/parse";

type Row = ParsedClientRow & { exists: boolean };

export function ClientImportWizard() {
  const t = useTranslations();
  const router = useRouter();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const load = (table: string[][]) =>
    startTransition(async () => {
      setError(undefined);
      const { rows: parsed, recognised } = parseClientTable(table);
      if (!recognised) return setError("notRecognised");
      const phones = parsed.map((r) => r.phone_e164).filter((p): p is string => !!p);
      const existing = new Set(await existingPhones(phones));
      setRows(parsed.map((r) => ({ ...r, exists: !!r.phone_e164 && existing.has(r.phone_e164) })));
    });

  const ready = rows?.filter((r) => !blocking(r) && !r.exists) ?? [];
  const errors = rows?.filter(blocking).length ?? 0;
  const existing = rows?.filter((r) => !blocking(r) && r.exists).length ?? 0;

  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      const payload = ready.map(
        ({ first_name, last_name, phone_e164, email, birthday, notes, consent_sms, consent_email }) => ({
          first_name,
          last_name,
          phone_e164,
          email,
          birthday,
          notes,
          consent_sms,
          consent_email,
        }),
      );
      const r = await importClients(payload);
      if (!r.ok) return setError(r.error);
      toast.success(t("clientImport.success", r.data));
      router.push("/clients");
    });

  if (!rows) {
    return (
      <Card className="gap-5 p-4 md:p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="paste">{t("clientImport.paste")}</Label>
          <Textarea
            id="paste"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-sm"
            aria-describedby="cols-hint"
          />
          <p id="cols-hint" className="text-xs text-muted-foreground">
            {t("clientImport.columnsHint")}
          </p>
        </div>
        <Button
          className="h-11 self-start md:h-9"
          disabled={!text.trim() || pending}
          onClick={() => load(textToTable(text))}
        >
          {t("import.read")}
        </Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t("import.or")}
          <span className="h-px flex-1 bg-border" />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm font-medium focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/50">
          <FileUp className="size-4" aria-hidden />
          {t("import.upload")}
          <input
            type="file"
            accept=".xlsx,.csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) load(await fileToTable(file).catch(() => [] as string[][]));
            }}
          />
        </label>
        {error === "notRecognised" ? (
          <p role="alert" className="text-sm text-destructive">
            {t("clientImport.notRecognised")}
          </p>
        ) : (
          <FieldError code={error} />
        )}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-2 p-4">
        <h2 className="text-base font-semibold">{t("import.previewTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("clientImport.summary", { ok: ready.length, existing, errors })}
        </p>
        <p className="flex gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("clientImport.consentNote")}
        </p>
      </Card>
      <div className="overflow-hidden rounded-xl border bg-card">
        <ul className="divide-y">
          {rows.map((r) => (
            <li
              key={r.line}
              className="flex flex-col gap-1 px-4 py-3 md:grid md:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)_minmax(0,14rem)] md:items-center md:gap-4"
            >
              <span className="text-sm font-medium break-words">
                {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">{r.phone_e164 ?? "—"}</span>
              <span className="text-sm break-all text-muted-foreground">{r.email ?? ""}</span>
              <span className="flex flex-wrap gap-1">
                {r.issues.map((i) => (
                  <StatusPill key={i} tone={blocking({ ...r, issues: [i] }) ? "danger" : "warning"}>
                    {t(`clientImport.issues.${i}`)}
                  </StatusPill>
                ))}
                {r.exists && <StatusPill tone="info">{t("clientImport.existing")}</StatusPill>}
                {r.consent_sms && <StatusPill tone="success">SMS ✓</StatusPill>}
                {r.consent_email && <StatusPill tone="success">Email ✓</StatusPill>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <FieldError code={error} />
      <div className="flex flex-wrap gap-2">
        <Button className="h-11 md:h-9" disabled={pending || ready.length === 0} onClick={submit}>
          {t("clientImport.importButton", { count: ready.length })}
        </Button>
        <Button variant="outline" className="h-11 md:h-9" onClick={() => setRows(null)}>
          {t("import.startOver")}
        </Button>
      </div>
    </div>
  );
}
