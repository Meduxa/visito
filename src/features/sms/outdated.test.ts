import { describe, expect, it } from "vitest";
import { outdatedReason } from "./outdated";

const start = "2026-12-01T06:00:00Z";
const epoch = Math.floor(new Date(start).getTime() / 1000);
const reminder = {
  type: "reminder",
  idempotencyKey: `reminder:1440:b1:${epoch}`,
  createdAt: "2026-11-30T18:00:00Z",
};
const visit = (o: Partial<{ status: string; startsAt: string; laterMessages: string[] }> = {}) => ({
  status: "confirmed",
  startsAt: start,
  laterMessages: [],
  ...o,
});

describe("queued messages about a visit (test plan #53)", () => {
  it("a reminder for an unchanged visit goes out", () => {
    expect(outdatedReason(reminder, visit())).toBeNull();
  });

  it("a reminder for a moved visit does not", () => {
    expect(outdatedReason(reminder, visit({ startsAt: "2026-12-01T08:00:00Z" }))).toBe("visit_moved");
  });

  it("nothing but the cancel message goes out for a cancelled visit or a no-show", () => {
    expect(outdatedReason(reminder, visit({ status: "cancelled_by_business" }))).toBe("visit_cancelled");
    expect(outdatedReason(reminder, visit({ status: "no_show" }))).toBe("visit_cancelled");
    const cancel = { type: "cancelled", idempotencyKey: "cancelled:b1", createdAt: reminder.createdAt };
    expect(outdatedReason(cancel, visit({ status: "cancelled_by_client" }))).toBeNull();
    expect(outdatedReason(cancel, visit())).toBe("visit_active"); // the cancel was undone
  });

  it("a confirmation replaced by a later change does not go out", () => {
    const confirmed = {
      type: "confirmed",
      idempotencyKey: "confirmed:b1",
      createdAt: "2026-11-30T18:00:00Z",
    };
    expect(outdatedReason(confirmed, visit())).toBeNull();
    expect(outdatedReason(confirmed, visit({ laterMessages: ["2026-11-30T19:00:00Z"] }))).toBe("replaced");
    expect(outdatedReason(confirmed, visit({ laterMessages: ["2026-11-30T17:00:00Z"] }))).toBeNull();
  });

  it("a deleted visit sends nothing", () => {
    expect(outdatedReason(reminder, null)).toBe("visit_gone");
  });
});
