import {
  WaffoPancake,
  WaffoPancakeError,
  TaxCategory,
  verifyWebhook,
  type WaffoPancakeConfig,
} from "@waffo/pancake-ts";
import {
  attachCheckoutIntent,
  checkoutIntentByProviderCheckout,
  getCheckoutIntent,
  getDb,
  markCheckoutIntentAbandoned,
  markCheckoutIntentRejected,
  markCheckoutIntentUnknown,
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
import { paymentMode as canonicalPaymentMode } from "../config";
import {
  isPrivateOrLocalHostname,
  isReservedHostname,
  hasExplicitPort,
  requireWaffoConfig,
  waffoApiBase,
  waffoWebhookPublicKey,
  type WaffoEnv,
  type WaffoMode,
} from "./waffo-session";

export type WaffoPaymentOptions = {
  env?: WaffoEnv;
  mode?: WaffoMode;
  fetch?: typeof fetch;
  db?: AppDb;
  client?: WaffoPancake;
  webhookPublicKey?: string;
  /** Maximum time spent waiting for the provider checkout response. */
  checkoutTimeoutMs?: number;
};

/** Official Pancake SDK adapter. All provider writes happen after intent persistence. */
export class WaffoPayment implements PaymentPort {
  readonly kind = "live" as const;
  readonly mode: WaffoMode;
  private readonly env: WaffoEnv;
  private readonly dbHandle: AppDb;
  private readonly config: ReturnType<typeof requireWaffoConfig>;
  private readonly client: WaffoPancake;
  private readonly webhookKey?: string;
  private readonly checkoutTimeoutMs: number;

  constructor(options: WaffoPaymentOptions = {}) {
    this.env = options.env ?? process.env;
    const configuredMode = this.env.PAYMENT_MODE !== undefined || this.env.WAFFO_MODE !== undefined
      ? resolveMode(this.env)
      : undefined;
    if (options.mode && configuredMode && options.mode !== configuredMode) {
      throw new Error("BLOCKED-CONFIG: PAYMENT_MODE and Waffo mode disagree");
    }
    this.mode = options.mode ?? configuredMode ?? resolveMode(this.env);
    this.config = requireWaffoConfig(
      this.env,
      this.mode,
      options.webhookPublicKey,
    );
    if (this.mode === "waffo-test" && !this.config.webhookPublicKey && !options.webhookPublicKey) {
      throw new Error("BLOCKED-CONFIG: WAFFO_WEBHOOK_PUBLIC_KEY");
    }
    this.dbHandle = options.db ?? getDb();
    this.webhookKey = options.webhookPublicKey ?? this.config.webhookPublicKey;
    this.checkoutTimeoutMs = boundedCheckoutTimeout(options.checkoutTimeoutMs ?? readCheckoutTimeout(this.env));
    if (options.client) {
      this.client = options.client;
    } else {
      const providerFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
      const clientConfig: WaffoPancakeConfig = {
        merchantId: this.config.merchantId,
        privateKey: this.config.privateKey,
        baseUrl: waffoApiBase(this.env),
        fetch: withAbortTimeout(providerFetch, this.checkoutTimeoutMs),
        environment: this.mode === "waffo-prod" ? "prod" : "test",
        webhookPublicKey: this.webhookKey,
      };
      this.client = new WaffoPancake(clientConfig);
    }
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutStart> {
    const intent = prepareCheckoutIntent(input, this.mode, this.config.productId, this.dbHandle, this.config.storeId);
    const metadata = parseMetadata(intent.metadata_json);
    const successUrl = `${this.config.publicBaseUrl}/checkout/complete?intent=${encodeURIComponent(intent.id)}`;
    const checkoutAt = checkoutNow();
    let created: { sessionId: string; checkoutUrl: string; expiresAt: string };
    try {
      const response = await withTimeout(
        this.client.checkout.anonymous.create({
          productId: this.config.productId,
          currency: "USD",
          priceSnapshot: {
            amount: centsToDisplay(intent.charge_cents),
            taxCategory: TaxCategory.DigitalGoods,
          },
          successUrl,
          orderMerchantExternalId: intent.id,
          metadata,
        }),
        this.checkoutTimeoutMs,
      );
      const parsed = parseCheckoutResponse(response, checkoutAt, this.config.publicBaseUrl);
      if (!parsed) throw new Error("invalid provider checkout response");
      created = parsed;
    } catch (error) {
      if (isDefinitiveApiRejection(error)) {
        markCheckoutIntentRejected(this.dbHandle, intent.id, `provider_checkout_rejected:${errorMessage(error)}`);
        throw new Error("waffo_checkout_rejected");
      }
      markCheckoutIntentUnknown(this.dbHandle, intent.id, `provider_checkout_unknown:${errorMessage(error)}`);
      throw new Error("waffo_checkout_unknown");
    }
    try {
      const attached = attachCheckoutIntent(this.dbHandle, intent.id, {
        providerCheckoutId: created.sessionId,
        checkoutUrl: created.checkoutUrl,
        expiresAt: created.expiresAt,
      });
      return {
        checkoutUrl: attached.checkout_url ?? created.checkoutUrl,
        sessionId: attached.provider_checkout_id ?? created.sessionId,
        intentId: attached.id,
        expiresAt: attached.expires_at ?? created.expiresAt,
      };
    } catch (error) {
      markCheckoutIntentUnknown(this.dbHandle, intent.id, `provider_checkout_attach_unknown:${errorMessage(error)}`);
      throw new Error("waffo_checkout_unknown");
    }
  }

  getCheckout(sessionId: string): CheckoutRecord | undefined {
    const intent = getCheckoutIntent(this.dbHandle, sessionId) ?? checkoutIntentByProviderCheckout(this.dbHandle, sessionId);
    if (!intent) return undefined;
    return {
      sessionId: intent.provider_checkout_id ?? intent.id,
      status: intent.status === "creating" ? "open" : intent.status,
      checkoutUrl: intent.checkout_url ?? "",
      listingDraft: parseDraft(intent.listing_draft_json),
      amountUsd: intent.charge_cents / 100,
      kind: intent.kind,
      paidAt: intent.paid_at ?? undefined,
      intentId: intent.id,
      reason: intent.reason,
    };
  }

  async completeCheckout(sessionId: string): Promise<PaidEvent> {
    throw new Error(`live Waffo session ${sessionId} completes via webhook only`);
  }

  async abandonCheckout(sessionId: string): Promise<void> {
    const intent = getCheckoutIntent(this.dbHandle, sessionId) ?? checkoutIntentByProviderCheckout(this.dbHandle, sessionId);
    if (intent) markCheckoutIntentAbandoned(this.dbHandle, intent.id);
  }

  async handleWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookResult> {
    const signature = getHeader(headers, "x-waffo-signature");
    let event: Record<string, unknown>;
    try {
      const verified = verifyWebhook(rawBody, signature, {
        environment: this.mode === "waffo-prod" ? "prod" : "test",
        publicKey: this.webhookKey,
      });
      event = verified as unknown as Record<string, unknown>;
    } catch {
      throw new Error("invalid Waffo webhook signature");
    }

    const data = isRecord(event.data) ? event.data : {};
    const metadata = isRecord(data.orderMetadata) ? strictStringRecord(data.orderMetadata) ?? {} : {};
    // The official order.completed payload does not promise a checkout/session
    // field.  Prefer one when a provider extension supplies it, otherwise bind
    // the event to the checkout already attached to the immutable intent.
    const checkoutField = optionalStringField(data, [
      "checkoutId",
      "checkout_id",
      "checkoutSessionId",
      "sessionId",
      "session_id",
    ]);
    const externalIntentField = optionalStringField(data, ["orderMerchantExternalId"]);
    const productField = optionalStringField(data, ["productId", "product_id"]);
    const metadataFieldPresent = Object.prototype.hasOwnProperty.call(data, "orderMetadata");
    const metadataMalformed = metadataFieldPresent && (!isRecord(data.orderMetadata) || strictStringRecord(data.orderMetadata) === undefined);
    const payloadCheckoutId = checkoutField.value;
    const externalIntentId = externalIntentField.present ? externalIntentField.value ?? "" : metadata.intentId ?? "";
    const intent = externalIntentId ? getCheckoutIntent(this.dbHandle, externalIntentId) : undefined;
    const fallbackIntent = intent ?? (payloadCheckoutId ? checkoutIntentByProviderCheckout(this.dbHandle, payloadCheckoutId) : undefined);
    const checkoutId = payloadCheckoutId ?? fallbackIntent?.provider_checkout_id ?? "";
    const effectiveIntentId = (fallbackIntent?.id ?? externalIntentId) || null;
    const draft = fallbackIntent ? parseDraft(fallbackIntent.listing_draft_json) : undefined;
    const subtotalPresent = Object.prototype.hasOwnProperty.call(data, "subtotal");
    const amountCents = decimalToCents(subtotalPresent ? readString(data.subtotal) : readString(data.amount));
    const eventType = readString(event.eventType) ?? "";
    const target = fallbackIntent ? fallbackIntent.target_bid_cents / 100 : undefined;
    const quoteBase = fallbackIntent?.quote_base_bid_cents === null || fallbackIntent?.quote_base_bid_cents === undefined ? null : fallbackIntent.quote_base_bid_cents / 100;
    const incomingCurrency = readString(data.currency) ?? "";
    const incomingProduct = productField.present ? productField.value ?? "" : metadata.productId ?? "";
    const orderId = readString(data.orderId) ?? null;
    const paymentId = readString(data.paymentId) ?? null;
    const providerEventId = readString(event.id) ?? `invalid_delivery_${sha256(rawBody).slice(0, 20)}`;
    const businessEventId = readString(event.eventId) ?? paymentId ?? orderId ?? null;
    const rawTimestamp = readString(event.timestamp);
    const paidAt = canonicalUtcTimestamp(rawTimestamp) ?? rawTimestamp ?? checkoutNow().toISOString();
    const validationError = validateWaffoEvent({
      event,
      data,
      metadata,
      intent: fallbackIntent,
      checkoutId,
      externalIntentId,
      storeId: this.config.storeId,
      mode: this.mode === "waffo-prod" ? "prod" : "test",
      productId: this.config.productId,
      amountCents,
      checkoutFieldError: checkoutField.error,
      externalIntentFieldError: externalIntentField.error,
      productFieldError: productField.error,
      metadataMalformed,
    });
    return {
      sessionId: checkoutId || fallbackIntent?.provider_checkout_id || externalIntentId || `unknown_${providerEventId}`,
      intentId: effectiveIntentId,
      listingDraft: draft,
      amountUsd: amountCents === undefined ? fallbackIntent?.charge_cents ? fallbackIntent.charge_cents / 100 : 0 : amountCents / 100,
      amountCents: amountCents ?? undefined,
      kind: fallbackIntent?.kind ?? "create",
      paidAt,
      providerCheckoutId: checkoutId || null,
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      providerEventId,
      businessEventId,
      eventType,
      currency: incomingCurrency || null,
      productId: incomingProduct || null,
      metadata,
      intentFingerprint: metadata.intentFingerprint ?? null,
      targetBidUsd: target ?? null,
      quoteBaseBidUsd: quoteBase,
      payloadJson: rawBody,
      payloadFingerprint: sha256(rawBody),
      validationError: validationError ?? undefined,
    };
  }
}

function resolveMode(env: WaffoEnv): WaffoMode {
  const value = canonicalPaymentMode(env);
  if (value === "waffo-test" || value === "waffo-prod") return value;
  throw new Error("BLOCKED-CONFIG: PAYMENT_MODE must select a Waffo mode");
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseCheckoutResponse(
  value: unknown,
  now: Date,
  _publicBaseUrl: string,
): { sessionId: string; checkoutUrl: string; expiresAt: string } | undefined {
  const payload = checkoutResponsePayload(value);
  if (!payload) return undefined;
  const sessionId = readString(payload.sessionId);
  const checkoutUrl = readString(payload.checkoutUrl);
  const expiresAt = readString(payload.expiresAt);
  const expiry = expiresAt ? parseWaffoTimestamp(expiresAt) : Number.NaN;
  const nowMs = now.getTime();
  const canonicalExpiry = Number.isFinite(expiry) ? new Date(expiry).toISOString() : "";
  if (
    !sessionId ||
    !WAFFO_SESSION_ID.test(sessionId) ||
    !checkoutUrl ||
    !expiresAt ||
    !Number.isFinite(expiry) ||
    !Number.isFinite(nowMs) ||
    expiry <= nowMs + 1_000 ||
    expiry > nowMs + 48 * 60 * 60 * 1_000
  ) return undefined;
  try {
    const url = new URL(checkoutUrl);
    if (!isSafeCheckoutUrl(url, _publicBaseUrl, sessionId, checkoutUrl)) return undefined;
  } catch {
    return undefined;
  }
  return { sessionId, checkoutUrl, expiresAt: canonicalExpiry };
}

const WAFFO_SESSION_ID = /^[A-Z]{2,5}_[A-Za-z0-9]{22}$/;
const WAFFO_STORE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** ISO 8601 date-time with an explicit timezone; store the canonical UTC form. */
const WAFFO_ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

const CHECKOUT_RESPONSE_FIELDS = ["sessionId", "checkoutUrl", "expiresAt"] as const;

/**
 * The Pancake SDK unwraps a successful REST envelope before returning it, so
 * the normal shape is `{ sessionId, checkoutUrl, expiresAt }`. Keep the raw
 * successful envelope as a compatible source/test seam as well: only an
 * object with all three documented fields and no provider errors is accepted.
 * This avoids treating a transport envelope as malformed while preserving the
 * strict identity, origin, path, and expiry checks below.
 */
function checkoutResponsePayload(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;

  if (Object.prototype.hasOwnProperty.call(value, "errors")) {
    if (!Array.isArray(value.errors) || value.errors.length > 0) return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(value, "status")) {
    if (
      typeof value.status !== "number" ||
      !Number.isInteger(value.status) ||
      value.status < 200 ||
      value.status >= 300
    ) return undefined;
  }

  const direct = CHECKOUT_RESPONSE_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(value, field),
  );
  if (direct) {
    return CHECKOUT_RESPONSE_FIELDS.every((field) =>
      Object.prototype.hasOwnProperty.call(value, field),
    ) ? value : undefined;
  }

  if (!isRecord(value.data)) return undefined;
  return CHECKOUT_RESPONSE_FIELDS.every((field) =>
    Object.prototype.hasOwnProperty.call(value.data, field),
  ) ? value.data : undefined;
}

/**
 * Parse only the provider's explicit-timezone ISO form and reject calendar
 * overflow that `Date.parse` would otherwise normalize (for example, Feb 30).
 * Waffo responses are persisted as canonical UTC timestamps after this check.
 */
function parseWaffoTimestamp(raw: string): number {
  const match = WAFFO_ISO_TIMESTAMP.exec(raw);
  if (!match) return Number.NaN;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const milliseconds = Number((match[7] ?? "").padEnd(3, "0"));
  const zone = match[8]!;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, milliseconds);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== milliseconds
  ) return Number.NaN;

  if (zone === "Z") return date.getTime();
  const offsetHours = Number(zone.slice(1, 3));
  const offsetMinutes = Number(zone.slice(4, 6));
  if (offsetHours > 23 || offsetMinutes > 59) return Number.NaN;
  const offset = (offsetHours * 60 + offsetMinutes) * 60 * 1_000;
  return date.getTime() - (zone[0] === "+" ? offset : -offset);
}

