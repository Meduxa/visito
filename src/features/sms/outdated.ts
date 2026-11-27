// A message about a visit can wait in the queue for hours (quiet hours: until
// 09:00). Before it is sent, it is checked against the visit as it is now
// (test plan #53): a reminder for a visit that was moved or cancelled, or a
// confirmation that a later change replaced, is not sent.

export type QueuedAboutVisit = {
  type: string;
  idempotencyKey: string;
  createdAt: string;
};

export type VisitNow = {
  status: string;
  startsAt: string;
  /** when later messages about this visit (confirmed / rescheduled / cancelled) were created */
  laterMessages: string[];
};

const ENDED = ["cancelled_by_client", "cancelled_by_business", "no_show"];

/** Why the queued message must not go out, or null when it is still right. */
export function outdatedReason(m: QueuedAboutVisit, visit: VisitNow | null): string | null {
  if (!visit) return "visit_gone";
  const ended = ENDED.includes(visit.status);
  if (m.type === "cancelled") return ended ? null : "visit_active"; // the cancel was undone
  if (ended) return "visit_cancelled";
  if (m.type === "reminder") {
    // reminder:{offset}:{booking}:{starts_at epoch seconds}
    const epoch = Number(m.idempotencyKey.split(":")[3]);
    if (epoch && epoch !== Math.floor(new Date(visit.startsAt).getTime() / 1000)) return "visit_moved";
    return null;
  }
  // confirmations and "moved" messages: a newer one about the same visit says it better
  if (visit.laterMessages.some((t) => t > m.createdAt)) return "replaced";
  return null;
}

/** Message types that describe a visit and must still be true when sent. */
export const ABOUT_VISIT = ["confirmed", "pending", "rescheduled", "cancelled", "reminder"];
