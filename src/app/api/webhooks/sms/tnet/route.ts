import { parseTnetCallback, verifyTnetWebhook } from "@/integrations/sms/providers/tnet";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";

// TNET delivery reports (decision 027). Address to register with TNET:
//   https://visito.ge/api/webhooks/sms/tnet
// 1. The signature is checked on the exact raw body BEFORE anything is parsed;
//    unsigned or wrong → 401, nothing changes (there is no unsigned fallback).
// 2. The report updates our message by TNET's message_id (sms_messages.provider_ref).
//    sms_delivery only moves "sent" messages, so a repeated or late report cannot
//    change a message twice or replace a newer state.
// 3. 200 only after the database accepted it; otherwise 500 and TNET retries.
// No phone numbers or texts are logged.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const ok = verifyTnetWebhook(
    raw,
    req.headers.get("x-webhook-timestamp"),
    req.headers.get("x-webhook-signature"),
    serverEnv().TNET_WEBHOOK_SECRET,
  );
  if (!ok) return new Response(null, { status: 401 });

  const report = parseTnetCallback(raw);
  if (!report) return Response.json({ ignored: "unreadable" }, { status: 200 }); // signed but not ours to use
  if (!report.outcome) return Response.json({ ignored: "not final" }, { status: 200 });

  const { error } = await createAdminClient().rpc("sms_delivery", {
    p_provider: "tnet",
    p_ref: report.messageId,
    p_delivered: report.outcome === "delivered",
    p_error: report.outcome === "failed" ? `undelivered:${report.code}` : undefined,
  });
  if (error) {
    console.error("tnet webhook: could not store", error.code);
    return new Response(null, { status: 500 });
  }
  return Response.json({ ok: true });
}