function isSafeCheckoutUrl(url: URL, _publicBaseUrl: string, sessionId: string, rawValue: string): boolean {
  if (
    url.protocol !== "https:" ||
    url.hostname !== "pancake.waffo.ai" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    rawValue.includes("\\") ||
    rawValue.includes("%") ||
    hasExplicitPort(rawValue)
  ) return false;
  const parts = url.pathname.split("/");
  return parts.length === 5 &&
    parts[1] === "store" &&
    WAFFO_STORE_SLUG.test(parts[2] ?? "") &&
    parts[3] === "checkout" &&
    parts[4] === sessionId;
}

function optionalStringField(
  record: Record<string, unknown>,
  keys: readonly string[],
): { present: boolean; value?: string; error?: string } {
  const present = keys.filter((key) => Object.prototype.hasOwnProperty.call(record, key));
  if (present.length === 0) return { present: false };
  const values = present.map((key) => readString(record[key]));
  if (values.some((value) => value === undefined)) return { present: true, error: `malformed_${keys[0]}` };
  const first = values[0]!;
  if (values.some((value) => value !== first)) return { present: true, error: `conflicting_${keys[0]}` };
  return { present: true, value: first };
}

function boundedCheckoutTimeout(value: number | undefined): number {
  if (!Number.isFinite(value)) return 15_000;
  return Math.min(60_000, Math.max(250, Math.floor(value!)));
}

