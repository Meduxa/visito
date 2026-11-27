"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { changeMemberRole, removeMember } from "../actions";

// The owner's controls for one team member: role and "remove from team"
// (test plan #66). Never shown for the owner's own row or another owner.
export function MemberControls({
  id,
  name,
  role,
  staffName,
}: {
  id: string;
  name: string;
  role: "admin" | "staff";
  staffName: string | null;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Select
        value={role}
        disabled={pending}
        onValueChange={(next) =>
          startTransition(async () => {
            const result = await changeMemberRole(id, next);
            if (result.ok) toast.success(t("team.roleChanged"));
            else toast.error(t(`errors.${result.error}`));
          })
        }
      >
        <SelectTrigger className="h-11 w-40 md:h-8" aria-label={t("team.roleFor", { name })}>
          <SelectValue>{t(`roles.${role}`)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(["admin", "staff"] as const).map((r) => (
            <SelectItem key={r} value={r}>
              {t(`roles.${r}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            size="sm"
            className="h-11 text-destructive md:h-8"
            disabled={pending}
            aria-label={t("team.removeFor", { name })}
          >
            {t("team.remove")}
          </Button>
        }
        title={t("team.removeTitle", { name })}
        description={
          staffName
            ? `${t("team.removeConfirm")} ${t("team.removeStaffHint", { staff: staffName })}`
            : t("team.removeConfirm")
        }
        confirmLabel={t("team.remove")}
        cancelLabel={t("common.dialogNo")}
        onConfirm={() =>
          startTransition(async () => {
            const result = await removeMember(id);
            if (result.ok) toast.success(t("team.removed", { name }));
            else toast.error(t(`errors.${result.error}`));
          })
        }
      />
    </div>
  );
}
