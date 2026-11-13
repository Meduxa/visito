"use client";

// The desktop sidebar, foldable to a slim icon rail (Levan, 2026-11-13).
// The width animates; icons keep their place while labels fade out, so nothing
// jumps. The choice is kept in a cookie so the next page load starts the same
// way (no flash). Ctrl/⌘+B folds and unfolds it too.
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { SIDEBAR_COOKIE } from "./sidebar-cookie";

const CollapsedContext = createContext(false);
/** true inside a folded sidebar; false elsewhere (phone header, pages). */
export const useSidebarCollapsed = () => useContext(CollapsedContext);

/** Text that fades out when the sidebar folds (the space is clipped anyway). */
export const SIDEBAR_LABEL =
  "whitespace-nowrap transition-opacity duration-200 group-data-[collapsed=true]/sidebar:pointer-events-none group-data-[collapsed=true]/sidebar:opacity-0";

/**
 * The name beside an icon in the folded sidebar. Opened only by the mouse being
 * over the icon (or keyboard focus), closed when it leaves, on click and on
 * scroll, so a name can never stay behind on screen. Nothing when unfolded.
 */
export function RailTip({ label, children }: { label: string; children: ReactElement }) {
  const collapsed = useSidebarCollapsed();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("blur", close);
    };
  }, [open]);
  return (
    <Tooltip open={collapsed && open} onOpenChange={() => {}}>
      <TooltipTrigger
        asChild
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onPointerDown={() => setOpen(false)}
        onFocus={(e) => setOpen(e.currentTarget.matches(":focus-visible"))}
        onBlur={() => setOpen(false)}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({
  initialCollapsed,
  top,
  footer,
  children,
}: {
  initialCollapsed: boolean;
  top: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("nav");
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  // Ctrl/⌘+B, except while typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "b" || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <CollapsedContext.Provider value={collapsed}>
      <TooltipProvider delayDuration={150}>
        <aside
          data-collapsed={collapsed}
          className={cn(
            "group/sidebar sticky top-0 hidden h-dvh shrink-0 border-r bg-sidebar md:block",
            "transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
            collapsed ? "w-16" : "w-64",
          )}
        >
          {/* scrolls on short screens, but without a visible scrollbar: in the narrow rail it would
              squeeze the icons off-centre and get in the way of the mouse */}
          <div className="flex h-full [scrollbar-width:none] flex-col gap-6 overflow-x-hidden overflow-y-auto p-3 [&::-webkit-scrollbar]:hidden">
            {top}
            {children}
            <div className="mt-auto flex flex-col gap-1 border-t pt-3">{footer}</div>
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t("expand") : t("collapse")}
            title={`${collapsed ? t("expand") : t("collapse")} (Ctrl+B)`}
            data-testid="sidebar-toggle"
            className="absolute top-9 -right-3 z-10 flex size-6 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-[color,transform,box-shadow] duration-200 outline-none hover:scale-110 hover:text-foreground hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronLeft
              aria-hidden
              className={cn(
                "size-3.5 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                collapsed && "rotate-180",
              )}
            />
          </button>
        </aside>
      </TooltipProvider>
    </CollapsedContext.Provider>
  );
}
