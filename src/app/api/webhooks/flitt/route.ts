import { applyPaymentEvent } from "@/features/billing/apply";
import { getBillingProvider } from "@/integrations/payments";

// Flitt's server-to-server notice (decision 031): POST JSON, signed with
// Visito's Flitt secret. The signature is checked before anything is used;
// unsigned or wrong → 401 and nothing changes. 200 only after the database
// accepted it (Flitt retries otherwise: 2 s, 1 min, 5 min, 10 min, 1 h, 24 h).
// Card numbers arrive masked and are kept only as Flitt sends them (444455XXXXXX1111).
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let provider: ReturnType<typeof getBillingProvider>;
  try {
    provider = getBillingProvider();
  } catch {
    provider = null;
  }
  if (!provider) return new Response(null, { status: 503 });
  const event = provider.parseCallback(await req.text());
  if (!event) return new Response(null, { status: 401 });
  const result = await applyPaymentEvent(event);
  if (result === null) return new Response(null, { status: 500 });
  return Response.json({ ok: true, result });
}
