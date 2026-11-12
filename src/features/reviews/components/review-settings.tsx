"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { FormField, SwitchRow } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "@/i18n/navigation";
import { saveReviewSettings } from "../actions";

export function ReviewSettingsCard({
  initial,
}: {
  initial: { ask: boolean; delayHours: number; showOnPage: boolean };
}) {
  const t = useTranslations("reviewSettings");
  const common = useTranslations("common");
  const router = useRouter();
  const [v, setV] = useState({ ...initial, delayHours: String(initial.delayHours) });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <Card className="gap-4 p-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(undefined);
            const r = await saveReviewSettings(v);
            if (!r.ok) return setError(r.error);
            toast.success(common("saved"));
            router.refresh();
          });
        }}
      >
        <SwitchRow label={t("ask")} hint={t("askHint")}>
          <Switch checked={v.ask} onCheckedChange={(ask) => setV({ ...v, ask })} />
        </SwitchRow>
        <FormField id="review-delay" label={t("delay")} hint={t("delayHint")}>
          <Input
            id="review-delay"
            inputMode="numeric"
            disabled={!v.ask}
            className="h-11 w-32 md:h-9"
            value={v.delayHours}
            onChange={(e) => setV({ ...v, delayHours: e.target.value.replace(/\D/g, "") })}
          />
        </FormField>
        <SwitchRow label={t("show")} hint={t("showHint")}>
          <Switch checked={v.showOnPage} onCheckedChange={(showOnPage) => setV({ ...v, showOnPage })} />
        </SwitchRow>
        <FieldError code={error} />
        <Button type="submit" className="h-11 self-start md:h-9" disabled={pending}>
          {common("save")}
        </Button>
      </form>
    </Card>
  );
}
