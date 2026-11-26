"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { revokeInvite } from "../actions";

/** Window event (detail = email) so the invite form stops showing that link. */
export const INVITE_REVOKED = "visito:invite-revoked";

export function RevokeInviteButton({ id, email }: { id: string; email: string }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="h-11 text-destructive md:h-8"
          disabled={pending}
          aria-label={t("team.revokeFor", { email })}
        >
          {t("team.revoke")}
        </Button>
      }
      description={t("team.revokeConfirm", { email })}
      confirmLabel={t("team.revoke")}
      cancelLabel={t("common.dialogNo")}
      onConfirm={() =>
        startTransition(async () => {
          const result = await revokeInvite(id);
          if (result.ok) {
            window.dispatchEvent(new CustomEvent(INVITE_REVOKED, { detail: email }));
            toast.success(t("team.revoked"));
          } else toast.error(t(`errors.${result.error}`));
        })
      }
    />
  );
}
