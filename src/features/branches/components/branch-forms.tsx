"use client";

// Settings → Branches (decision 032): add a branch, its details, hours and services.
import { Plus, Power, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WeekEditor, type Week } from "@/components/week-editor";
import { SettingsCard } from "@/features/settings/components/settings-view";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";
import { deleteBranch, saveBranch, saveBranchHours, saveBranchServices, setBranchActive } from "../actions";

function useSave() {
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ code: string; field?: string }>();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, after?: (data: T) => void) =>
    startTransition(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) return setError({ code: r.error, field: r.field });
      toast.success(t("saved"));
      after?.(r.data);
    });
  return { pending, error, run };
}

type Details = { name: string; address: string; phone: string; slug: string };

function DetailsFields({
  value,
  onChange,
  error,
  idPrefix,
  withSlug,
}: {
  value: Details;
  onChange: (v: Details) => void;
  error?: { code: string; field?: string };
  idPrefix: string;
  withSlug: boolean;
}) {
  const t = useTranslations("branches");
  const tc = useTranslations("common");
  const field = (key: keyof Details) => (error?.field === key ? error.code : undefined);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField id={`${idPrefix}-name`} label={t("fields.name")} hint={t("fields.nameHint")}>
        <Input
          id={`${idPrefix}-name`}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="h-11 md:h-9"
        />
      </FormField>
      <FormField
        id={`${idPrefix}-phone`}
        label={`${t("fields.phone")} (${tc("optional")})`}
        error={field("phone")}
      >
        <Input
          id={`${idPrefix}-phone`}
          type="tel"
          inputMode="tel"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          className="h-11 md:h-9"
        />
      </FormField>
      <FormField id={`${idPrefix}-address`} label={t("fields.address")} className="sm:col-span-2">
        <Input
          id={`${idPrefix}-address`}
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          className="h-11 md:h-9"
        />
      </FormField>
      {withSlug && (
        <FormField
          id={`${idPrefix}-slug`}
          label={t("fields.slug")}
          hint={t("fields.slugHint")}
          error={field("slug")}
          className="sm:col-span-2"
        >
          <Input
            id={`${idPrefix}-slug`}
            value={value.slug}
            onChange={(e) => onChange({ ...value, slug: e.target.value.toLowerCase() })}
            className="h-11 font-mono md:h-9"
            autoCapitalize="off"
            spellCheck={false}
          />
        </FormField>
      )}
    </div>
  );
}

export function AddBranchCard({ canAdd, limitNote }: { canAdd: boolean; limitNote: string | null }) {
  const t = useTranslations("branches");
  const router = useRouter();
  const [value, setValue] = useState<Details>({ name: "", address: "", phone: "", slug: "" });
  const save = useSave();
  return (
    <SettingsCard title={t("add.title")} hint={t("add.hint")} testId="add-branch">
      {limitNote && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{limitNote}</p>}
      {canAdd && (
        <>
          <DetailsFields
            value={value}
            onChange={setValue}
            error={save.error}
            idPrefix="new-branch"
            withSlug={false}
          />
          <FieldError code={save.error && !save.error.field ? save.error.code : undefined} />
          <Button
            className="h-11 self-start md:h-9"
            disabled={save.pending || !value.name.trim()}
            onClick={() =>
              save.run(
                () => saveBranch(null, value),
                (r) => router.push(`/settings/branches/${r.id}`),
              )
            }
          >
            <Plus aria-hidden />
            {t("add.button")}
          </Button>
        </>
      )}
    </SettingsCard>
  );
}

export function BranchDetailsCard({ id, initial }: { id: string; initial: Details }) {
  const t = useTranslations();
  const [value, setValue] = useState(initial);
  const save = useSave();
  return (
    <SettingsCard title={t("branches.details.title")}>
      <DetailsFields value={value} onChange={setValue} error={save.error} idPrefix="branch" withSlug />
      <FieldError code={save.error && !save.error.field ? save.error.code : undefined} />
      <Button
        className="h-11 self-start md:h-9"
        disabled={save.pending || !value.name.trim()}
        onClick={() => save.run(() => saveBranch(id, value))}
      >
        {t("common.save")}
      </Button>
    </SettingsCard>
  );
}

export function BranchHoursCard({ id, initial }: { id: string; initial: Week }) {
  const t = useTranslations("settings.hours");
  return (
    <SettingsCard title={t("title")}>
      <WeekEditor initial={initial} hint={t("hint")} onSave={(week) => saveBranchHours(id, week)} />
    </SettingsCard>
  );
}

export type BranchService = {
  id: string;
  name: string;
  category: string | null;
  priceMinor: number;
  priceMaxMinor: number | null;
  priceType: "fixed" | "from" | "range";
  hasVariants: boolean;
  offered: boolean;
  branchPriceMinor: number | null;
  branchPriceMaxMinor: number | null;
};

