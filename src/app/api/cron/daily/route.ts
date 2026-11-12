import { cronAllowed } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Once a day: trials that ended become "payment due"; businesses whose 14-day
// deletion period is over are removed; active plans get their monthly SMS (once a month).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAllowed(req)) return new Response(null, { status: 401 });
  const db = createAdminClient();
  const [trials, purged, sms, paid] = await Promise.all([
    db.rpc("expire_trials"),
    db.rpc("purge_due_tenants"),
    db.rpc("grant_monthly_sms"),
    db.rpc("expire_paid_periods"), // card-paid plans 3 days past their paid period (decision 031)
  ]);
  if (trials.error || purged.error || sms.error || paid.error)
    return Response.json({ error: "job failed" }, { status: 500 });
  return Response.json({
    trialsEnded: trials.data,
    businessesDeleted: purged.data,
    smsGranted: sms.data,
    paidPeriodsEnded: paid.data,
  });
}
