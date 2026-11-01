"use client";

import { fromZonedTime } from "date-fns-tz";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CalBooking } from "../queries";

export const PX_PER_MIN = 1.2; // 72 px per hour

export type GridColumn = { key: string; staffId: string; date: string; header: ReactNode };
export type GridBlock = { booking: CalBooking; columnKey: string; start: number; end: number; color: string };

// Static class names per staff colour (Tailwind must see them).
const BLOCK: Record<string, string> = {
  green: "border-staff-green bg-staff-green/15",
  teal: "border-staff-teal bg-staff-teal/15",
  sky: "border-staff-sky bg-staff-sky/15",
  blue: "border-staff-blue bg-staff-blue/15",
  indigo: "border-staff-indigo bg-staff-indigo/15",
  violet: "border-staff-violet bg-staff-violet/15",
  pink: "border-staff-pink bg-staff-pink/15",
  rose: "border-staff-rose bg-staff-rose/15",
  orange: "border-staff-orange bg-staff-orange/15",
  amber: "border-staff-amber bg-staff-amber/15",
};

const useFinePointer = () =>
  useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(pointer: fine)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(pointer: fine)").matches,
    () => false,
  );

const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
};

type Drag = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  dyMin: number;
  colIndex: number;
  shiftX: number; // px to the column under the pointer, measured while dragging
  moved: boolean;
};

