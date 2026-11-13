import "server-only";
import { hmac, newToken } from "@/features/public-booking/security";
import { renderSms, sendTime } from "@/features/sms/render";
import { smsText } from "@/features/sms/texts";
import { queueSms } from "@/features/sms/send";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Review requests (decision 030), run by the SMS job: for every finished visit
// whose business asks for reviews, one SMS with a private link — a service
// message about the visit itself (the business switches it on; it costs SMS).
// Quiet hours apply. A link is made at most once per visit.
export async function enqueueReviewRequests() {
  const db = createAdminClient();
  const { data, error } = await db.rpc("reviews_due");
  if (error) throw new Error(`reviews: ${error.code}`);
  let queued = 0;
  const now = new Date();
  for (const r of data ?? []) {
    const when = sendTime(
      now,
      r.timezone,
      { start: r.quiet_start, end: r.quiet_end },
      new Date(now.getTime() + 86_400_000),
    );
    if (!when) continue;
    const token = newToken();
    const { data: made } = await db.rpc("add_review_request", {
      p_booking: r.booking_id,
      p_token_hash: hmac(token),
    });
    if (!made) continue; // another run made it first
    const id = await queueSms({
      tenantId: r.tenant_id,
      to: r.phone,
      text: renderSms(await smsText(r.tenant_id, "review", r.locale), {
        client_name: r.first_name,
        business_name: r.business,
        manage_link: `${publicEnv.NEXT_PUBLIC_APP_URL}/r/${token}`, // the review page link
      }),
      kind: "service",
      type: "review",
      key: `review:${r.booking_id}`,
      clientId: r.client_id,
      bookingId: r.booking_id,
      sendAfter: when,
    });
    if (id) queued++;
  }
  return { reviewRequests: queued };
}
