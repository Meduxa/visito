// Not a function itself: lives outside netlify/functions so Netlify does not deploy it as one.
// Shared by the scheduled functions: call one of the app's protected job routes.
// The site address comes from Netlify's function context (process.env.URL is a
// build-time value and may be missing when the function runs). Failures are
// logged so they show up under Logs → Functions.
type NetlifyContext = { site?: { url?: string } };

export async function runJob(name: "sms" | "daily", context?: NetlifyContext) {
  const base = context?.site?.url || process.env.URL;
  if (!base || !process.env.CRON_SECRET) {
    console.error(`${name} job: site address or CRON_SECRET missing`);
    return new Response(`${name} job: not configured`, { status: 500 });
  }
  // a secret pasted from a document can carry curly quotes or other non-ASCII
  // characters, which can never be sent in a header (test plan #52)
  if (!/^[\x21-\x7e]+$/.test(process.env.CRON_SECRET)) {
    console.error(
      `${name} job: CRON_SECRET contains characters that cannot be sent (quotes, spaces or non-Latin) — re-enter it on Netlify with letters and digits only, then redeploy`,
    );
    return new Response(`${name} job: CRON_SECRET invalid`, { status: 500 });
  }
  try {
    const res = await fetch(`${base}/api/cron/${name}`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    if (!res.ok) console.error(`${name} job: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return new Response(`${name} job: ${res.status}`, { status: res.ok ? 200 : 500 });
  } catch (e) {
    console.error(`${name} job: ${e instanceof Error ? e.message : String(e)}`);
    return new Response(`${name} job: failed`, { status: 500 });
  }
}
