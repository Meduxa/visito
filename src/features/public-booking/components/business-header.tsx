import { CalendarCheck, Clock, ExternalLink, MapPin, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { initials } from "@/lib/initials";
import type { PublicBusinessView } from "../queries";

// The business's small website, above the booking flow: cover, logo and name,
// book / call / directions, about, photos, team, opening hours, social links.
export async function BusinessHeader({ business }: { business: PublicBusinessView }) {
  const t = await getTranslations();
  const map = business.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`
    : null;
  const social = [
    business.instagram && { name: "Instagram", href: `https://www.instagram.com/${business.instagram}` },
    business.facebook && { name: "Facebook", href: `https://www.facebook.com/${business.facebook}` },
  ].filter(Boolean) as { name: string; href: string }[];

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-0 overflow-hidden p-0">
        {business.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own storage
          <img
            src={business.coverUrl}
            alt=""
            className="aspect-[16/7] w-full object-cover lg:aspect-[16/5]"
          />
        ) : (
          <div className="aspect-[16/5] w-full bg-accent lg:aspect-[16/4]" aria-hidden />
        )}
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <div className="-mt-12 flex items-end gap-3 md:-mt-14">
            {business.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- our own storage
              <img
                src={business.logoUrl}
                alt=""
                className="size-20 shrink-0 rounded-full border-4 border-card bg-card object-cover md:size-24"
              />
            ) : (
              <span
                className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-card bg-primary text-xl font-semibold text-primary-foreground md:size-24"
                aria-hidden
              >
                {initials(business.name, "")}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{business.name}</h1>
            {business.address && (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                {business.address}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-11 md:h-10">
              <a href="#book">
                <CalendarCheck aria-hidden />
                {t("publicBooking.bookNow")}
              </a>
            </Button>
            {business.phone && (
              <Button variant="outline" asChild className="h-11 md:h-10">
                <a href={`tel:${business.phone}`}>
                  <Phone aria-hidden />
                  {t("publicBooking.call")}
                </a>
              </Button>
            )}
            {map && (
              <Button variant="outline" asChild className="h-11 md:h-10">
                <a href={map} target="_blank" rel="noopener noreferrer">
                  <MapPin aria-hidden />
                  {t("publicBooking.directions")}
                </a>
              </Button>
            )}
          </div>
          {business.about && (
            <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line md:text-base">
              {business.about}
            </p>
          )}
          {social.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {social.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center gap-1.5 font-medium text-accent-foreground underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {business.photos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-sm font-medium">{t("photos.title")}</h2>
          <ul
            tabIndex={0}
            aria-label={t("photos.title")}
            className="-mx-1 flex snap-x gap-2 overflow-x-auto rounded-lg px-1 pb-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {business.photos.map((src, i) => (
              <li key={src} className="shrink-0 snap-start">
                {/* eslint-disable-next-line @next/next/no-img-element -- our own storage */}
                <img
                  src={src}
                  alt={t("photos.alt", { n: i + 1 })}
                  loading={i > 1 ? "lazy" : undefined}
                  className="h-36 w-48 rounded-lg object-cover sm:h-44 sm:w-60"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {business.staff.length > 0 && (
        <Card className="gap-3 p-4 md:p-6">
          <h2 className="text-base font-semibold">{t("publicBooking.teamTitle")}</h2>
          <ul
            tabIndex={0}
            aria-label={t("publicBooking.teamTitle")}
            className="flex gap-3 overflow-x-auto rounded-lg pb-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:grid sm:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] sm:overflow-visible"
          >
            {business.staff.map((s) => (
              <li key={s.id} className="flex w-24 shrink-0 flex-col items-center gap-1 text-center sm:w-auto">
                {s.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatars from storage
                  <img src={s.photoUrl} alt="" className="size-16 rounded-full object-cover" />
                ) : (
                  <span className="flex size-16 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
                    {initials(s.name, "")}
                  </span>
                )}
                <span className="text-xs leading-tight font-medium">{s.name}</span>
                {s.position && (
                  <span className="text-xs leading-tight text-muted-foreground">{s.position}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <details className="group rounded-xl border bg-card px-4 py-2">
        <summary className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium">
          <Clock className="size-4" aria-hidden />
          {t("publicBooking.hoursTitle")}
        </summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 pb-2 text-sm">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <div key={d} className="contents">
              <dt className="text-muted-foreground">{t(`weekdays.long.${d}` as "weekdays.long.1")}</dt>
              <dd className="tabular-nums">
                {business.hours[d]?.length
                  ? business.hours[d].map(([s, e]) => `${s}–${e}`).join(", ")
                  : t("publicBooking.closed")}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
