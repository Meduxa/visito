"use client";

import { Copy, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { intervalProblem, WEEKDAYS, type Interval } from "@/lib/time";
import type { ActionResult } from "@/lib/action-result";

// locationId: the branch of a working interval (staff schedules with several branches, decision 032)
export type WeekInterval = Interval & { locationId?: string };
export type Week = Record<number, WeekInterval[]>;

// Weekly hours with several intervals per day. Used for staff schedules and
// business opening hours; the caller decides where it is saved.
export function WeekEditor({
  initial,
  hint,
  onSave,
  branches,
}: {
  initial: Week;
  hint: string;
  onSave: (week: Record<string, WeekInterval[]>) => Promise<ActionResult>;
  /** more than one: each interval gets a branch choice */
  branches?: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const [week, setWeek] = useState<Week>(() =>
    Object.fromEntries(WEEKDAYS.map((d) => [d, initial[d] ?? []])),
  );
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const multi = (branches?.length ?? 0) > 1;
  const firstBranch = multi ? branches![0].id : undefined;
  const set = (d: number, list: WeekInterval[]) => setWeek((w) => ({ ...w, [d]: list }));
  const invalidDays = WEEKDAYS.filter((d) => intervalProblem(week[d]) !== null);

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      if (invalidDays.length) return setError("scheduleInvalid");
      const r = await onSave(Object.fromEntries(WEEKDAYS.map((d) => [String(d), week[d]])));
      if (!r.ok) return setError(r.error);
      toast.success(t("common.saved"));
    });

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{hint}</p>
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {WEEKDAYS.map((d) => {
          const list = week[d];
          const working = list.length > 0;
          const bad = invalidDays.includes(d);
          return (
            <li key={d} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
              <label className="flex min-h-9 w-40 shrink-0 cursor-pointer items-center gap-3">
                <Switch
                  checked={working}
                  onCheckedChange={(on) =>
                    set(d, on ? [{ start: "10:00", end: "19:00", locationId: firstBranch }] : [])
                  }
                  aria-label={t(`weekdays.long.${d}`)}
                />
                <span className="text-sm font-medium">{t(`weekdays.long.${d}`)}</span>
              </label>
              {working ? (
                <div className="flex flex-1 flex-col gap-2">
                  {list.map((iv, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="time"
                        step={300}
                        value={iv.start}
                        aria-label={`${t(`weekdays.long.${d}`)} ${t("staff.timeOff.from")}`}
                        aria-invalid={bad}
                        onChange={(e) =>
                          set(
                            d,
                            list.map((x, k) => (k === i ? { ...x, start: e.target.value } : x)),
                          )
                        }
                        className="h-11 w-32 md:h-9"
                      />
                      <span aria-hidden>–</span>
                      <Input
                        type="time"
                        step={300}
                        value={iv.end}
                        aria-label={`${t(`weekdays.long.${d}`)} ${t("staff.timeOff.to")}`}
                        aria-invalid={bad}
                        onChange={(e) =>
                          set(
                            d,
                            list.map((x, k) => (k === i ? { ...x, end: e.target.value } : x)),
                          )
                        }
                        className="h-11 w-32 md:h-9"
                      />
                      {multi && (
                        <select
                          value={iv.locationId ?? firstBranch}
                          aria-label={`${t(`weekdays.long.${d}`)} ${t("branches.branch")}`}
                          onChange={(e) =>
                            set(
                              d,
                              list.map((x, k) => (k === i ? { ...x, locationId: e.target.value } : x)),
                            )
                          }
                          className="h-11 max-w-40 min-w-0 rounded-lg border bg-background px-2 text-sm md:h-9"
                        >
                          {branches!.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {list.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("common.delete")}
                          onClick={() =>
                            set(
                              d,
                              list.filter((_, k) => k !== i),
                            )
                          }
                        >
                          <X aria-hidden />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 self-start"
                    disabled={list.length >= 4}
                    onClick={() =>
                      set(d, [
                        ...list,
                        {
                          start: list.at(-1)?.end ?? "10:00",
                          end: "20:00",
                          locationId: list.at(-1)?.locationId ?? firstBranch,
                        },
                      ])
                    }
                  >
                    <Plus aria-hidden />
                    {t("staff.schedule.addInterval")}
                  </Button>
                </div>
              ) : (
                <span className="flex min-h-9 items-center text-sm text-muted-foreground">
                  {t("staff.schedule.dayOff")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <FieldError code={error} />
      <div className="flex flex-wrap gap-2">
        <Button className="h-11 md:h-9" disabled={pending} onClick={save}>
          {t("common.save")}
        </Button>
        <Button
          variant="outline"
          className="h-11 md:h-9"
          disabled={!week[1].length}
          onClick={() => setWeek((w) => ({ ...w, 2: [...w[1]], 3: [...w[1]], 4: [...w[1]], 5: [...w[1]] }))}
        >
          <Copy aria-hidden />
          {t("staff.schedule.copyToWeekdays")}
        </Button>
      </div>
    </section>
  );
}
