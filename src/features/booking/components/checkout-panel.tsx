"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { DetailPanel } from "@/components/detail-panel";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";
import { read } from "@/lib/read";
import type { ReadResult } from "../reads";
import { checkout } from "../checkout-actions";
import { PAYMENT_METHODS, type PaymentMethod } from "../payment-methods";
import type { CalBooking, CalStaff } from "../queries";
import { noClientKey } from "../client-label";

const text = (minor: number) =>
  minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2).replace(".", ",");
const minor = (s: string) => parseMoneyToMinor(s) ?? 0;

// Checkout at the end of a visit: booking lines + extra items − discount,
// paid by one or more methods, optional tip for the person.
export function CheckoutPanel({
  booking,
  staff,
  onClose,
}: {
  booking: CalBooking;
  staff: CalStaff[];
  onClose: () => void;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [existing, setExisting] = useState<ReadResult<"bookingMoney">>(null);
  const [charges, setCharges] = useState<{ name: string; price: string }[]>([]);
  const [discount, setDiscount] = useState<{ kind: "amount" | "percent"; value: string }>({
    kind: "amount",
    value: "",
  });
  const [payments, setPayments] = useState<{ method: PaymentMethod; amount: string }[]>([]);
  const [tip, setTip] = useState("");
  const [tipStaffId, setTipStaffId] = useState<string | null>(booking.items[0]?.staffId ?? null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    read("bookingMoney", booking.id, null).then((m) => {
      setExisting(m);
      // a discount given at an earlier (partial) payment stays: each checkout saves the
      // whole discount, so starting from 0 would take it away (test plan #42)
      if (m?.discountMinor) setDiscount({ kind: "amount", value: text(m.discountMinor) });
    });
  }, [booking.id]);

  const itemsMinor =
    booking.items.reduce((s, i) => s + i.priceMinor, 0) +
    (existing?.charges.reduce((s, c) => s + c.price_minor, 0) ?? 0);
  const newCharges = charges.reduce((s, c) => s + minor(c.price), 0);
  const gross = itemsMinor + newCharges;
  const discountMinor =
    discount.kind === "percent"
      ? Math.round((gross * Math.min(100, Number(discount.value.replace(",", ".")) || 0)) / 100)
      : minor(discount.value);
  const paidBefore =
    existing?.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_minor, 0) ?? 0;
  const due = Math.max(0, gross - discountMinor - paidBefore);
  const shown = payments.length ? payments : [{ method: "cash" as PaymentMethod, amount: text(due) }];
  const paying = shown.reduce((s, p) => s + minor(p.amount), 0);
  const tipMinor = tip ? minor(tip) : 0;

  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      const r = await checkout({
        bookingId: booking.id,
        charges,
        discount,
        payments: shown,
        tip,
        tipStaffId: tip ? tipStaffId : null,
        itemsMinor,
      });
      if (!r.ok) return setError(r.error);
      toast.success(t("checkout.paid"));
      onClose();
    });

  return (
    <DetailPanel
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("checkout.title")}
      description={booking.client?.name ?? t(noClientKey(booking))}
    >
      <div className="flex flex-col gap-5">
        <ul className="flex flex-col divide-y rounded-lg border text-sm">
          {booking.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 px-3 py-2">
              <span>{i.name}</span>
              <span className="tabular-nums">{formatMoney(i.priceMinor)}</span>
            </li>
          ))}
          {existing?.charges.map((c) => (
            <li key={c.id} className="flex justify-between gap-3 px-3 py-2">
              <span>{c.name}</span>
              <span className="tabular-nums">{formatMoney(c.price_minor)}</span>
            </li>
          ))}
        </ul>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("checkout.extra")}</h3>
          {charges.map((c, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={c.name}
                onChange={(e) =>
                  setCharges(charges.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder={t("checkout.extraName")}
                aria-label={t("checkout.extraName")}
                className="h-11 md:h-9"
              />
              <Input
                value={c.price}
                inputMode="decimal"
                onChange={(e) =>
                  setCharges(charges.map((x, k) => (k === i ? { ...x, price: e.target.value } : x)))
                }
                placeholder="₾"
                aria-label={t("services.fields.price")}
                className="h-11 w-24 md:h-9"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.delete")}
                onClick={() => setCharges(charges.filter((_, k) => k !== i))}
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-9 self-start"
            onClick={() => setCharges([...charges, { name: "", price: "" }])}
          >
            <Plus aria-hidden />
            {t("checkout.addExtra")}
          </Button>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <FormField id="co-discount" label={t("checkout.discount")}>
            <div className="flex gap-2">
              <Input
                id="co-discount"
                inputMode="decimal"
                value={discount.value}
                onChange={(e) => setDiscount({ ...discount, value: e.target.value })}
                className="h-11 md:h-9"
              />
              <Select
                value={discount.kind}
                onValueChange={(v) => setDiscount({ ...discount, kind: v as "amount" })}
              >
                <SelectTrigger aria-label={t("checkout.discount")} className="h-11 w-20 md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">₾</SelectItem>
                  <SelectItem value="percent">%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormField>
          <FormField id="co-tip" label={`${t("checkout.tip")} (${t("common.optional")})`}>
            <div className="flex gap-2">
              <Input
                id="co-tip"
                inputMode="decimal"
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                placeholder="₾"
                className="h-11 w-24 md:h-9"
              />
              {staff.length > 1 && (
                <Select value={tipStaffId ?? undefined} onValueChange={setTipStaffId}>
                  <SelectTrigger aria-label={t("checkout.tipFor")} className="h-11 flex-1 md:h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </FormField>
        </section>

        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg bg-muted p-3 text-sm">
          <dt>{t("checkout.subtotal")}</dt>
          <dd className="text-right tabular-nums">{formatMoney(gross)}</dd>
          {discountMinor > 0 && (
            <>
              <dt>{t("checkout.discount")}</dt>
              <dd className="text-right tabular-nums">−{formatMoney(discountMinor)}</dd>
            </>
          )}
          {paidBefore > 0 && (
            <>
              <dt>{t("checkout.paidBefore")}</dt>
              <dd className="text-right tabular-nums">−{formatMoney(paidBefore)}</dd>
            </>
          )}
          <dt className="font-semibold">{t("checkout.due")}</dt>
          <dd className="text-right font-semibold tabular-nums">{formatMoney(due)}</dd>
          {/* the tip comes on top: the amount to take from the client includes it (test plan #34) */}
          {tipMinor > 0 && (
            <>
              <dt>{t("checkout.tipLine", { name: staff.find((s) => s.id === tipStaffId)?.name ?? "" })}</dt>
              <dd className="text-right tabular-nums">+{formatMoney(tipMinor)}</dd>
              <dt className="font-semibold">{t("checkout.toTake")}</dt>
              <dd className="text-right font-semibold tabular-nums">{formatMoney(due + tipMinor)}</dd>
            </>
          )}
        </dl>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("checkout.payment")}</h3>
          {shown.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Select
                value={p.method}
                onValueChange={(v) =>
                  setPayments(shown.map((x, k) => (k === i ? { ...x, method: v as PaymentMethod } : x)))
                }
              >
                <SelectTrigger aria-label={t("checkout.method")} className="h-11 flex-1 md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`checkout.methods.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={p.amount}
                inputMode="decimal"
                onChange={(e) =>
                  setPayments(shown.map((x, k) => (k === i ? { ...x, amount: e.target.value } : x)))
                }
                aria-label={t("checkout.amount")}
                className="h-11 w-28 md:h-9"
              />
              {shown.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.delete")}
                  onClick={() => setPayments(shown.filter((_, k) => k !== i))}
                >
                  <X aria-hidden />
                </Button>
              )}
            </div>
          ))}
          {shown.length < 4 && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 self-start"
              onClick={() =>
                setPayments([...shown, { method: "card", amount: text(Math.max(0, due - paying)) }])
              }
            >
              <Plus aria-hidden />
              {t("checkout.split")}
            </Button>
          )}
          {paying !== due && (
            <p className="text-xs text-warning-ink">
              {t("checkout.mismatch", { paying: formatMoney(paying), due: formatMoney(due) })}
            </p>
          )}
        </section>

        <FieldError code={error} />
        <Button
          className="h-11 md:h-9"
          disabled={pending || existing === null || paying + tipMinor <= 0}
          onClick={submit}
        >
          {t("checkout.pay", { amount: formatMoney(paying + tipMinor) })}
        </Button>
      </div>
    </DetailPanel>
  );
}
