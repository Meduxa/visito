// Cloudflare Turnstile: checks on the server that the token a browser got from
// the widget is real, unused and recent (decision 036).
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

export type CaptchaResult = { ok: true } | { ok: false; reason: "missing" | "invalid" | "unavailable" };

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(opts: {
  secret: string;
  token: string | null | undefined;
  ip?: string | null;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): Promise<CaptchaResult> {
  const token = opts.token?.trim();
  if (!token || token.length > 2048) return { ok: false, reason: "missing" };
  const body = new URLSearchParams({ secret: opts.secret, response: token });
  if (opts.ip) body.set("remoteip", opts.ip);
  try {
    const res = await (opts.fetch ?? fetch)(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
    });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const data = (await res.json()) as { success?: boolean };
    return data.success === true ? { ok: true } : { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
