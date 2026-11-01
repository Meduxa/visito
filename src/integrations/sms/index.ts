import "server-only";
import { serverEnv } from "@/lib/server-env";
import { fakeSmsProvider } from "./providers/fake";
import { senderGeProvider } from "./providers/senderge";
import type { SmsProvider } from "./types";

export function getSmsProvider(): SmsProvider {
  const env = serverEnv();
  switch (env.SMS_PROVIDER) {
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
