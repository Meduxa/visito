"use client";

// Cloudflare Turnstile widget (decision 036). Invisible for most people; it
// shows a small "verify you are human" box only when Cloudflare is unsure.
// Without NEXT_PUBLIC_TURNSTILE_SITE_KEY it renders nothing and every token is "".
//
// Usage: keep a ref, call `await ref.current?.token()` right before the server
// action, then `ref.current?.reset()` after it (a token works only once).
import { useLocale } from "next-intl";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { publicEnv } from "@/lib/env";

export type TurnstileHandle = {
  /** the current token; waits up to 15 s for the check to finish ("" when off) */
  token: () => Promise<string>;
  /** asks for a new token (after one was used) */
  reset: () => void;
};

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;
function loadScript() {
  loading ??= new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve();
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile script"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function Turnstile({ ref }: { ref: Ref<TurnstileHandle> }) {
  const siteKey = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const current = useRef<string | null>(null);
  const waiters = useRef<((t: string) => void)[]>([]);

  useEffect(() => {
    if (!siteKey || !box.current) return;
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          appearance: "interaction-only",
          language: locale,
          callback: (t: string) => {
            current.current = t;
            waiters.current.splice(0).forEach((w) => w(t));
          },
          "expired-callback": () => {
            current.current = null;
          },
          "error-callback": () => {
            current.current = null;
          },
        });
      })
      .catch(() => {
        // the script could not load (offline, blocked): the server decides; it lets
        // requests through only when Cloudflare itself is down
      });
    return () => {
      alive = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, locale]);

  useImperativeHandle(
    ref,
    () => ({
      token: () => {
        if (!siteKey) return Promise.resolve("");
        if (current.current) return Promise.resolve(current.current);
        return new Promise<string>((resolve) => {
          waiters.current.push(resolve);
          setTimeout(() => resolve(current.current ?? ""), 15_000);
        });
      },
      reset: () => {
        current.current = null;
        if (widget.current) window.turnstile?.reset(widget.current);
      },
    }),
    [siteKey],
  );

  if (!siteKey) return null;
  return <div ref={box} className="min-h-0 empty:hidden" data-testid="turnstile" />;
}
