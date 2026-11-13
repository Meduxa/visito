import "server-only";
import { serverEnv } from "@/lib/server-env";
import { fakeSmsProvider } from "./providers/fake";
import { senderGeProvider } from "./providers/senderge";
import { tnetProvider } from "./providers/tnet";
import type { SmsProvider } from "./types";

// One provider per server instance: TNET keeps its login token in memory and
// reuses it (login is limited to 5 a minute).
let tnet: SmsProvider | undefined;

export function getSmsProvider(): SmsProvider {
  const env = serverEnv();
  switch (env.SMS_PROVIDER) {
    case "tnet": {
      const { TNET_BASE_URL, TNET_CLIENT_ID, TNET_SECRET_HASH, TNET_SENDER } = env;
      if (!TNET_BASE_URL || !TNET_CLIENT_ID || !TNET_SECRET_HASH || !TNET_SENDER)
        throw new Error(
          "TNET_BASE_URL, TNET_CLIENT_ID, TNET_SECRET_HASH and TNET_SENDER are required for TNET",
        );
      tnet ??= tnetProvider({
        baseUrl: TNET_BASE_URL,
        clientId: TNET_CLIENT_ID,
        secretHash: TNET_SECRET_HASH,
        sender: TNET_SENDER,
      });
      return tnet;
    }
    case "senderge":
      if (!env.SMS_API_KEY) throw new Error("SMS_API_KEY is required for sender.ge");
      return senderGeProvider(env.SMS_API_KEY);
    case "fake":
      // a fake provider in production would silently swallow SMS codes
      if (process.env.NODE_ENV === "production" && process.env.ALLOW_FAKE_SMS !== "1") {
        throw new Error("SMS_PROVIDER=fake is not allowed in production");
      }
      return fakeSmsProvider;
    default:
      throw new Error("SMS_PROVIDER is not configured");
  }
}

export type { SmsDeliveryStatus, SmsProvider, SmsSendInput } from "./types";
