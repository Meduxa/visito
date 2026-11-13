"use client";

// The cards of the Settings sections (decision 021). Each section page puts
// together the cards it needs; every card saves on its own.
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FieldError } from "@/components/field-error";
import { FormField, SwitchRow } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { WeekEditor, type Week } from "@/components/week-editor";
import type { ActionResult } from "@/lib/action-result";
import { fullDate } from "@/lib/date-format";
import {
  addClosure,
  addResource,
  deleteSettingsItem,
  saveAccess,
  saveBookingRules,
  saveBusiness,
  saveNotifications,
  saveOpeningHours,
} from "../actions";
import { slotSteps, type AccessInput, type BookingRulesInput, type NotifyInput } from "../schema";

export function SettingsCard({
  title,
  hint,
  children,
  testId,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Card className="gap-4 p-4 md:p-6" data-testid={testId}>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

function useSave() {
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      toast.success(t("saved"));
      after?.();
    });
  return { pending, error, run };
}

function SaveButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  const t = useTranslations("common");
  return (
    <Button className="h-11 self-start md:h-9" disabled={pending} onClick={onClick}>
      {t("save")}
    </Button>
  );
}

// ----- Business -----

export function BusinessCard({
  isOwner,
  initial,
}: {
  isOwner: boolean;
  initial: { name: string; address: string; phone: string; email: string };
}) {
  const t = useTranslations();
  const [biz, setBiz] = useState(initial);
  const save = useSave();
  const field = (key: "phone" | "email" | "address", label: string, type = "text") => (
    <FormField id={`biz-${key}`} label={label}>
      <Input
        id={`biz-${key}`}
        type={type}
        inputMode={type === "tel" ? "tel" : undefined}
        value={biz[key]}
        onChange={(e) => setBiz({ ...biz, [key]: e.target.value })}
        className="h-11 md:h-9"
      />
    </FormField>
  );
  return (
    <SettingsCard title={t("settings.business.title")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="biz-name"
          label={t("onboarding.name")}
          hint={isOwner ? undefined : t("settings.business.ownerOnly")}
        >
          <Input
            id="biz-name"
            value={biz.name}
            disabled={!isOwner}
            onChange={(e) => setBiz({ ...biz, name: e.target.value })}
            className="h-11 md:h-9"
          />
        </FormField>
        {field("phone", t("staff.fields.phone"), "tel")}
        {field("email", t("auth.email"), "email")}
        {field("address", t("settings.business.address"))}
      </div>
      <FieldError code={save.error} />
      <SaveButton pending={save.pending} onClick={() => save.run(() => saveBusiness(biz))} />
    </SettingsCard>
  );
}

export function HoursCard({ initial }: { initial: Week }) {
  const t = useTranslations("settings.hours");
  return (
    <SettingsCard title={t("title")}>
      <WeekEditor initial={initial} hint={t("hint")} onSave={saveOpeningHours} />
    </SettingsCard>
  );
}

// ----- Closed days -----

export function ClosuresCard({
  closures,
  branches = [],
}: {
  closures: { id: string; date: string; reason: string | null; locationId?: string | null }[];
  branches?: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const multi = branches.length > 1;
  const [closure, setClosure] = useState({ date: "", reason: "", locationId: "" });
  const save = useSave();
  return (
    <SettingsCard title={t("settings.closures.title")} hint={t("settings.closures.hint")}>
      <div className="flex flex-wrap items-end gap-2">
        <FormField id="closure-date" label={t("staff.overrides.date")}>
          <Input
            id="closure-date"
            type="date"
            value={closure.date}
            onChange={(e) => setClosure({ ...closure, date: e.target.value })}
            className="h-11 w-44 md:h-9"
          />
        </FormField>
        {multi && (
          <FormField id="closure-branch" label={t("branches.branch")}>
            <Select
              value={closure.locationId || "__all"}
              onValueChange={(v) => setClosure({ ...closure, locationId: v === "__all" ? "" : v })}
            >
              <SelectTrigger id="closure-branch" className="h-11 w-44 md:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("branches.allBranches")}</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <FormField
          id="closure-reason"
          label={`${t("settings.closures.reason")} (${t("common.optional")})`}
          className="min-w-48 flex-1"
        >
          <Input
            id="closure-reason"
            value={closure.reason}
            onChange={(e) => setClosure({ ...closure, reason: e.target.value })}
            className="h-11 md:h-9"
          />
        </FormField>
        <Button
          className="h-11 md:h-9"
          disabled={save.pending || !closure.date}
          onClick={() =>
            save.run(
              () => addClosure({ ...closure, locationId: closure.locationId || null }),
              () => setClosure({ date: "", reason: "", locationId: closure.locationId }),
            )
          }
        >
          <Plus aria-hidden />
          {t("common.add")}
        </Button>
      </div>
      {closures.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("settings.closures.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {closures.map((c) => (
            <li key={c.id} className="flex min-h-11 items-center gap-3 px-3 py-1">
              <span className="flex-1 text-sm">
                {fullDate(t, c.date)}
                {c.reason && <span className="text-muted-foreground"> · {c.reason}</span>}
                {multi && (
                  <span className="text-muted-foreground">
                    {" · "}
                    {branches.find((b) => b.id === c.locationId)?.name ?? t("branches.allBranches")}
                  </span>
                )}
              </span>
              <ConfirmDialog
                description={t("common.confirm")}
                onConfirm={() => save.run(() => deleteSettingsItem("closure", c.id))}
                trigger={
                  <Button variant="ghost" size="icon" aria-label={t("common.delete")}>
                    <Trash2 aria-hidden />
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <FieldError code={save.error} />
    </SettingsCard>
  );
}

// ----- Online booking rules -----

export function BookingRulesCard({ initial }: { initial: BookingRulesInput }) {
  const t = useTranslations();
  const [rules, setRules] = useState(initial);
  const save = useSave();
  const numberField = (
    key: "minNoticeHours" | "maxDaysAhead" | "cancelWindowHours" | "maxUpcoming",
    max: number,
  ) => (
    <FormField id={key} label={t(`settings.rules.${key}`)} hint={t(`settings.rules.${key}Hint`)}>
      <Input
        id={key}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={String(rules[key])}
        onChange={(e) => setRules({ ...rules, [key]: e.target.value })}
        className="h-11 w-32 md:h-9"
      />
    </FormField>
  );
  return (
    <SettingsCard title={t("settings.rules.title")} hint={t("settings.rules.hint")}>
      <div className="grid gap-4 sm:grid-cols-2">
        {numberField("minNoticeHours", 168)}
        {numberField("maxDaysAhead", 365)}
        {numberField("cancelWindowHours", 168)}
        <FormField
          id="slotStepMin"
          label={t("settings.rules.slotStepMin")}
          hint={t("settings.rules.slotStepMinHint")}
        >
          <Select
            value={String(rules.slotStepMin)}
            onValueChange={(v) => setRules({ ...rules, slotStepMin: v })}
          >
            <SelectTrigger id="slotStepMin" className="h-11 w-32 md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {slotSteps.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {t("format.minutes", { m: s })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {numberField("maxUpcoming", 20)}
      </div>
      {(["onlineOtpRequired", "onlineRequiresApproval", "onlineShowPrices"] as const).map((k) => (
        <SwitchRow key={k} label={t(`settings.rules.${k}`)} hint={t(`settings.rules.${k}Hint`)}>
          <Switch checked={rules[k]} onCheckedChange={(v) => setRules({ ...rules, [k]: v })} />
        </SwitchRow>
      ))}
      <FieldError code={save.error} />
      <SaveButton pending={save.pending} onClick={() => save.run(() => saveBookingRules(rules))} />
    </SettingsCard>
  );
}

// ----- Team & access -----

export function AccessCard({ isOwner, initial }: { isOwner: boolean; initial: AccessInput }) {
  const t = useTranslations();
  const [access, setAccess] = useState(initial);
  const save = useSave();
  return (
    <SettingsCard title={t("settingsNav.access.title")} hint={t("settingsNav.access.hint")}>
      {(["staffSeesAllClients", "staffSeesAllBookings"] as const).map((k) => (
        <SwitchRow key={k} label={t(`settings.rules.${k}`)} hint={t(`settings.rules.${k}Hint`)}>
          <Switch checked={access[k]} onCheckedChange={(v) => setAccess({ ...access, [k]: v })} />
        </SwitchRow>
      ))}
      {isOwner && (
        <SwitchRow label={t("settingsRevenue.label")} hint={t("settingsRevenue.hint")}>
          <Switch
            checked={!!access.adminsSeeRevenue}
            onCheckedChange={(v) => setAccess({ ...access, adminsSeeRevenue: v })}
          />
        </SwitchRow>
      )}
      <FieldError code={save.error} />
      <SaveButton pending={save.pending} onClick={() => save.run(() => saveAccess(access))} />
    </SettingsCard>
  );
}

// ----- Notifications -----

export function NotificationsCard({ initial }: { initial: NotifyInput }) {
  const t = useTranslations("settingsNav.notify");
  const [v, setV] = useState(initial);
  const save = useSave();
  const row = (key: keyof NotifyInput, who: "managers" | "staff") => (
    <SwitchRow key={key} label={t(`who.${who}`)} hint={t(`who.${who}Hint`)}>
      <Switch checked={v[key]} onCheckedChange={(on) => setV({ ...v, [key]: on })} />
    </SwitchRow>
  );
  return (
    <>
      <SettingsCard title={t("online.title")} hint={t("online.hint")} testId="notify-online">
        {row("onlineManagers", "managers")}
        {row("onlineStaff", "staff")}
      </SettingsCard>
      <SettingsCard title={t("overdue.title")} hint={t("overdue.hint")} testId="notify-overdue">
        {row("overdueManagers", "managers")}
        {row("overdueStaff", "staff")}
      </SettingsCard>
      <p className="text-sm text-muted-foreground">{t("where")}</p>
      <FieldError code={save.error} />
      <SaveButton pending={save.pending} onClick={() => save.run(() => saveNotifications(v))} />
    </>
  );
}

// ----- Rooms & chairs (dental) -----

export function ResourcesCard({
  resources,
  branches = [],
}: {
  resources: { id: string; name: string; type: "chair" | "room" | "equipment"; locationId?: string | null }[];
  branches?: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const multi = branches.length > 1;
  const [resource, setResource] = useState({
    name: "",
    type: "chair" as "chair" | "room" | "equipment",
    locationId: branches[0]?.id ?? "",
  });
  const save = useSave();
  return (
    <SettingsCard title={t("settings.resources.title")} hint={t("settings.resources.hint")}>
      <div className="flex flex-wrap items-end gap-2">
        <FormField id="res-name" label={t("staff.fields.displayName")} className="min-w-48 flex-1">
          <Input
            id="res-name"
            value={resource.name}
            onChange={(e) => setResource({ ...resource, name: e.target.value })}
            className="h-11 md:h-9"
          />
        </FormField>
        <FormField id="res-type" label={t("settings.resources.type")}>
          <Select
            value={resource.type}
            onValueChange={(v) => setResource({ ...resource, type: v as "chair" })}
          >
            <SelectTrigger id="res-type" className="h-11 w-40 md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["chair", "room", "equipment"] as const).map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`settings.resources.types.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {multi && (
          <FormField id="res-branch" label={t("branches.branch")}>
            <Select
              value={resource.locationId}
              onValueChange={(v) => setResource({ ...resource, locationId: v })}
            >
              <SelectTrigger id="res-branch" className="h-11 w-44 md:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <Button
          className="h-11 md:h-9"
          disabled={save.pending || !resource.name.trim()}
          onClick={() =>
            save.run(
              () => addResource({ ...resource, locationId: multi ? resource.locationId : null }),
              () => setResource({ ...resource, name: "" }),
            )
          }
        >
          <Plus aria-hidden />
          {t("common.add")}
        </Button>
      </div>
      {resources.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("settings.resources.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {resources.map((r) => (
            <li key={r.id} className="flex min-h-11 items-center gap-3 px-3 py-1">
              <span className="flex-1 text-sm">{r.name}</span>
              {multi && (
                <span className="text-xs text-muted-foreground">
                  {branches.find((b) => b.id === r.locationId)?.name ?? branches[0].name}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{t(`settings.resources.types.${r.type}`)}</span>
              <ConfirmDialog
                description={t("common.confirm")}
                onConfirm={() => save.run(() => deleteSettingsItem("resource", r.id))}
                trigger={
                  <Button variant="ghost" size="icon" aria-label={t("common.delete")}>
                    <Trash2 aria-hidden />
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <FieldError code={save.error} />
    </SettingsCard>
  );
}
