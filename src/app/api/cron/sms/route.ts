import { enqueueDueReminders } from "@/features/sms/booking-sms";
import { enqueueReviewRequests } from "@/features/reviews/send";
import { checkDeliveries, processQueue } from "@/features/sms/send";
import { cronAllowed } from "@/lib/cron-auth";

// Every few minutes: queue due reminders, send what is due, then ask the SMS
// company which recent messages arrived. Called by the
// host's scheduler in production and by `npm.cmd run jobs` on a developer's computer.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAllowed(req)) return new Response(null, { status: 401 });
  const reminders = await enqueueDueReminders();
  const reviews = await enqueueReviewRequests(); // decision 030
  const sent = await processQueue();
  const deliveries = await checkDeliveries();
  return Response.json({ ...reminders, ...reviews, ...sent, deliveries });
}