const toText = (minor: number | null) => (minor === null ? "" : String(minor / 100).replace(".", ","));

export function BranchServicesCard({ id, services }: { id: string; services: BranchService[] }) {
  const t = useTranslations();
  const [rows, setRows] = useState(() =>
    services.map((s) => ({
      ...s,
      price: toText(s.branchPriceMinor),
      priceMax: toText(s.branchPriceMaxMinor),
    })),
  );
  const save = useSave();
  const set = (k: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((r) => r.map((x, i) => (i === k ? { ...x, ...patch } : x)));
  const bad = rows.some(
    (r) =>
      (r.price && parseMoneyToMinor(r.price) === null) ||
      (r.priceMax && parseMoneyToMinor(r.priceMax) === null),
  );

  return (
    <SettingsCard
      title={t("branches.services.title")}
      hint={t("branches.services.hint")}
      testId="branch-services"
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("branches.services.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {rows.map((r, k) => (
            <li key={r.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
              <label className="flex min-h-9 flex-1 cursor-pointer items-center gap-3">
                <Switch
                  checked={r.offered}
                  onCheckedChange={(on) => set(k, { offered: on })}
                  aria-label={`${r.name}: ${t("branches.services.offered")}`}
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("branches.services.normalPrice", {
                      price:
                        formatMoney(r.priceMinor) +
                        (r.priceType === "range" && r.priceMaxMinor !== null
                          ? ` – ${formatMoney(r.priceMaxMinor)}`
                          : ""),
                    })}
                  </span>
                </span>
              </label>
              {r.offered && !r.hasVariants && (
                <div className="flex items-center gap-2 pl-12 sm:pl-0">
                  <Input
                    inputMode="decimal"
                    value={r.price}
                    placeholder={toText(r.priceMinor)}
                    onChange={(e) => set(k, { price: e.target.value })}
                    aria-label={`${r.name}: ${t("branches.services.branchPrice")}`}
                    aria-invalid={!!r.price && parseMoneyToMinor(r.price) === null}
                    className="h-11 w-24 md:h-9"
                  />
                  {r.priceType === "range" && (
                    <>
                      <span aria-hidden>–</span>
                      <Input
                        inputMode="decimal"
                        value={r.priceMax}
                        placeholder={toText(r.priceMaxMinor)}
                        onChange={(e) => set(k, { priceMax: e.target.value })}
                        aria-label={`${r.name}: ${t("branches.services.branchPriceMax")}`}
                        className="h-11 w-24 md:h-9"
                      />
                    </>
                  )}
                  <span className="text-sm text-muted-foreground">₾</span>
                </div>
              )}
              {r.offered && r.hasVariants && (
                <span className="pl-12 text-xs text-muted-foreground sm:pl-0">
                  {t("branches.services.variants")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <FieldError code={bad ? "priceInvalid" : save.error?.code} />
      {rows.length > 0 && (
        <Button
          className="h-11 self-start md:h-9"
          disabled={save.pending || bad}
          onClick={() =>
            save.run(() =>
              saveBranchServices(
                id,
                rows.map((r) => ({
                  serviceId: r.id,
                  offered: r.offered,
                  priceMinor: r.price ? parseMoneyToMinor(r.price) : null,
                  priceMaxMinor: r.priceMax ? parseMoneyToMinor(r.priceMax) : null,
                })),
              ),
            )
          }
        >
          {t("common.save")}
        </Button>
      )}
    </SettingsCard>
  );
}

export function BranchStateCard({ id, active }: { id: string; active: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const save = useSave();
  return (
    <SettingsCard title={t("branches.state.title")} hint={t("branches.state.hint")}>
      <div className="flex flex-wrap gap-2">
        {active ? (
          <ConfirmDialog
            description={t("branches.state.offConfirm")}
            onConfirm={() => save.run(() => setBranchActive(id, false))}
            trigger={
              <Button variant="outline" className="h-11 md:h-9">
                <Power aria-hidden />
                {t("branches.state.off")}
              </Button>
            }
          />
        ) : (
          <Button
            variant="outline"
            className="h-11 md:h-9"
            disabled={save.pending}
            onClick={() => save.run(() => setBranchActive(id, true))}
          >
            <Power aria-hidden />
            {t("branches.state.on")}
          </Button>
        )}
        <ConfirmDialog
          description={t("branches.state.deleteConfirm")}
          onConfirm={() =>
            save.run(
              () => deleteBranch(id),
              () => router.push("/settings/branches"),
            )
          }
          trigger={
            <Button variant="ghost" className="h-11 text-destructive md:h-9">
              <Trash2 aria-hidden />
              {t("common.delete")}
            </Button>
          }
        />
      </div>
      <FieldError code={save.error?.code} />
    </SettingsCard>
  );
}
