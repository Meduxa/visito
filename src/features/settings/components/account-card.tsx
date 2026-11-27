"use client";

import { Download, FileJson, ScrollText, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { cancelDeletion, requestDeletion } from "../account-actions";

// Owner only: download everything, see the audit log, delete the business.
export function AccountCard({
  businessName,
  deletionDue,
}: {
  businessName: string;
  deletionDue: string | null;
}) {
  const t = useTranslations("accountData");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild className="h-11 md:h-9">
          <a href={`/api/export/business?format=xlsx&locale=${locale}`} download>
            <Download aria-hidden />
            {t("excel")}
          </a>
        </Button>
        <Button variant="outline" asChild className="h-11 md:h-9">
          <a href="/api/export/business?format=json" download>
            <FileJson aria-hidden />
            {t("json")}
          </a>
        </Button>
        <Button variant="outline" asChild className="h-11 md:h-9">
          <Link href="/settings/audit">
            <ScrollText aria-hidden />
            {t("audit")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t pt-4">
        <h3 className="text-sm font-medium text-destructive">{t("deleteTitle")}</h3>
        {deletionDue ? (
          <>
            <p className="text-sm">{t("scheduled", { date: deletionDue })}</p>
            <FieldError code={error} />
            <Button
              variant="outline"
              className="h-11 self-start md:h-9"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await cancelDeletion();
                  if (!r.ok) return setError(r.error);
                  toast.success(t("cancelled"));
                  router.refresh();
                })
              }
            >
              {t("cancel")}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("deleteHint")}</p>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-11 self-start text-destructive md:h-9">
                  <Trash2 aria-hidden />
                  {t("delete")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("deleteTitle")}</DialogTitle>
                  <DialogDescription>{t("deleteConfirm", { name: businessName })}</DialogDescription>
                </DialogHeader>
                <FormField id="del-name" label={t("typeName")} error={error}>
                  <Input
                    id="del-name"
                    autoComplete="off"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </FormField>
                <DialogFooter>
                  <Button
                    variant="destructive"
                    className="h-11 md:h-9"
                    disabled={pending || name.trim() !== businessName}
                    onClick={() =>
                      startTransition(async () => {
                        setError(undefined);
                        const r = await requestDeletion(name);
                        if (!r.ok) return setError(r.error);
                        setOpen(false);
                        toast.success(t("requested"));
                        router.refresh();
                      })
                    }
                  >
                    {t("deleteFinal")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </Card>
  );
}