function readCheckoutTimeout(env: WaffoEnv): number | undefined {
  const raw = env.WAFFO_CHECKOUT_TIMEOUT_MS?.trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function withAbortTimeout(fetchImpl: typeof fetch, timeoutMs: number): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const callerSignal = init?.signal;
    const onCallerAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort(callerSignal.reason);
      else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<Response>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort(new Error("waffo_checkout_timeout"));
        reject(new Error("waffo_checkout_timeout"));
      }, timeoutMs);
    });
    const response = fetchImpl(input, { ...init, signal: controller.signal }).then(async (result) => {
      // The SDK reads response.json() after fetch resolves. Consume the body
      // under the same deadline so a headers-only response cannot hang forever.
      const body = await result.text();
      return new Response(body, {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
      });
    });
    try {
      return await Promise.race([response, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  };
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("waffo_checkout_timeout")), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isDefinitiveApiRejection(error: unknown): error is WaffoPancakeError {
  if (!(error instanceof WaffoPancakeError) || error.status < 400) return false;
  if (error.status >= 500 || [408, 409, 425, 429].includes(error.status)) return false;
  return !error.errors.some((entry) => entry.layer === "sdk");
}

function decimalToCents(raw: string | undefined): number | undefined {
  if (!raw || !/^\d+(?:\.\d{1,2})?$/.test(raw)) return undefined;
  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : undefined;
}

function validateWaffoEvent(input: {
  event: Record<string, unknown>;
  data: Record<string, unknown>;
  metadata: Record<string, string>;
  intent?: CheckoutIntentRow;
  checkoutId: string;
  externalIntentId: string;
  storeId: string;
  mode: "test" | "prod";
  productId: string;
  amountCents: number | undefined;
  checkoutFieldError?: string;
  externalIntentFieldError?: string;
  productFieldError?: string;
  metadataMalformed?: boolean;
}): string | undefined {
  if (input.checkoutFieldError) return input.checkoutFieldError;
  if (input.externalIntentFieldError) return input.externalIntentFieldError;
  if (input.productFieldError) return input.productFieldError;
  if (input.metadataMalformed) return "malformed_order_metadata";
  if (input.event.eventType !== "order.completed") return "unsupported_event_type";
  if (!readString(input.event.id)) return "missing_delivery_id";
  if (!readString(input.event.eventId)) return "missing_business_event_id";
  if (input.event.mode !== input.mode) return "wrong_environment";
  if (input.event.storeId !== input.storeId) return "wrong_store";
  if (input.data.orderStatus !== "completed") return "order_not_completed";
  if (input.data.paymentStatus !== "succeeded") return "payment_not_succeeded";
  if (input.data.currency !== "USD") return "wrong_currency";
  if (!readString(input.data.orderId)) return "missing_order_id";
  if (!readString(input.data.paymentId)) return "missing_payment_id";
  if (!input.externalIntentId || !input.intent) return "unknown_intent";
  // Waffo's documented webhook shape does not require a checkout/session
  // field. If the response was lost, the local intent remains the source of
  // truth and order/payment IDs plus the external intent recover the capture.
  // When either side does provide a checkout ID, it must match exactly.
  if (input.intent.provider_checkout_id && !input.checkoutId) return "missing_checkout_id";
  if (input.checkoutId && input.intent.provider_checkout_id && input.intent.provider_checkout_id !== input.checkoutId) return "checkout_intent_mismatch";
  if (input.data.orderMerchantExternalId !== input.intent.id || input.metadata.intentId !== input.intent.id) return "intent_id_mismatch";
  if (input.metadata.intentFingerprint !== input.intent.fingerprint) return "intent_fingerprint_mismatch";
  if (input.metadata.storeId !== input.intent.store_id || input.metadata.taxCategory !== input.intent.tax_category) return "intent_provider_config_mismatch";
  if (input.metadata.taxCategory !== "digital_goods") return "wrong_tax_category";
  if (input.metadata.productId !== input.intent.product_id) return "product_metadata_mismatch";
  const eventProduct = readString(input.data.productId) ?? input.metadata.productId;
  if (eventProduct !== input.productId || input.intent.product_id !== input.productId) return "wrong_product";
  const timestamp = readString(input.event.timestamp);
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return "invalid_timestamp";
  if (readString(input.event.eventId) !== readString(input.data.paymentId)) return "event_payment_mismatch";
  const amount = moneyField(input.data, "amount");
  const tax = moneyField(input.data, "taxAmount");
  const subtotal = moneyField(input.data, "subtotal");
  const total = moneyField(input.data, "total");
  if (!amount.present || amount.cents === undefined) return "invalid_amount";
  if (!tax.present || tax.cents === undefined) return "invalid_tax_amount";
  if (subtotal.present) {
    if (subtotal.cents === undefined) return "invalid_subtotal";
    if (!total.present || total.cents === undefined) return total.present ? "invalid_total" : "missing_total";
    if (subtotal.cents !== input.intent.charge_cents) return "subtotal_mismatch";
    if (total.cents !== subtotal.cents + tax.cents) return "total_mismatch";
    if (amount.cents !== total.cents) return "amount_total_mismatch";
  } else {
    // Without the tax-exclusive subtotal, only a zero-tax amount equal to the
    // immutable charge is safe to settle. A present total must agree with it.
    if (tax.cents !== 0 || amount.cents !== input.intent.charge_cents) return "amount_mismatch";
    if (total.present && (total.cents === undefined || total.cents !== amount.cents)) return total.cents === undefined ? "invalid_total" : "total_mismatch";
  }
  return undefined;
}

function moneyField(data: Record<string, unknown>, key: string): { present: boolean; cents?: number } {
  if (!Object.prototype.hasOwnProperty.call(data, key)) return { present: false };
  const raw = data[key];
  if (typeof raw !== "string" || !raw.trim()) return { present: true };
  return { present: true, cents: decimalToCents(raw.trim()) };
}

function parseDraft(raw: string) {
  return JSON.parse(raw) as CreateCheckoutInput["listingDraft"];
}

function parseMetadata(raw: string): Record<string, string> {
  const value = JSON.parse(raw) as Record<string, unknown>;
  return toStringRecord(value);
}

function toStringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]));
}

function strictStringRecord(value: Record<string, unknown>): Record<string, string> | undefined {
  if (Object.values(value).some((item) => typeof item !== "string")) return undefined;
  return value as Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function canonicalUtcTimestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
}

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) if (key.toLowerCase() === wanted) return value;
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 160) : "unknown";
}
