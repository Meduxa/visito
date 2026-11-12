import { applyPaymentEvent } from "@/features/billing/apply";
import { getBillingProvider } from "@/integrations/payments";
import { publicEnv } from "@/lib/env";

// Where Flitt sends the payer's browser after the card page (decision 031).
// Flitt POSTs the result as a form; the browser's word is never trusted:
// we ask Flitt for the order's status server-to-server (signed answer), apply it,
// then show the owner the subscription page.
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const url = new URL(req.url);
  const order = url.searchParams.get("order") ?? "";
  const locale = ["ka", "en", "ru"].includes(url.searchParams.get("locale") ?? "")
    ? url.searchParams.get("locale")!
    : "ka";
  if (/^[0-9a-f-]{36}$/.test(order)) {
    try {
      const provider = getBillingProvider();
      const event = provider ? await provider.getStatus(order) : null;
      if (event && event.orderId === order) await applyPaymentEvent(event);
    } catch {
      // the signed notice will still arrive; the page shows "being processed"
    }
  }
  const back = new URL(`/${locale}/settings/subscription`, publicEnv.NEXT_PUBLIC_APP_URL);
  if (/^[0-9a-f-]{36}$/.test(order)) back.searchParams.set("order", order);
  return Response.redirect(back, 303);
}

export const GET = handle;
export const POST = handle;