export function TimeGrid({
  columns,
  blocks,
  timeZone,
  dayStartMin,
  dayEndMin,
  stepMin,
  working,
  timeOff,
  canDrag,
  onEmptyClick,
  onBlockClick,
  onMove,
}: {
  columns: GridColumn[];
  blocks: GridBlock[];
  timeZone: string;
  dayStartMin: number;
  dayEndMin: number;
  stepMin: number;
  working: (col: GridColumn) => [number, number][];
  timeOff: (col: GridColumn) => [number, number][];
  canDrag: (b: CalBooking) => boolean;
  onEmptyClick: (col: GridColumn, start: Date) => void;
  onBlockClick: (bookingId: string) => void;
  onMove: (bookingId: string, col: GridColumn, start: Date, durationMin?: number) => void;
}) {
  const t = useTranslations();
  const fine = useFinePointer();
  const now = useNow();
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const height = (dayEndMin - dayStartMin) * PX_PER_MIN;
  const hours = Array.from(
    { length: Math.ceil((dayEndMin - dayStartMin) / 60) },
    (_, i) => dayStartMin + i * 60,
  );

  const midnight = (date: string) => fromZonedTime(`${date}T00:00`, timeZone).getTime();
  const yOf = (date: string, ms: number) => ((ms - midnight(date)) / 60_000 - dayStartMin) * PX_PER_MIN;
  const snap = (min: number) => Math.round(min / stepMin) * stepMin;

  const colUnder = (x: number) => {
    const i = colRefs.current.findIndex((el) => {
      const r = el?.getBoundingClientRect();
      return r && x >= r.left && x < r.right;
    });
    return i;
  };

  const finishDrag = (block: GridBlock) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) return onBlockClick(block.booking.id);
    const col = columns[d.colIndex] ?? columns.find((c) => c.key === block.columnKey)!;
    if (d.mode === "resize") {
      const duration = Math.max(stepMin, Math.round((block.end - block.start) / 60_000) + d.dyMin);
      return onMove(block.booking.id, col, new Date(block.start), duration);
    }
    const fromCol = columns.find((c) => c.key === block.columnKey)!;
    const startMin = (block.start - midnight(fromCol.date)) / 60_000 + d.dyMin;
    onMove(block.booking.id, col, new Date(midnight(col.date) + startMin * 60_000));
  };

  return (
    // focusable, so keyboard users can scroll sideways when there are many specialists
    <div
      tabIndex={0}
      role="region"
      aria-label={t("nav.calendar")}
      className="overflow-x-auto rounded-xl border bg-card focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="min-w-fit">
        {/* column headers */}
        <div className="sticky top-0 z-20 flex border-b bg-card">
          <div className="w-14 shrink-0" />
          {columns.map((c) => (
            <div key={c.key} className="min-w-40 flex-1 border-l px-2 py-2">
              {c.header}
            </div>
          ))}
        </div>

        <div className="flex">
          {/* hour labels */}
          <div className="relative w-14 shrink-0" style={{ height }}>
            {hours.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums"
                style={{ top: (m - dayStartMin) * PX_PER_MIN }}
              >
                {String(Math.floor(m / 60)).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {columns.map((col, ci) => {
            const base = midnight(col.date);
            const colBlocks = blocks.filter((b) => b.columnKey === col.key);
            const nowY = yOf(col.date, now);
            return (
              <div
                key={col.key}
                ref={(el) => {
                  colRefs.current[ci] = el;
                }}
                className="relative min-w-40 flex-1 cursor-cell border-l bg-muted/60"
                style={{ height }}
                onClick={(e) => {
                  if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.empty) return;
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  const min = dayStartMin + Math.floor(y / PX_PER_MIN / stepMin) * stepMin;
                  onEmptyClick(col, new Date(base + min * 60_000));
                }}
              >
                {/* working time is white, the rest stays shaded */}
                {working(col).map(([s, e], i) => (
                  <div
                    key={i}
                    data-empty="1"
                    className="absolute inset-x-0 bg-card"
                    style={{ top: yOf(col.date, s), height: ((e - s) / 60_000) * PX_PER_MIN }}
                  />
                ))}
                {timeOff(col).map(([s, e], i) => (
                  <div
                    key={`o${i}`}
                    className="pointer-events-none absolute inset-x-0 bg-[repeating-linear-gradient(135deg,var(--muted)_0_6px,transparent_6px_12px)]"
                    style={{
                      top: Math.max(0, yOf(col.date, s)),
                      height: Math.min(height, ((e - s) / 60_000) * PX_PER_MIN),
                    }}
                  />
                ))}
                {hours.map((m) => (
                  <div
                    key={m}
                    className="pointer-events-none absolute inset-x-0 border-t border-border/70"
                    style={{ top: (m - dayStartMin) * PX_PER_MIN }}
                  />
                ))}
                {nowY >= 0 && nowY <= height && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive"
                    style={{ top: nowY }}
                    aria-hidden
                  >
                    <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-destructive" />
                  </div>
                )}

                {colBlocks.map((b) => {
                  const isDragging = drag?.id === b.booking.id;
                  const draggable = fine && canDrag(b.booking);
                  const top =
                    yOf(col.date, b.start) +
                    (isDragging && drag.mode === "move" ? drag.dyMin * PX_PER_MIN : 0);
                  const h =
                    ((b.end - b.start) / 60_000 + (isDragging && drag.mode === "resize" ? drag.dyMin : 0)) *
                    PX_PER_MIN;
                  const shiftX = isDragging && drag.mode === "move" ? drag.shiftX : 0;
                  const startLocal = new Date(b.start).toLocaleTimeString("en-GB", {
                    timeZone,
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const endLocal = new Date(b.end).toLocaleTimeString("en-GB", {
                    timeZone,
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={b.booking.id + b.columnKey}
                      role="button"
                      tabIndex={0}
                      aria-label={`${startLocal}–${endLocal} ${b.booking.client?.name ?? ""} ${b.booking.items.map((i) => i.name).join(", ")}`}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onBlockClick(b.booking.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!draggable) onBlockClick(b.booking.id);
                      }}
                      onPointerDown={(e) => {
                        if (!draggable || e.button !== 0) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        const resize = (e.target as HTMLElement).dataset.resize === "1";
                        setDrag({
                          id: b.booking.id,
                          mode: resize ? "resize" : "move",
                          startX: e.clientX,
                          startY: e.clientY,
                          dyMin: 0,
                          colIndex: ci,
                          shiftX: 0,
                          moved: false,
                        });
                      }}
                      onPointerMove={(e) => {
                        if (!isDragging) return;
                        const dyMin = snap((e.clientY - drag.startY) / PX_PER_MIN);
                        const colIndex =
                          drag.mode === "move" ? Math.max(0, colUnder(e.clientX)) : drag.colIndex;
                        const moved =
                          drag.moved ||
                          Math.abs(e.clientY - drag.startY) > 4 ||
                          Math.abs(e.clientX - drag.startX) > 4;
                        if (dyMin !== drag.dyMin || colIndex !== drag.colIndex || moved !== drag.moved) {
                          const left = (i: number) => colRefs.current[i]?.getBoundingClientRect().left ?? 0;
                          setDrag({ ...drag, dyMin, colIndex, moved, shiftX: left(colIndex) - left(ci) });
                        }
                      }}
                      onPointerUp={(e) => {
                        if (!isDragging) return;
                        e.stopPropagation();
                        finishDrag(b);
                      }}
                      onPointerCancel={() => setDrag(null)}
                      className={cn(
                        "absolute inset-x-1 z-10 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        BLOCK[b.color] ?? BLOCK.green,
                        draggable && "cursor-grab touch-none active:cursor-grabbing",
                        b.booking.status === "pending" && "border-dashed",
                        ["completed", "no_show"].includes(b.booking.status) && "bg-card", // done: no fill, still readable
                        isDragging && drag.moved && "z-30 shadow-lg ring-2 ring-primary",
                      )}
                      style={{
                        top,
                        height: Math.max(h, 18),
                        transform: shiftX ? `translateX(${shiftX}px)` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-1 font-medium">
                        <span className="tabular-nums">{startLocal}</span>
                        <span className="truncate">{b.booking.client?.name ?? t("calendar.walkIn")}</span>
                        {b.booking.client?.importantNote && (
                          <TriangleAlert className="size-3 shrink-0 text-warning-ink" aria-hidden />
                        )}
                      </div>
                      <div className="truncate text-muted-foreground">
                        {b.booking.items.map((i) => i.name).join(", ")}
                      </div>
                      {draggable && (
                        <div
                          data-resize="1"
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                          aria-hidden
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
