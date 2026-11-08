// The sections of Settings (decision 021): one page each under /settings/…,
// grouped in a menu. Who sees which section is decided here and again on each
// page (the page redirects; this list only hides links).
import {
  Armchair,
  Bell,
  Building2,
  CalendarOff,
  Globe,
  Link2,
  MessageSquare,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type SettingsSectionKey =
  "business" | "booking" | "website" | "closures" | "resources" | "notifications" | "sms" | "team" | "data";

type Section = {
  key: SettingsSectionKey;
  href: `/settings/${string}`;
  icon: LucideIcon;
  /** other addresses that belong to this section (sub-pages) */
  also?: string[];
  only?: "owner" | "dental";
};

export const SETTINGS_GROUPS: { key: "business" | "messages" | "people"; sections: Section[] }[] = [
  {
    key: "business",
    sections: [
      { key: "business", href: "/settings/business", icon: Building2 },
      { key: "booking", href: "/settings/booking", icon: Link2 },
      { key: "website", href: "/settings/website", icon: Globe },
      { key: "closures", href: "/settings/closures", icon: CalendarOff },
      { key: "resources", href: "/settings/resources", icon: Armchair, only: "dental" },
    ],
  },
  {
    key: "messages",
    sections: [
      { key: "notifications", href: "/settings/notifications", icon: Bell },
      { key: "sms", href: "/settings/sms", icon: MessageSquare },
    ],
  },
  {
    key: "people",
    sections: [
      { key: "team", href: "/settings/team", icon: UsersRound },
      { key: "data", href: "/settings/data", icon: ShieldCheck, also: ["/settings/audit"], only: "owner" },
    ],
  },
];

/** The groups with only the sections this person may open. */
export function visibleSettings(opts: { isOwner: boolean; isDental: boolean }) {
  return SETTINGS_GROUPS.map((g) => ({
    ...g,
    sections: g.sections.filter((s) => !s.only || (s.only === "owner" ? opts.isOwner : opts.isDental)),
  }));
}
