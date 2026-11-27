"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Every destructive action asks first (CLAUDE.md §4).
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  children,
}: {
  trigger: ReactNode;
  title?: string;
  description: string;
  confirmLabel?: string;
  /** the button that closes without doing anything (default: "Cancel") */
  cancelLabel?: string;
  onConfirm: () => void;
  /** extra fields inside the window (e.g. a reason) */
  children?: ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t("confirm")}</AlertDialogTitle>
          {/* the same words twice read as a mistake: keep it for screen readers only */}
          <AlertDialogDescription className={description === (title ?? t("confirm")) ? "sr-only" : undefined}>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel ?? t("dialogNo")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmLabel ?? t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
