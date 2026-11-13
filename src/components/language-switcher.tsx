"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { SIDEBAR_LABEL } from "@/components/app-shell/sidebar";

export function LanguageSwitcher() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-label={t("common.language")}
          title={t("common.language")}
          className="justify-start"
        >
          <Globe aria-hidden />
          <span className={SIDEBAR_LABEL}>{t(`languages.${locale as Locale}`)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(next) =>
            startTransition(() => router.replace(pathname, { locale: next as Locale }))
          }
        >
          {routing.locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l}>
              {t(`languages.${l}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
