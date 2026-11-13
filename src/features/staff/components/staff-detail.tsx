"use client";

import { ArrowLeft, ImageUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { I18nText } from "@/lib/i18n-text";
import type { PriceShape } from "@/lib/use-format";
import { WeekEditor } from "@/components/week-editor";
import { deleteStaff, linkLogin, saveWeek, setStaffPhoto } from "../actions";
import type { StaffDetail as Detail } from "../queries";
import { StaffAvatar } from "./staff-avatar";
import { StaffForm } from "./staff-form";
import { StaffServicesEditor } from "./staff-services-editor";
import { OverridesEditor, TimeOffEditor } from "./time-off-editor";

const NONE = "__none";

type Props = {
  staff: Detail;
  tenantId: string;
  timeZone: string;
  isDental: boolean;
  catalog: (PriceShape & { id: string; name: I18nText; durationMin: number; categoryName: string })[];
  members: { id: string; name: string; role: string; staffId: string | null }[];
  branches: { id: string; name: string }[];
};

export function StaffDetailView({ staff, tenantId, timeZone, isDental, catalog, members, branches }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      // RLS on storage allows owner/admin writes only into this business's folder.
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${tenantId}/${staff.id}-${Date.now()}.${ext}`;
      const { error } = await createClient()
        .storage.from("staff-photos")
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      const r = await setStaffPhoto(staff.id, path);
      if (!r.ok) throw new Error(r.error);
      toast.success(t("common.saved"));
    } catch {
      toast.error(t("errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" asChild className="-ml-2 h-9 self-start">
        <Link href="/staff">
          <ArrowLeft aria-hidden />
          {t("staff.title")}
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-4">
        <StaffAvatar name={staff.displayName} color={staff.color} photoUrl={staff.photoUrl} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="text-2xl font-semibold break-words">{staff.displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {staff.position || t(`staff.positionTypes.${staff.positionType}`)}
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="gap-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          {(["profile", "services", "schedule", "timeOff"] as const).map((k) => (
            <TabsTrigger key={k} value={k} className="min-h-9">
              {t(`staff.tabs.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="flex flex-col gap-5">
          <Card className="p-4 md:p-6">
            <StaffForm staff={staff} isDental={isDental} onSaved={() => router.refresh()} />
          </Card>

          <Card className="gap-3 p-4">
            <h2 className="font-medium">{t("staff.fields.photo")}</h2>
            <p className="text-xs text-muted-foreground">{t("staff.fields.photoHint")}</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted md:min-h-9">
                <ImageUp className="size-4" aria-hidden />
                {t("staff.fields.uploadPhoto")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
              </label>
              {staff.photoUrl && (
                <Button
                  variant="ghost"
                  className="h-11 md:h-9"
                  onClick={() => startTransition(async () => void (await setStaffPhoto(staff.id, null)))}
                >
                  {t("staff.fields.removePhoto")}
                </Button>
              )}
            </div>
          </Card>

          <Card className="gap-3 p-4">
            <h2 className="font-medium">{t("staff.login.title")}</h2>
            <FormField id="login" label={t("staff.login.hint")}>
              <Select
                value={staff.linkedMembershipId ?? NONE}
                onValueChange={(v) =>
                  startTransition(async () => {
                    const r = await linkLogin(staff.id, v === NONE ? null : v);
                    if (r.ok) toast.success(t("common.saved"));
                    else toast.error(t(`errors.${r.error}`));
                  })
                }
              >
                <SelectTrigger id="login" className="h-11 w-full max-w-sm md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("staff.login.none")}</SelectItem>
                  {members
                    .filter((m) => !m.staffId || m.staffId === staff.id)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} · {t(`roles.${m.role as "staff"}`)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>
          </Card>

          <ConfirmDialog
            description={t("staff.deleteConfirm", { name: staff.displayName })}
            onConfirm={() =>
              startTransition(async () => {
                const r = await deleteStaff(staff.id);
                if (r.ok) {
                  toast.success(t("common.deleted"));
                  router.push("/staff");
                } else toast.error(t(`errors.${r.error}`));
              })
            }
            trigger={
              <Button variant="destructive" className="h-11 self-start md:h-9" disabled={pending}>
                <Trash2 aria-hidden />
                {t("common.delete")}
              </Button>
            }
          />
        </TabsContent>

        <TabsContent value="services">
          <StaffServicesEditor staffId={staff.id} catalog={catalog} selected={staff.services} />
        </TabsContent>

        <TabsContent value="schedule" className="flex flex-col gap-5">
          <WeekEditor
            initial={staff.week}
            hint={t("staff.schedule.hint")}
            onSave={(week) => saveWeek(staff.id, week)}
            branches={branches}
          />
          <OverridesEditor staffId={staff.id} items={staff.overrides} branches={branches} />
        </TabsContent>

        <TabsContent value="timeOff">
          <TimeOffEditor staffId={staff.id} items={staff.timeOff} timeZone={timeZone} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
