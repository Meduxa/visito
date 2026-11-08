import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { AccountBanner } from "@/components/app-shell/account-banner";
import { AccountMenu } from "@/components/app-shell/account-menu";
import { BottomNav, SidebarNav } from "@/components/app-shell/nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrandLogo } from "@/components/brand-logo";
import { InstallApp } from "@/components/pwa";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant, getMyTenants } from "@/lib/tenant";

export default async function DashboardLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser(locale);
  const [active, tenants] = await Promise.all([getActiveTenant(), getMyTenants()]);
  if (!active) redirect(`/${locale}/onboarding`);
  const { data: ownStaffId } = await (
    await createClient()
  ).rpc("current_staff_id", { p_tenant: active.tenantId });

  const menu = (
    <AccountMenu
      user={{ fullName: user.fullName, email: user.email }}
      active={{ tenantId: active.tenantId, name: active.name, role: active.role }}
      tenants={tenants.map((t) => ({ tenantId: t.tenantId, name: t.name }))}
    />
  );

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-3 md:flex">
        <div className="flex items-center justify-between gap-2 pt-2 pr-1">
          <Link
            href="/dashboard"
            className="rounded-lg px-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <BrandLogo className="h-9" />
          </Link>
          <NotificationBell />
        </div>
        <SidebarNav type={active.type} canManage={canManage(active.role)} hasProfile={!!ownStaffId} />
        <div className="mt-auto flex flex-col gap-1 border-t pt-3">
          <InstallApp />
          <ThemeToggle />
          <LanguageSwitcher />
          {menu}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-card px-4 py-2 md:hidden">
          <Link
            href="/dashboard"
            className="shrink-0 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <BrandLogo variant="mark" className="h-8" />
          </Link>
          <NotificationBell />
          <div className="min-w-0 flex-1">{menu}</div>
          <LanguageSwitcher />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-10">
          <AccountBanner tenant={active} />
          {children}
        </main>
      </div>

      <BottomNav type={active.type} myDayFirst={!!ownStaffId && !canManage(active.role)} />
    </div>
  );
}
