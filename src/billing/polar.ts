/**
 * Historical Polar module retained only so old imports fail closed. Waffo
 * Pancake is the sole selectable provider; this module performs no network
 * calls and cannot settle a checkout.
 */
export const POLAR_API_BASE = "https://api.polar.sh";

export type PolarPaymentOptions = {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
};

import type {
  CheckoutRecord,
  CheckoutStart,
  CreateCheckoutInput,
  PaidEvent,
  WebhookResult,
} from "./port";

export class PolarPayment {
  readonly kind = "live" as const;

  constructor(_options: PolarPaymentOptions = {}) {
    throw new Error("Polar adapter is inert; configure Waffo Pancake");
  }

  async createCheckout(_input: CreateCheckoutInput): Promise<CheckoutStart> {
    throw new Error("Polar adapter is inert; configure Waffo Pancake");
  }

  getCheckout(_sessionId: string): CheckoutRecord | undefined {
    return undefined;
  }

  async completeCheckout(_sessionId: string): Promise<PaidEvent> {
    throw new Error("Polar adapter is inert; configure Waffo Pancake");
  }

  async abandonCheckout(_sessionId: string): Promise<void> {
    throw new Error("Polar adapter is inert; configure Waffo Pancake");
  }

  async handleWebhook(_rawBody: string, _headers: Record<string, string>): Promise<WebhookResult> {
    throw new Error("Polar adapter is inert; configure Waffo Pancake");
  }
}

export function verifyPolarSignature(
  _rawBody: string,
  _headers: Record<string, string>,
  _secret: string,
): boolean {
  return false;
}
