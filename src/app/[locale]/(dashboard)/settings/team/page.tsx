import { MailPlus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fullDate, ymdIn } from "@/lib/date-format";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteForm } from "@/features/team/components/invite-form";
import { RevokeInviteButton } from "@/features/team/components/revoke-invite-button";
import { getTeam } from "@/features/team/queries";
import { AccessCard } from "@/features/settings/components/settings-view";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/team">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "team" });
  return { title: t("title") };
}

export default async function TeamPage({ params }: PageProps<"/[locale]/settings/team">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [user, tenant] = await Promise.all([requireUser(locale), getActiveTenant()]);
  if (!tenant) return null;

  const [t, team] = await Promise.all([getTranslations(), getTeam(tenant.tenantId)]);
  const manager = canManage(tenant.role);
  // what staff may see, whether admins see money: set here, next to the people
  const access = manager
    ? (
        await (
          await createClient()
        )
          .from("tenant_settings")
          .select("staff_sees_all_clients, staff_sees_all_bookings, admins_see_revenue")
          .eq("tenant_id", tenant.tenantId)
          .single()
      ).data
    : null;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title={t("team.title")} description={t("team.subtitle", { business: tenant.name })} />

      {manager ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("team.inviteTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteForm />
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertDescription>{t("team.staffNotice")}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("team.membersTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {team.members.map((m) => (
              <li key={m.id} className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 flex-1 text-sm font-medium break-words">
                  {m.fullName || t("team.noName")}
                  {m.userId === user.id && (
                    <span className="font-normal text-muted-foreground"> ({t("team.you")})</span>
                  )}
                </span>
                <Badge variant={m.role === "owner" ? "default" : "secondary"}>{t(`roles.${m.role}`)}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {manager && (
        <Card>
          <CardHeader>
            <CardTitle>{t("team.invitesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {team.invites.length === 0 ? (
              <EmptyState className="py-6" icon={<MailPlus />} title={t("team.invitesEmpty")} />
            ) : (
              <ul className="flex flex-col divide-y">
                {team.invites.map((inv) => (
                  <li key={inv.id} className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium break-all">{inv.email}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(`roles.${inv.role}`)} ·{" "}
                        {t("team.expires", {
                          date: fullDate(t, ymdIn(inv.expiresAt)),
                        })}
                      </span>
                    </span>
                    <RevokeInviteButton id={inv.id} email={inv.email} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      {access && (
        <AccessCard
          isOwner={tenant.role === "owner"}
          initial={{
            staffSeesAllClients: access.staff_sees_all_clients,
            staffSeesAllBookings: access.staff_sees_all_bookings,
            adminsSeeRevenue: access.admins_see_revenue,
          }}
        />
      )}
    </div>
  );
}
