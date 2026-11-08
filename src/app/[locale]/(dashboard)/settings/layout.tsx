import type { ReactNode } from "react";
import { SettingsFrame } from "@/features/settings/components/settings-nav";
import { canManage, getActiveTenant } from "@/lib/tenant";

// Settings sections share a menu (decision 021). Staff only have the Team page,
// so they get it without the menu.
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) return children;
  return (
    <SettingsFrame isOwner={tenant.role === "owner"} isDental={tenant.type === "dental"}>
      {children}
    </SettingsFrame>
  );
}
