import { randomUUID } from "node:crypto";
import {
  attachCheckoutIntent,
  getCheckoutIntent,
  getDb,
  markCheckoutIntentAbandoned,
  sha256,
  type AppDb,
  type CheckoutIntentRow,
} from "../db";
import type {
  CheckoutRecord,
  CheckoutStart,
  CreateCheckoutInput,
  PaidEvent,
  PaymentPort,
  WebhookResult,
} from "./port";
import { checkoutNow, prepareCheckoutIntent } from "./port";

/** Explicit test-only provider. It uses the same durable intent/ledger path. */
export class FixturePayment implements PaymentPort {
  readonly kind = "fixture" as const;
  readonly mode = "fixture" as const;
  private readonly database?: AppDb;

  constructor(database?: AppDb) {
    this.database = database;
  }

  private db(): AppDb {
    return this.database ?? getDb();
  }

  reset(): void {
    // State is durable by design; test isolation is provided by DATABASE_PATH.
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutStart> {
    const intent = prepareCheckoutIntent(input, "fixture", "fixture", this.db());
    const sessionId = `fix_${randomUUID()}`;
    const checkoutUrl = fixtureCheckoutUrl(input.listingDraft.city, sessionId);
    attachCheckoutIntent(this.db(), intent.id, {
      providerCheckoutId: sessionId,
      checkoutUrl,
      expiresAt: new Date(checkoutNow().getTime() + 45 * 60_000).toISOString(),
    });
    return { checkoutUrl, sessionId, intentId: intent.id };
  }

  getCheckout(sessionId: string): CheckoutRecord | undefined {
    const intent = this.findIntent(sessionId);
    if (!intent) return undefined;
    const draft = parseDraft(intent.listing_draft_json);
    return {
      sessionId: intent.provider_checkout_id ?? intent.id,
      status: intent.status === "creating" ? "open" : intent.status,
      checkoutUrl: intent.checkout_url ?? fixtureCheckoutUrl(intent.city, intent.provider_checkout_id ?? intent.id),
      listingDraft: draft,
      amountUsd: intent.charge_cents / 100,
      kind: intent.kind,
      paidAt: intent.paid_at ?? undefined,
      intentId: intent.id,
      reason: intent.reason,
    };
  }

  async completeCheckout(sessionId: string): Promise<PaidEvent> {
    const intent = this.findIntent(sessionId);
    if (!intent || intent.status === "abandoned") throw new Error("payment_incomplete");
    const draft = parseDraft(intent.listing_draft_json);
    const providerCheckoutId = intent.provider_checkout_id ?? sessionId;
    const providerEventId = `fixture_delivery_${providerCheckoutId}`;
    const providerOrderId = `fixture_order_${providerCheckoutId}`;
    const providerPaymentId = `fixture_payment_${providerCheckoutId}`;
    const businessEventId = `fixture_business_${providerCheckoutId}`;
    const paidAt = intent.paid_at ?? checkoutNow().toISOString();
    const payload = JSON.stringify({
      id: providerEventId,
      eventType: "order.completed",
      eventId: businessEventId,
      data: { checkoutId: providerCheckoutId, orderId: providerOrderId, paymentId: providerPaymentId },
    });
    return {
      sessionId: providerCheckoutId,
      intentId: intent.id,
      listingDraft: draft,
      amountUsd: intent.charge_cents / 100,
      amountCents: intent.charge_cents,
      kind: intent.kind,
      paidAt,
      providerCheckoutId,
      providerOrderId,
      providerPaymentId,
      providerEventId,
      businessEventId,
      eventType: "order.completed",
      currency: intent.currency,
      productId: intent.product_id,
      metadata: parseMetadata(intent.metadata_json),
      intentFingerprint: intent.fingerprint,
      targetBidUsd: intent.target_bid_cents / 100,
      quoteBaseBidUsd: intent.quote_base_bid_cents === null ? null : intent.quote_base_bid_cents / 100,
      payloadJson: payload,
      payloadFingerprint: sha256(payload),
    };
  }

  async abandonCheckout(sessionId: string): Promise<void> {
    const intent = this.findIntent(sessionId);
    if (intent) markCheckoutIntentAbandoned(this.db(), intent.id);
  }

  async handleWebhook(rawBody: string, _headers: Record<string, string>): Promise<WebhookResult> {
    const parsed = parseJson(rawBody);
    if (!isRecord(parsed)) return { ignored: true };
    const data = isRecord(parsed.data) ? parsed.data : parsed;
    const sessionId = readString(data.checkoutId) ?? readString(data.sessionId) ?? readString(data.id);
    if (!sessionId || !this.findIntent(sessionId)) return { ignored: true };
    const status = readString(data.status) ?? readString(data.orderStatus) ?? "";
    if (["expired", "failed", "canceled", "cancelled", "abandoned"].includes(status)) {
      await this.abandonCheckout(sessionId);
      return { ignored: true };
    }
    if (!(status === "paid" || status === "succeeded" || status === "complete" || parsed.type === "order.completed" || parsed.eventType === "order.completed")) {
      return { ignored: true };
    }
    return this.completeCheckout(sessionId);
  }

  private findIntent(sessionId: string): CheckoutIntentRow | undefined {
    const db = this.db();
    return getCheckoutIntent(db, sessionId) ?? (() => {
      const rows = db.sqlite.prepare("SELECT * FROM checkout_intents WHERE provider_checkout_id = ?").get(sessionId) as Record<string, unknown> | undefined;
      if (!rows) return undefined;
      return getCheckoutIntent(db, String(rows.id));
    })();
  }
}

let sharedFixture: FixturePayment | undefined;

export function getFixturePayment(): FixturePayment {
  if (!sharedFixture) sharedFixture = new FixturePayment();
  return sharedFixture;
}

export function fixtureCheckoutUrl(city: string, sessionId: string): string {
  return `/${city}/return?sessionId=${encodeURIComponent(sessionId)}`;
}

function parseDraft(raw: string) {
  return JSON.parse(raw) as CreateCheckoutInput["listingDraft"];
}

function parseMetadata(raw: string): Record<string, string> {
  const value = JSON.parse(raw) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, String(val)]));
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
