import { NextResponse } from "next/server";
import {
  applyPaidEvent,
  CheckoutError,
  getPaymentPort,
  type WebhookResult,
} from "../../../../billing/port";

function headerMap(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function applyIfPaid(result: WebhookResult): boolean {
  if ("ignored" in result) return false;
  try {
    applyPaidEvent(result);
    return true;
  } catch (error) {
    // Invalid, stale, or already-rejected signed deliveries are durably
    // recorded by the settlement boundary and still receive 2xx so an exact
    // retry cannot create a provider retry storm.
    if (error instanceof CheckoutError) return false;
    throw error;
  }
}

/** Canonical Waffo Pancake settlement endpoint. */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  try {
    const result = await getPaymentPort().handleWebhook(rawBody, headerMap(request.headers));
    return NextResponse.json({ received: true, applied: applyIfPaid(result) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid webhook";
    const status =
      message.startsWith("BLOCKED-SECRET") || message.includes("signature")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
