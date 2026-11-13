"use client";

import { Download, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { SIDEBAR_LABEL } from "@/components/app-shell/sidebar";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registers the service worker (production only; see public/sw.js). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

const noop = () => () => undefined;
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * "Install the app": a button where the browser offers it (Android, Chrome,
 * Edge); on iPhone/iPad a short hint, since Safari has no install button.
 * Hidden once installed.
 */
export function InstallApp() {
  const t = useTranslations("pwa");
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const standalone = useSyncExternalStore(noop, isStandalone, () => true);
  const ios = useSyncExternalStore(noop, isIos, () => false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone) return null;
  if (deferred)
    return (
      <Button
        variant="ghost"
        className="h-11 justify-start gap-2 px-3 md:h-9"
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
      >
        <Download aria-hidden />
        <span className={SIDEBAR_LABEL}>{t("install")}</span>
      </Button>
    );
  if (ios)
    return (
      <p className="flex items-start gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Share className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className={SIDEBAR_LABEL}>{t("iosHint")}</span>
      </p>
    );
  return null;
}
