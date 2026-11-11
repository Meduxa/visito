"use client";

import { CalendarPlus, Check, ChevronDown, ChevronLeft, Search, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { FieldError } from "@/components/field-error";
import { describedBy, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { fullDate, fullDateTime, ymdIn } from "@/lib/date-format";
import { addDays, dateParts } from "@/lib/dates";
import { makeIcs } from "@/lib/ics";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { bookOnline, findPublicSlots, sendCode, verifyCode, type BookedSummary } from "../actions";
import type { PublicBusinessView, PublicService } from "../queries";
import { CategoryIcon } from "./category-icon";

type Step = "services" | "staff" | "time" | "details" | "verify" | "done";
type Slot = { start: string; staffId: string; staffName: string };

const timeIn = (iso: string, tz: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });

// `header` is the business card (server-rendered): shown on the first and last screens only,
// so on a phone each later step starts at the top. `embedded`: inside a frame on the
// salon's own website, where pages of ours may not be framed, so links open a new tab.
export function BookingFlow({
  business,
  header,
  embedded = false,
}: {
  business: PublicBusinessView;
  header: ReactNode;
  embedded?: boolean;
}) {
  const t = useTranslations();
  const tb = useTranslations("publicBooking");
  const fmt = useFormat();
  const tz = business.timeZone;
  const [today] = useState(() => ymdIn(new Date().toISOString(), tz));

  const [step, setStep] = useState<Step>("services");
  const [picked, setPicked] = useState<string[]>([]);
  const [staffId, setStaffId] = useState<string>("any");
  // "by specialist": the client picks the person first, then only their services
  const [byStaff, setByStaff] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  // free times, remembered with the search they answer; anything else shows as loading
  const [found, setFound] = useState<{ key: string; slots: Slot[] } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    comment: "",
    marketingSms: false,
    marketingEmail: false,
    website: "", // honeypot, hidden from people
  });
  const [code, setCode] = useState("");
  const [pass, setPass] = useState<string | null>(null);
  const [booked, setBooked] = useState<BookedSummary | null>(null);
  const [error, setError] = useState<{ code: string; field?: string }>();
  const [pending, startTransition] = useTransition();

  const heading = useRef<HTMLHeadingElement>(null);
  // move focus to the new step's heading — but not on page load, so a visitor
  // first sees the business (cover, about), not the middle of the page
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    heading.current?.focus();
  }, [step]);

  const chosen = picked.map((k) => business.services.find((s) => s.key === k)!).filter(Boolean);
  const picks = chosen.map((s) => ({ serviceId: s.serviceId, variantId: s.variantId }));
  const totalMin = chosen.reduce((a, s) => a + s.durationMin, 0);
  const totalPrice = fmt.price({
    priceType: chosen.some((s) => s.priceType !== "fixed") ? "from" : "fixed",
    priceMinor: chosen.reduce((a, s) => a + s.priceMinor, 0),
    priceMaxMinor: null,
  });
  const common = business.staff.filter((p) => chosen.every((s) => s.staffIds.includes(p.id)));

  const searchKey = `${date}|${staffId}|${picked.join(",")}|${refresh}`;
  const slots = found?.key === searchKey ? found.slots : null;
  useEffect(() => {
    if (step !== "time") return;
    let live = true;
    findPublicSlots({ slug: business.slug, date, staffId, picks }).then((r) => {
      if (!live) return;
      setFound({ key: searchKey, slots: r.ok ? r.data : [] });
      if (!r.ok) setError({ code: r.error });
    });
    return () => {
      live = false;
    };
    // picks is derived from `picked`, which is part of searchKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, searchKey, business.slug]);

  const go = (next: Step) => {
    setError(undefined);
    setStep(next);
  };

  const book = (proof: string | null) =>
    bookOnline({ slug: business.slug, picks, staffId, start: slot!.start, ...form, pass: proof }).then(
      (r) => {
        if (r.ok) {
          setBooked(r.data);
          go("done");
        } else if (r.error === "slotTaken") {
          setSlot(null);
          setRefresh((n) => n + 1);
          go("time");
          setError({ code: "slotTaken" });
        } else setError({ code: r.error, field: r.field });
      },
    );

  const submitDetails = () =>
    startTransition(async () => {
      setError(undefined);
      if (!business.otpRequired) return book(null);
      if (pass) return go("verify"); // already verified this phone
      const r = await sendCode({ slug: business.slug, phone: form.phone, website: form.website });
      if (r.ok) go("verify");
      else setError({ code: r.error, field: r.field });
    });

  const submitCode = () =>
    startTransition(async () => {
      setError(undefined);
      let proof = pass;
      if (!proof) {
        const v = await verifyCode({ slug: business.slug, phone: form.phone, code });
        if (!v.ok) return setError({ code: v.error, field: "code" });
        proof = v.data.pass;
        setPass(proof);
      }
      await book(proof);
    });

  const steps = (
    business.otpRequired
      ? (["services", "staff", "time", "details", "verify"] as Step[])
      : (["services", "staff", "time", "details"] as Step[])
  ).filter((s) => !(byStaff && s === "staff"));
  const n = steps.indexOf(step) + 1;
  const prev = steps[n - 2];

  if (!business.services.length) {
    return (
      <>
        {header}
        <Column>
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <p>{tb("noServices")}</p>
          </Card>
        </Column>
      </>
    );
  }

  if (step === "done" && booked) {
    const title = `${business.name}: ${chosen.map((s) => s.name).join(", ")}`;
    const ics = () => {
      const blob = new Blob(
        [
          makeIcs({
            uid: booked.token.slice(0, 12),
            start: booked.start,
            end: booked.end,
            title,
            location: business.address,
          }),
        ],
        { type: "text/calendar" },
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${business.slug}.ics`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    return (
      <>
        {header}
        <Column>
          <Card className="items-center gap-4 p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success-ink">
              <Check aria-hidden />
            </span>
            <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">
              {booked.status === "pending" ? tb("pendingTitle") : tb("successTitle")}
            </h2>
            <p className="font-medium">{fullDateTime(t, booked.start, tz)}</p>
            <p className="text-sm text-muted-foreground">
              {chosen.map((s) => s.name).join(", ")} · {booked.staffName}
            </p>
            <p className="text-sm text-muted-foreground">
              {booked.status === "pending"
                ? tb("pendingBody", { business: business.name })
                : tb("successBody", { phone: form.phone })}
            </p>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button className="h-11 md:h-9" onClick={ics}>
                <CalendarPlus aria-hidden />
                {tb("addToCalendar")}
              </Button>
              <Button variant="outline" asChild className="h-11 md:h-9">
                <Link
                  href={`/m/${booked.token}`}
                  {...(embedded ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {tb("manage")}
                </Link>
              </Button>
            </div>
            <Button
              variant="link"
              onClick={() => {
                setPicked([]);
                setSlot(null);
                setBooked(null);
                go("services");
              }}
            >
              {tb("bookAnother")}
            </Button>
          </Card>
        </Column>
      </>
    );
  }

  return (
    <>
      {step === "services" && header}
      <Column>
        {step !== "services" && (
          <p className="px-1 pt-4 text-sm font-medium text-muted-foreground">{business.name}</p>
        )}
        <Card id="book" className="scroll-mt-4 gap-4 p-4 md:p-6">
          <div className="flex items-center gap-2">
            {prev && (
              <Button
                variant="ghost"
                size="icon"
                className="size-11 md:size-9"
                aria-label={tb("back")}
                onClick={() => go(prev)}
              >
                <ChevronLeft aria-hidden />
              </Button>
            )}
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                {tb("stepOf", { n, total: steps.length })}
              </span>
              <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
                {tb(`steps.${step as "services"}`)}
              </h2>
            </div>
          </div>

          {step === "services" && (
            <ServicesStep
              business={business}
              picked={picked}
              toggle={(k) =>
                setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length < 5 ? [...p, k] : p))
              }
              byStaff={byStaff}
              setByStaff={(id) => {
                setByStaff(id);
                // keep only what the chosen person does
                if (id)
                  setPicked((p) =>
                    p.filter((k) => business.services.find((s) => s.key === k)?.staffIds.includes(id)),
                  );
              }}
            />
          )}

          {step === "staff" &&
            (common.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tb("noCommonStaff")}</p>
            ) : (
              <div role="radiogroup" aria-label={tb("steps.staff")} className="grid gap-2 lg:grid-cols-2">
                {[
                  { id: "any", name: tb("anyone"), position: tb("anyoneHint"), photoUrl: null },
                  ...common,
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={staffId === p.id}
                    onClick={() => {
                      setStaffId(p.id);
                      setSlot(null);
                      go("time");
                    }}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      staffId === p.id && "border-primary bg-accent",
                    )}
                  >
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small avatar from storage
                      <img src={p.photoUrl} alt="" className="size-10 rounded-full object-cover" />
                    ) : (
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <UserRound className="size-5" aria-hidden />
                      </span>
                    )}
                    <span className="flex flex-col">
                      <span className="font-medium">{p.name}</span>
                      {p.position && <span className="text-xs text-muted-foreground">{p.position}</span>}
                    </span>
                  </button>
                ))}
              </div>
            ))}

          {step === "time" && error && <FieldError code={error.code} />}
          {step === "time" && (
            <TimeStep
              business={business}
              today={today}
              date={date}
              setDate={(d) => {
                setDate(d);
                setSlot(null);
              }}
              slots={slots}
              slot={slot}
              choose={(s) => {
                setSlot(s);
                go("details");
              }}
            />
          )}

          {(step === "details" || step === "verify") && slot && (
            <div className="rounded-lg bg-muted/60 p-3 text-sm">
              <p className="font-medium">{fullDateTime(t, slot.start, tz)}</p>
              <p className="text-muted-foreground">
                {chosen.map((s) => s.name).join(", ")} · {slot.staffName}
              </p>
              <p className="text-muted-foreground">
                {business.showPrices && `${tb("total")}: ${totalPrice} · `}
                {fmt.duration(totalMin)}
              </p>
            </div>
          )}

          {step === "details" && (
            <form
              className="flex flex-col gap-4 lg:max-w-2xl"
              onSubmit={(e) => {
                e.preventDefault();
                submitDetails();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="pb-first" label={tb("firstName")}>
                  <Input
                    id="pb-first"
                    required
                    maxLength={80}
                    autoComplete="given-name"
                    className="h-11 md:h-9"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </FormField>
                <FormField id="pb-last" label={tb("lastName")}>
                  <Input
                    id="pb-last"
                    maxLength={80}
                    autoComplete="family-name"
                    className="h-11 md:h-9"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </FormField>
              </div>
              <FormField
                id="pb-phone"
                label={tb("phone")}
                hint={tb("phoneHint")}
                error={error?.field === "phone" ? error.code : undefined}
              >
                <Input
                  id="pb-phone"
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="h-11 md:h-9"
                  value={form.phone}
                  onChange={(e) => {
                    setForm({ ...form, phone: e.target.value });
                    setPass(null); // a new number needs a new code
                  }}
                  {...describedBy("pb-phone", error?.field === "phone" ? error.code : undefined)}
                />
              </FormField>
              <FormField id="pb-email" label={tb("email")}>
                <Input
                  id="pb-email"
                  type="email"
                  autoComplete="email"
                  maxLength={200}
                  className="h-11 md:h-9"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </FormField>
              <FormField id="pb-comment" label={tb("comment")}>
                <Textarea
                  id="pb-comment"
                  rows={2}
                  maxLength={500}
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                />
              </FormField>
              {/* bots fill every field; people never see this one */}
              <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label htmlFor="pb-website">Website</label>
                <input
                  id="pb-website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </div>
              <fieldset className="flex flex-col gap-3">
                <legend className="sr-only">{tb("marketingHint")}</legend>
                <ConsentBox
                  id="pb-msms"
                  checked={form.marketingSms}
                  onChange={(v) => setForm({ ...form, marketingSms: v })}
                  label={tb("marketingSms")}
                />
                {form.email.trim() !== "" && (
                  <ConsentBox
                    id="pb-memail"
                    checked={form.marketingEmail}
                    onChange={(v) => setForm({ ...form, marketingEmail: v })}
                    label={tb("marketingEmail")}
                  />
                )}
                <p className="text-xs text-muted-foreground">{tb("marketingHint")}</p>
              </fieldset>
              <p className="text-xs text-muted-foreground">{tb("privacy", { business: business.name })}</p>
              {error && error.field !== "phone" && <FieldError code={error.code} />}
              <Button
                type="submit"
                className="h-11 md:h-9"
                disabled={pending || !form.firstName.trim() || !form.phone.trim()}
              >
                {business.otpRequired ? tb("sendCode") : tb("confirmBooking")}
              </Button>
            </form>
          )}

          {step === "verify" && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                submitCode();
              }}
            >
              {!pass && (
                <>
                  <p className="text-sm">{tb("codeSentTo", { phone: form.phone })}</p>
                  <FormField
                    id="pb-code"
                    label={tb("code")}
                    error={error?.field === "code" ? error.code : undefined}
                  >
                    <Input
                      id="pb-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      className="h-11 w-40 text-center text-lg tracking-widest md:h-10"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      {...describedBy("pb-code", error?.field === "code" ? error.code : undefined)}
                    />
                  </FormField>
                </>
              )}
              {error && error.field !== "code" && <FieldError code={error.code} />}
              <Button
                type="submit"
                className="h-11 md:h-9"
                disabled={pending || (!pass && code.length !== 6)}
              >
                {tb("confirmBooking")}
              </Button>
              {!pass && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 md:h-9"
                    disabled={pending}
                    onClick={() => {
                      setCode("");
                      submitDetails();
                    }}
                  >
                    {tb("resend")}
                  </Button>
                  <Button type="button" variant="ghost" className="h-11 md:h-9" onClick={() => go("details")}>
                    {tb("changePhone")}
                  </Button>
                </div>
              )}
            </form>
          )}

          {step === "services" && (
            <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center gap-3 border-t bg-card px-4 py-3 md:-mx-6 md:-mb-6 md:px-6">
              <span className="flex-1 text-sm">
                {picked.length > 0 && (
                  <>
                    {tb("selected", { count: picked.length, duration: fmt.duration(totalMin) })}
                    {business.showPrices && <span className="block font-medium">{totalPrice}</span>}
                  </>
                )}
              </span>
              <Button
                className="h-11 md:h-9"
                disabled={picked.length === 0}
                onClick={() => {
                  if (!byStaff) return go("staff");
                  setStaffId(byStaff);
                  setSlot(null);
                  go("time");
                }}
              >
                {tb("continue")}
              </Button>
            </div>
          )}
        </Card>
      </Column>
    </>
  );
}

// the page column under the full-width website cover
function Column({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4">{children}</div>;
}

function ConsentBox({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <Label htmlFor={id} className="leading-snug font-normal">
        {label}
      </Label>
    </div>
  );
}

function ServicesStep({
  business,
  picked,
  toggle,
  byStaff,
  setByStaff,
}: {
  business: PublicBusinessView;
  picked: string[];
  toggle: (key: string) => void;
  byStaff: string | null;
  setByStaff: (id: string | null) => void;
}) {
  const tb = useTranslations("publicBooking");
  const fmt = useFormat();
  const [mode, setMode] = useState<"service" | "staff">(byStaff ? "staff" : "service");
  const person = business.staff.find((p) => p.id === byStaff) ?? null;
  const groups = useMemo(() => {
    const byCat = new Map<string | null, PublicService[]>();
    const offered = business.services.filter((s) => !byStaff || s.staffIds.includes(byStaff));
    for (const s of offered) byCat.set(s.categoryId, [...(byCat.get(s.categoryId) ?? []), s]);
    const ordered = business.categories
      .filter((c) => byCat.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, items: byCat.get(c.id)! }));
    const loose = [...byCat.entries()]
      .filter(([k]) => k === null || !business.categories.some((c) => c.id === k))
      .flatMap(([, v]) => v);
    return loose.length ? [...ordered, { id: "other", name: "", items: loose }] : ordered;
  }, [business, byStaff]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  // folded categories: the first one open (all of them when there are only a few services)
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(total <= 8 ? groups.map((g) => g.id) : groups.slice(0, 1).map((g) => g.id)),
  );
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const shown = searching
    ? groups
        .map((g) => ({
          ...g,
          items: g.name.toLowerCase().includes(q)
            ? g.items
            : g.items.filter((s) => (s.name + " " + s.description).toLowerCase().includes(q)),
        }))
        .filter((g) => g.items.length > 0)
    : groups;

  // two ways to start: a choice, not tabs with panels
  const tabs = business.staff.length > 1 && (
    <div role="radiogroup" aria-label={tb("steps.services")} className="flex rounded-lg bg-muted p-1">
      {(["service", "staff"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => {
            setMode(m);
            if (m === "service") setByStaff(null);
          }}
          className={cn(
            "min-h-10 flex-1 rounded-md px-3 text-sm font-medium text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            mode === m && "bg-card text-foreground shadow-sm",
          )}
        >
          {tb(m === "service" ? "byService" : "bySpecialist")}
        </button>
      ))}
    </div>
  );

  if (mode === "staff" && !person)
    return (
      <div className="flex flex-col gap-4">
        {tabs}
        <p className="text-sm text-muted-foreground">{tb("chooseSpecialist")}</p>
        <ul className="grid gap-2 lg:grid-cols-2">
          {business.staff.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setByStaff(p.id)}
                className="flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatar from storage
                  <img src={p.photoUrl} alt="" className="size-10 rounded-full object-cover" />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <UserRound className="size-5" aria-hidden />
                  </span>
                )}
                <span className="flex flex-col">
                  <span className="font-medium">{p.name}</span>
                  {p.position && <span className="text-xs text-muted-foreground">{p.position}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {tabs}
      {person && (
        <div className="flex items-center gap-3 rounded-lg bg-accent px-3 py-2 text-accent-foreground">
          <UserRound className="size-4" aria-hidden />
          <span className="flex-1 text-sm font-medium">{tb("withSpecialist", { name: person.name })}</span>
          <Button variant="ghost" className="h-9" onClick={() => setByStaff(null)}>
            {tb("change")}
          </Button>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{tb("chooseServices")}</p>
      {total > 6 && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tb("searchServices")}
            aria-label={tb("searchServices")}
            className="h-11 pl-9"
          />
        </div>
      )}
      {shown.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{tb("noMatch")}</p>
      )}
      {shown.map((g) => {
        const list = (
          <div id={"cat-" + g.id} className="grid gap-2 lg:grid-cols-2">
            {g.items.map((s) => {
              const on = picked.includes(s.key);
              return (
                <label
                  key={s.key}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 hover:bg-muted/60 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    on && "border-primary bg-accent",
                  )}
                >
                  <Checkbox checked={on} onCheckedChange={() => toggle(s.key)} className="mt-1" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{s.name}</span>
                    {s.description && <span className="text-xs text-muted-foreground">{s.description}</span>}
                    <span className="text-xs text-muted-foreground">{fmt.duration(s.durationMin)}</span>
                  </span>
                  {business.showPrices && (
                    <span className="shrink-0 text-sm font-medium tabular-nums">{fmt.price(s)}</span>
                  )}
                </label>
              );
            })}
          </div>
        );
        // one group only: nothing to fold
        if (groups.length === 1) return <div key={g.id}>{list}</div>;
        const open = searching || openIds.has(g.id);
        const chosen = g.items.filter((s) => picked.includes(s.key)).length;
        return (
          <section key={g.id} className={cn("rounded-xl border bg-card", open && "border-primary/40")}>
            <h3>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={"cat-" + g.id}
                disabled={searching}
                onClick={() =>
                  setOpenIds((ids) => {
                    const next = new Set(ids);
                    if (next.has(g.id)) next.delete(g.id);
                    else next.add(g.id);
                    return next;
                  })
                }
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent"
              >
                <CategoryIcon name={g.name} />
                <span className="flex-1 font-medium">{g.name || tb("otherServices")}</span>
                {chosen > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    {tb("chosenCount", { count: chosen })}
                  </span>
                )}
                <span className="text-sm text-muted-foreground tabular-nums">{g.items.length}</span>
                <ChevronDown
                  className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
                  aria-hidden
                />
              </button>
            </h3>
            {open && <div className="px-3 pb-3">{list}</div>}
          </section>
        );
      })}
    </div>
  );
}

function TimeStep({
  business,
  today,
  date,
  setDate,
  slots,
  slot,
  choose,
}: {
  business: PublicBusinessView;
  today: string;
  date: string;
  setDate: (d: string) => void;
  slots: Slot[] | null;
  slot: Slot | null;
  choose: (s: Slot) => void;
}) {
  const t = useTranslations();
  const tb = useTranslations("publicBooking");
  const last = addDays(today, business.maxDaysAhead);
  const days = Array.from({ length: Math.min(14, business.maxDaysAhead + 1) }, (_, i) => addDays(today, i));
  const open = (d: string) => (business.hours[dateParts(d).weekday]?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{tb("chooseDay")}</span>
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          role="radiogroup"
          aria-label={tb("chooseDay")}
        >
          {days.map((d) => {
            const p = dateParts(d);
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={d === date}
                aria-label={fullDate(t, d)}
                disabled={!open(d)}
                onClick={() => setDate(d)}
                className={cn(
                  "flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-lg border text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40",
                  d === date ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted/60",
                )}
              >
                <span className="text-xs">{t(`weekdays.short.${p.weekday}` as "weekdays.short.1")}</span>
                <span className="text-base font-semibold tabular-nums">{p.day}</span>
              </button>
            );
          })}
        </div>
        <FormField id="pb-date" label={tb("otherDate")} className="max-w-48">
          <Input
            id="pb-date"
            type="date"
            min={today}
            max={last}
            className="h-11 md:h-9"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </FormField>
      </div>

      <p className="font-medium">{fullDate(t, date)}</p>
      {slots === null ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          …
        </p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {tb("noSlots")}
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label={tb("steps.time")}
          className="grid grid-cols-4 gap-2 sm:grid-cols-6"
        >
          {slots.map((s) => (
            <button
              key={`${s.start}-${s.staffId}`}
              type="button"
              role="radio"
              aria-checked={slot?.start === s.start}
              onClick={() => choose(s)}
              className={cn(
                "h-11 rounded-lg border text-sm font-medium tabular-nums hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                slot?.start === s.start && "border-primary bg-accent",
              )}
            >
              {timeIn(s.start, business.timeZone)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
