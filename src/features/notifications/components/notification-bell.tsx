"use client";

import { Bell, CalendarPlus, RotateCw, TriangleAlert, X } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { markNotificationsRead } from "../actions";
import type { NotificationFeed, NotificationItem } from "../queries";

// One shared poller for every bell on the page (the sidebar and the phone
// header both render one): refreshes every minute, on window focus and when
// the panel opens. No push needed (decision 019).
type State = { status: "loading" | "ready" | "error"; feed: NotificationFeed | null };
const POLL_MS = 60_000;
const SERVER_STATE: State = { status: "loading", feed: null };
let state: State = SERVER_STATE;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

const emit = (next: State) => {
  state = next;
  listeners.forEach((cb) => cb());
};

async function refresh() {
  try {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    emit({ status: "ready", feed: (await res.json()) as NotificationFeed });
  } catch {
    // keep showing what we had; the panel offers "try again"
    emit({ status: "error", feed: state.feed });
  }
}

const onFocus = () => void refresh();

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    void refresh();
    timer = setInterval(() => void refresh(), POLL_MS);
    window.addEventListener("focus", onFocus);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size) {
      if (timer) clearInterval(timer);
      timer = null;
      window.removeEventListener("focus", onFocus);
    }
  };
}

// Optimistic: mark read here first, then tell the server.
function markRead(items: NotificationItem[] | null) {
  const feed = state.feed;
  if (feed) {
    const hit = (n: NotificationItem) =>
      !items || items.some((i) => i.kind === n.kind && i.bookingId === n.bookingId);
    const nextItems = feed.items.map((n) => (hit(n) ? { ...n, read: true } : n));
    const newlyRead = feed.items.filter((n) => !n.read && hit(n)).length;
    emit({
      ...state,
      feed: { items: nextItems, unread: items ? Math.max(0, feed.unread - newlyRead) : 0 },
    });
  }
  void markNotificationsRead(items ? items.map((i) => ({ kind: i.kind, bookingId: i.bookingId })) : null)
    .then((r) => {
      if (!r.ok) void refresh();
    })
    .catch(() => void refresh());
}

export function NotificationBell({ className }: { className?: string }) {
  const t = useTranslations("notifications");
  const { status, feed } = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const unread = feed?.unread ?? 0;

  const openItem = (n: NotificationItem) => {
    if (!n.read) markRead([n]);
    setOpen(false);
    router.push(`/calendar?${new URLSearchParams({ date: n.date, booking: n.bookingId })}`);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void refresh();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className={cn("relative shrink-0", className)}
          aria-label={unread ? `${t("title")} — ${t("unread", { count: unread })}` : t("title")}
          data-testid="notification-bell"
        >
          <Bell className="size-5" aria-hidden />
          {unread > 0 && (
            <span
              aria-hidden
              data-testid="notification-badge"
              className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] leading-none font-semibold text-primary-foreground tabular-nums"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="w-[calc(100vw-2rem)] max-w-sm gap-0 p-0"
        aria-label={t("title")}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <h2 className="flex-1 text-base font-semibold">{t("title")}</h2>
          {unread > 0 && (
            <Button variant="link" size="sm" className="h-auto px-0" onClick={() => markRead(null)}>
              {t("markAllRead")}
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label={t("close")} onClick={() => setOpen(false)}>
            <X aria-hidden />
          </Button>
        </div>
        <Body status={status} feed={feed} onOpenItem={openItem} />
      </PopoverContent>
    </Popover>
  );
}

function Body({
  status,
  feed,
  onOpenItem,
}: {
  status: State["status"];
  feed: NotificationFeed | null;
  onOpenItem: (n: NotificationItem) => void;
}) {
  const t = useTranslations("notifications");
  const tc = useTranslations("common");

  if (!feed && status === "loading")
    return (
      <div className="flex flex-col gap-3 p-4" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );

  if (!feed)
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">{t("error")}</p>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RotateCw aria-hidden />
          {tc("retry")}
        </Button>
      </div>
    );

  if (!feed.items.length)
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Bell className="size-5 text-muted-foreground" aria-hidden />
        </span>
        <p className="text-sm font-medium">{t("empty")}</p>
        <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
      </div>
    );

  return (
    <>
      {status === "error" && (
        <p role="alert" className="border-b bg-destructive-soft px-4 py-2 text-xs text-destructive-ink">
          {t("error")}
        </p>
      )}
      <ul className="max-h-[min(28rem,70dvh)] divide-y overflow-y-auto" data-testid="notification-list">
        {feed.items.map((n) => (
          <li key={`${n.kind}:${n.bookingId}`}>
            <Row n={n} onOpen={() => onOpenItem(n)} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Row({ n, onOpen }: { n: NotificationItem; onOpen: () => void }) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const now = useNow({ updateInterval: POLL_MS });
  const online = n.kind === "online_booking";
  const Icon = online ? CalendarPlus : TriangleAlert;
  const details = [
    n.client ?? t("noClient"),
    t("when", { date: n.dayMonth, time: n.time }),
    n.services,
    n.staff,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full gap-3 px-4 py-3 text-left outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      data-testid="notification-item"
      data-kind={n.kind}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          online ? "bg-success-soft text-success-ink" : "bg-warning-soft text-warning-ink",
        )}
      >
        <Icon className="size-4.5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-sm", n.read ? "font-medium" : "font-semibold")}>
          {online ? t("onlineBooking") : t("needsAction")}
        </span>
        <span className="text-sm text-muted-foreground">{details.join(" · ")}</span>
        <span className="text-xs text-muted-foreground">
          <time dateTime={n.at}>{format.relativeTime(new Date(n.at), now)}</time>
        </span>
      </span>
      {!n.read && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
          <span className="sr-only">{t("unread", { count: 1 })}</span>
        </span>
      )}
    </button>
  );
}
