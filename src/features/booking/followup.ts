// "Requires additional service" (decision 037): which service of a visit still
// misses its additional service. Shared by the calendar and the booking panel.
import type { CalBooking } from "./queries";

type Entry = { id: string; followUp?: { serviceId: string; afterMin: number } | null };

export type MissingFollowUp<E extends Entry> = {
  /** the main service's catalog entry */
  main: E;
  /** the additional service's catalog entry */
  service: E;
  /** where the main service ends (ISO) */
  mainEnd: string;
  mainStaffId: string;
};

const OPEN = ["pending", "confirmed", "arrived", "in_progress"];

export function missingFollowUp<E extends Entry>(
  booking: CalBooking,
  catalog: E[],
): MissingFollowUp<E> | null {
  if (!OPEN.includes(booking.status)) return null;
  for (const item of booking.items) {
    const main = catalog.find((c) => c.id === item.serviceId);
    const fuId = main?.followUp?.serviceId;
    if (!main || !fuId) continue;
    if (booking.items.some((i) => i.serviceId === fuId)) continue;
    const service = catalog.find((c) => c.id === fuId);
    if (service) return { main, service, mainEnd: item.end, mainStaffId: item.staffId };
  }
  return null;
}
