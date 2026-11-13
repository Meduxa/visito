"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { fullDate, fullDateTime } from "@/lib/date-format";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { addOverride, addTimeOff, deleteScheduleItem } from "../actions";
import type { StaffDetail } from "../queries";
import { timeOffReasons } from "../schema";

const today = () => new Date().toISOString().slice(0, 10);

function DeleteButton({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const t = useTranslations("common");
  return (
    <ConfirmDialog
      description={label}
      onConfirm={onConfirm}
      trigger={
        <Button variant="ghost" size="icon" aria-label={t("delete")}>
          <Trash2 aria-hidden />
        </Button>
      }
    />
  );
}

export function OverridesEditor({
  staffId,
  items,
  branches = [],
}: {
  staffId: string;
  items: StaffDetail["overrides"];
  branches?: { id: string; name: string }[];
}) {
  const multi = branches.length > 1;
  const [locationId, setLocationId] = useState(branches[0]?.id ?? "");
  const branchName = (id: string | null) => branches.find((b) => b.id === (id ?? branches[0]?.id))?.name;
  const t = useTranslations();
  const [date, setDate] = useState(today());
  const [dayOff, setDayOff] = useState(true);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("15:00");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) setError(r.error);
    });

  return (
    <Card className="gap-4 p-4">
      <div>
        <h3 className="font-medium">{t("staff.overrides.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("staff.overrides.hint")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <FormField id="ov-date" label={t("staff.overrides.date")}>
          <Input
            id="ov-date"
            type="date"
            min={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-44 md:h-9"
          />
        </FormField>
        <label className="flex min-h-11 items-center gap-2 md:min-h-9">
          <Switch checked={dayOff} onCheckedChange={setDayOff} />
          <span className="text-sm">{t("staff.overrides.dayOff")}</span>
        </label>
        {!dayOff && (
          <div className="flex items-center gap-2">
            <Input
              type="time"
              step={300}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              aria-label={t("staff.timeOff.from")}
              className="h-11 w-32 md:h-9"
            />
            <span aria-hidden>–</span>
            <Input
              type="time"
              step={300}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              aria-label={t("staff.timeOff.to")}
              className="h-11 w-32 md:h-9"
            />
            {multi && (
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                aria-label={t("branches.branch")}
                className="h-11 rounded-lg border bg-background px-2 text-sm md:h-9"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <Button
          className="h-11 md:h-9"
          disabled={pending}
          onClick={() =>
            run(() =>
              addOverride(staffId, { date, dayOff, start, end, locationId: multi ? locationId : null }),
            )
          }
        >
          {t("staff.overrides.add")}
        </Button>
      </div>
      <FieldError code={error} />
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("staff.overrides.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {items.map((o) => (
            <li key={o.id} className="flex min-h-11 items-center gap-3 px-3 py-1">
              <span className="flex-1 text-sm">{fullDate(t, o.date)}</span>
              {o.dayOff ? (
                <StatusPill tone="neutral">{t("staff.overrides.dayOff")}</StatusPill>
              ) : (
                <StatusPill tone="brand">
                  {o.start}–{o.end}
                  {multi && ` · ${branchName(o.locationId)}`}
                </StatusPill>
              )}
              <DeleteButton
                label={t("common.confirm")}
                onConfirm={() => run(() => deleteScheduleItem("override", o.id, staffId))}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TimeOffEditor({
  staffId,
  items,
  timeZone,
}: {
  staffId: string;
  items: StaffDetail["timeOff"];
  timeZone: string;
}) {
  const t = useTranslations();
  const [startDate, setStartDate] = useState(today());
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState(today());
  const [endTime, setEndTime] = useState("23:59");
  const [reason, setReason] = useState<(typeof timeOffReasons)[number]>("vacation");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) setError(r.error);
    });
  const when = (iso: string) => fullDateTime(t, iso, timeZone);

  return (
    <Card className="gap-4 p-4">
      <div>
        <h3 className="font-medium">{t("staff.timeOff.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("staff.timeOff.hint")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="to-from" label={t("staff.timeOff.from")}>
          <div className="flex gap-2">
            <Input
              id="to-from"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-11 md:h-9"
            />
            <Input
              type="time"
              step={300}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              aria-label={t("staff.timeOff.from")}
              className="h-11 w-32 md:h-9"
            />
          </div>
        </FormField>
        <FormField id="to-to" label={t("staff.timeOff.to")}>
          <div className="flex gap-2">
            <Input
              id="to-to"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-11 md:h-9"
            />
            <Input
              type="time"
              step={300}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              aria-label={t("staff.timeOff.to")}
              className="h-11 w-32 md:h-9"
            />
          </div>
        </FormField>
        <FormField id="to-reason" label={t("staff.timeOff.reason")}>
          <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
            <SelectTrigger id="to-reason" className="h-11 w-full md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeOffReasons.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`staff.reasons.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="to-note" label={`${t("staff.timeOff.note")} (${t("common.optional")})`}>
          <Input
            id="to-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-11 md:h-9"
          />
        </FormField>
      </div>
      <Button
        className="h-11 self-start md:h-9"
        disabled={pending}
        onClick={() =>
          run(() => addTimeOff(staffId, { startDate, startTime, endDate, endTime, reason, note }))
        }
      >
        {t("staff.timeOff.add")}
      </Button>
      <FieldError code={error} />
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("staff.timeOff.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {items.map((x) => (
            <li key={x.id} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <StatusPill tone={x.reason === "sick" ? "danger" : "info"}>
                {t(`staff.reasons.${x.reason as "other"}`)}
              </StatusPill>
              <span className="flex-1 text-sm">
                {when(x.startsAt)} — {when(x.endsAt)}
                {x.note && <span className="text-muted-foreground"> · {x.note}</span>}
              </span>
              <DeleteButton
                label={t("common.confirm")}
                onConfirm={() => run(() => deleteScheduleItem("timeOff", x.id, staffId))}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
