export type SmsSendInput = {
  to: string; // E.164
  text: string;
  // service = codes, confirmations, reminders; marketing = promotions (consent checked before queueing)
  kind: "service" | "marketing";
  senderName?: string;
  idempotencyKey: string;
};

export type SmsSendResult = {
  ok: boolean;
  providerRef?: string;
  segments?: number;
  delivered?: boolean; // the provider already knows it arrived (fake provider)
  error?: { code: string; message: string; retryable: boolean };
};

export type SmsDeliveryStatus = "pending" | "delivered" | "failed" | "unknown";

export interface SmsProvider {
  name: string;
  send(input: SmsSendInput): Promise<SmsSendResult>;
  /** Asked by the background job for messages sent but not yet confirmed. */
  getStatus?(providerRef: string): Promise<SmsDeliveryStatus>;
  /** Bookeria's own balance with the SMS company, in tetri (shown to the platform admin). */
  getBalance?(): Promise<{ balanceMinor: number } | null>;
}
