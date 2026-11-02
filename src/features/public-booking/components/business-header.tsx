import { CalendarCheck, Clock, ExternalLink, MapPin, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { initials } from "@/lib/initials";
import type { PublicBusinessView } from "../queries";
import { OpenBadge } from "./open-badge";

// The business's small website, above the booking flow: a full-width cover with
// a flowing bottom edge in the business's theme colour, logo, name, open/closed
// today, book / call / directions; below it about, photos, team and hours.
export async function BusinessHeader({ business }: { business: PublicBusinessView }) {
  const t = await getTranslations();
  const map = business.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`
    : null;
  const social = [
    business.instagram && { name: "Instagram", href: `https://www.instagram.com/${business.instagram}` },
    business.facebook && { name: "Facebook", href: `https://www.facebook.com/${business.facebook}` },
  ].filter(Boolean) as { name: string; href: string }[];
  const chip =
    "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/25 bg-black/30 px-3 py-1 text-sm text-white backdrop-blur-md";

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden bg-primary">
        {business.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- our own storage
          <img src={business.coverUrl} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
        )}
        {/* darker towards the bottom, so white text stays readable on any photo */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/35 to-black/15"
        />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 pt-16 pb-20 text-center text-white md:pt-24 md:pb-28 lg:items-start lg:pt-32 lg:pb-32 lg:text-left">
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own storage
            <img
              src={business.logoUrl}
              alt=""
              className="size-20 rounded-2xl bg-card object-cover shadow-xl ring-4 ring-white/80 md:size-24"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-20 items-center justify-center rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground shadow-xl ring-4 ring-white/80 md:size-24"
            >
              {initials(business.name, "")}
            </span>
          )}
          <h1 className="text-3xl font-semibold text-balance drop-shadow-md md:text-5xl">{business.name}</h1>
          <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
            <OpenBadge hours={business.hours} timeZone={business.timeZone} className={chip} />
            {business.address && map && (
              <a href={map} target="_blank" rel="noopener noreferrer" className={chip}>
                <MapPin className="size-4" aria-hidden />
                {business.address}
              </a>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-1 lg:justify-start">
            <Button asChild className="h-11 rounded-full px-5 shadow-lg">
              <a href="#book">
                <CalendarCheck aria-hidden />
                {t("publicBooking.bookNow")}
              </a>
            </Button>
            {business.phone && (
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-full border-white/40 bg-black/40 px-5 text-white backdrop-blur-md hover:bg-black/55 hover:text-white"
              >
                <a href={`tel:${business.phone}`}>
                  <Phone aria-hidden />
                  {t("publicBooking.call")}
                </a>
              </Button>
            )}
            {map && (
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-full border-white/40 bg-black/40 px-5 text-white backdrop-blur-md hover:bg-black/55 hover:text-white"
              >
                <a href={map} target="_blank" rel="noopener noreferrer">
                  <MapPin aria-hidden />
                  {t("publicBooking.directions")}
                </a>
              </Button>
            )}
          </div>
        </div>
        {/* the flowing edge: a ribbon in the theme colour behind the page-coloured wave */}
        <svg
          aria-hidden
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-12 w-full md:h-20"
        >
          <path
            d="M0 70C220 112 470 16 760 46S1250 118 1440 66V120H0Z"
            className="fill-primary"
            opacity="0.55"
          />
          <path d="M0 92C300 126 540 48 830 72S1270 112 1440 90V120H0Z" className="fill-background" />
        </svg>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4">
        {(business.about || social.length > 0) && (
          <Card className="gap-3 p-4 md:p-6">
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
          </Card>
        )}

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
                <li
                  key={s.id}
                  className="flex w-24 shrink-0 flex-col items-center gap-1 text-center sm:w-auto"
                >
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
    </div>
  );
}
