import { MIN_BID_USD, getCity, resolveCity, type CitySlug } from "../core/cities";
import {
  ListingError,
  createListing,
  parsePitch,
  parsePosterVenue,
  parseTargetBidUsd,
  parseVenueKind,
  quoteBid,
  venueKey,
  type BidQuote,
  type Listing,
  type ListingDraft,
} from "../core/listing";
import { assertWindowOpen } from "../core/window";
import {
  attachCheckoutIntent,
  checkoutIntentByProviderCheckout,
  createCheckoutIntent,
  findLiveListingByVenueKey,
  getCheckoutIntent,
  getDb,
  listingFromRow,
  markCheckoutIntentAbandoned,
  resetDbCache,
  settlePaidEvent,
  sha256,
  type AppDb,
  type CheckoutIntentRow,
  type PaidSettlementInput,
} from "../db";
import { FixturePayment, getFixturePayment } from "./fixture";
import { WaffoPayment, type WaffoPaymentOptions } from "./waffo";
import { POLAR_API_BASE } from "./polar";
import { paymentMode as canonicalPaymentMode, type PaymentMode as CanonicalPaymentMode } from "../config";

export type { ListingDraft };

/** Kept as a source-compatible name for older tests; Polar is inert. */
export type PolarEnv = Record<string, string | undefined>;

export function polarLiveEnabled(_env: PolarEnv = process.env): boolean {
  return false;
}

export function polarAccessToken(_env: PolarEnv = process.env): string | undefined {
  return undefined;
}

export function polarWebhookSecret(_env: PolarEnv = process.env): string | undefined {
  return undefined;
}

export function polarProductId(_env: PolarEnv = process.env): string | undefined {
  return undefined;
}

export function polarApiBase(_env: PolarEnv = process.env): string {
  return POLAR_API_BASE;
}

export function publicBaseUrl(env: PolarEnv = process.env): string {
  const explicit = env.WAFFO_PUBLIC_BASE_URL?.trim();
  const alias = env.PUBLIC_BASE_URL?.trim();
  if (explicit && alias && explicit !== alias) throw new Error("BLOCKED-CONFIG: PUBLIC_BASE_URL aliases disagree");
  const raw = explicit ?? alias;
  return (raw || "http://localhost:3000").replace(/\/$/, "");
}

export type CheckoutKind = "create" | "raise";

export type CreateCheckoutInput = {
  listingDraft: ListingDraft;
  /** Charge in whole USD, retained for the old route contract. */
  amountUsd: number;
  kind: CheckoutKind;
  /** Immutable target and quote snapshot set before provider I/O. */
  targetBidUsd?: number;
  quoteBaseBidUsd?: number | null;
  chargeCents?: number;
};

export type CheckoutStart = {
  checkoutUrl: string;
  sessionId: string;
  intentId?: string;
  expiresAt?: string;
};

export type CheckoutStatus = "open" | "paid" | "abandoned" | "unknown" | "reconciliation_required" | "needs_reconciliation" | "rejected";

export type CheckoutRecord = {
  sessionId: string;
  status: CheckoutStatus;
  checkoutUrl: string;
  listingDraft: ListingDraft;
  amountUsd: number;
  kind: CheckoutKind;
  paidAt?: string;
  intentId?: string;
  reason?: string | null;
};

export type PaidEvent = PaidSettlementInput;

export type WebhookResult = PaidEvent | { ignored: true };

export type PaymentPort = {
  readonly kind: "fixture" | "live";
  readonly mode?: "fixture" | "waffo-test" | "waffo-prod";
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutStart>;
  handleWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookResult>;
  getCheckout(sessionId: string): CheckoutRecord | undefined;
  completeCheckout(sessionId: string): Promise<PaidEvent>;
  abandonCheckout(sessionId: string): Promise<void>;
};

export class CheckoutError extends Error {
  readonly code: string;
  readonly http: number;

  constructor(code: string, http: number, message?: string) {
    super(message ?? code);
    this.name = "CheckoutError";
    this.code = code;
    this.http = http;
  }
}

let nowFn: () => Date = () => new Date();

export function setCheckoutNow(now: Date | undefined): void {
  nowFn = now ? () => new Date(now.getTime()) : () => new Date();
}

export function checkoutNow(): Date {
  return nowFn();
}

export function parseAmountUsd(raw: unknown): number {
  try {
    return parseTargetBidUsd(raw);
  } catch (error) {
    if (error instanceof ListingError) throw new CheckoutError(error.code, error.http, error.message);
    throw error;
  }
}

export function parseListingDraft(body: Record<string, unknown>, windowId: string, city: CitySlug): ListingDraft {
  const hasExplicit = typeof body.venueName === "string" && body.venueName.trim() !== "" && typeof body.bookingUrl === "string" && body.bookingUrl.trim() !== "";
  let venueName: string;
  let bookingUrl: string;
  if (hasExplicit) {
    venueName = readRequiredText(body.venueName, "venueName");
    bookingUrl = readRequiredText(body.bookingUrl, "bookingUrl");
  } else if (typeof body.venue === "string" && body.venue.trim() !== "") {
    try {
      const parsed = parsePosterVenue(body.venue);
      venueName = parsed.venueName;
      bookingUrl = parsed.bookingUrl;
    } catch (error) {
      if (error instanceof ListingError) throw new CheckoutError(error.code, error.http, error.message);
      throw error;
    }
  } else {
    venueName = readRequiredText(body.venueName ?? body.venue, "venueName");
    bookingUrl = readRequiredText(body.bookingUrl, "bookingUrl");
  }
  const venueKind = body.kind === "create" || body.kind === "raise" ? body.venueKind : body.kind;
  try {
    const listing = createListing({
      city,
      windowId,
      venueName,
      bookingUrl,
      kind: parseVenueKind(venueKind),
      pitch: parsePitch(body.pitch),
      bidUsd: MIN_BID_USD,
      firstPaidAt: "1970-01-01T00:00:00.000Z",
    });
    return {
      city: listing.city,
      windowId: listing.windowId,
      venueName: listing.venueName,
      bookingUrl: listing.bookingUrl,
      kind: listing.kind,
      pitch: listing.pitch,
    };
  } catch (error) {
    if (error instanceof ListingError) throw new CheckoutError(error.code, error.http, error.message);
    throw error;
  }
}

export function resolveCheckoutWindow(cityRaw: unknown): { city: CitySlug; windowId: string } {
  const slug = typeof cityRaw === "string" ? cityRaw.trim() : "";
  const resolved = resolveCity(slug);
  if (!resolved.ok) throw new CheckoutError(resolved.code, 404);
  const window = assertWindowOpen(resolved.city.slug, checkoutNow());
  if (!window.ok) throw new CheckoutError(window.code, window.http);
  return { city: resolved.city.slug, windowId: window.window.id };
}

function readRequiredText(raw: unknown, field: string): string {
  if (typeof raw !== "string" || raw.trim().length < 1) throw new CheckoutError("listing_invalid", 400, `${field} is required`);
  return raw.trim();
}

export type PaymentMode = CanonicalPaymentMode;

/** PAYMENT_MODE is the only provider selector; legacy aliases cannot select. */
export function paymentMode(env: PolarEnv = process.env): PaymentMode {
  return canonicalPaymentMode(env);
}

function centsFromUsd(amountUsd: number): number {
  if (!Number.isInteger(amountUsd) || amountUsd < 1) throw new CheckoutError("bid_not_whole", 400);
  return amountUsd * 100;
}

function checkoutMetadata(input: CreateCheckoutInput, targetBidUsd: number, chargeCents: number): Record<string, string> {
  const metadata: Record<string, string> = {
    city: input.listingDraft.city,
    windowId: input.listingDraft.windowId,
    venueName: input.listingDraft.venueName,
    bookingUrl: input.listingDraft.bookingUrl,
    kind: input.kind,
    targetBidCents: String(targetBidUsd * 100),
    chargeCents: String(chargeCents),
    currency: "USD",
    canonicalUrl: input.listingDraft.bookingUrl,
  };
  if (input.listingDraft.kind) metadata.venueKind = input.listingDraft.kind;
  if (input.listingDraft.pitch) metadata.pitch = input.listingDraft.pitch;
  if (input.quoteBaseBidUsd !== undefined && input.quoteBaseBidUsd !== null) metadata.quoteBaseBidCents = String(input.quoteBaseBidUsd * 100);
  return metadata;
}

/** Persist the local immutable intent before invoking any provider SDK. */
export function prepareCheckoutIntent(
  input: CreateCheckoutInput,
  mode: PaymentMode,
  productId: string,
  db: AppDb = getDb(),
  expectedStoreId = mode === "fixture" ? "fixture" : "",
): CheckoutIntentRow {
  const chargeCents = input.chargeCents ?? centsFromUsd(input.amountUsd);
  const targetBidUsd = input.targetBidUsd ?? (input.kind === "create" ? input.amountUsd : (input.quoteBaseBidUsd ?? 0) + input.amountUsd);
  if (!Number.isSafeInteger(targetBidUsd) || targetBidUsd < MIN_BID_USD) throw new CheckoutError("bid_not_whole", 400);
  if (!Number.isSafeInteger(chargeCents) || chargeCents < 100 || !Number.isSafeInteger(input.amountUsd) || input.amountUsd * 100 !== chargeCents) {
    throw new CheckoutError("bid_not_whole", 400);
  }
  if (input.kind === "create" && targetBidUsd !== input.amountUsd) throw new CheckoutError("bid_not_whole", 400);
  if (input.kind === "raise" && (input.quoteBaseBidUsd === undefined || input.quoteBaseBidUsd === null || targetBidUsd - input.quoteBaseBidUsd !== input.amountUsd)) {
    throw new CheckoutError("bid_not_whole", 400);
  }
  return createCheckoutIntent(db, {
    mode,
    listingDraft: input.listingDraft,
    kind: input.kind,
    targetBidUsd,
    quoteBaseBidUsd: input.quoteBaseBidUsd ?? (input.kind === "raise" ? targetBidUsd - chargeCents / 100 : null),
    chargeCents,
    currency: "USD",
    productId,
    metadata: {
      ...checkoutMetadata(input, targetBidUsd, chargeCents),
      productId,
      mode,
      storeId: expectedStoreId,
      taxCategory: "digital_goods",
    },
    storeId: expectedStoreId,
    taxCategory: "digital_goods",
    createdAt: checkoutNow().toISOString(),
  });
}

export function createPaymentPort(env: PolarEnv = process.env, options: WaffoPaymentOptions = {}): PaymentPort {
  const mode = paymentMode(env);
  if (mode === "fixture") return env === process.env && !options.db ? getFixturePayment() : new FixturePayment(options.db);
  return new WaffoPayment({ ...options, env, mode });
}

let defaultPort: PaymentPort | undefined;

export function getPaymentPort(env: PolarEnv = process.env): PaymentPort {
  if (env !== process.env) return createPaymentPort(env);
  if (!defaultPort) defaultPort = createPaymentPort(env);
  return defaultPort;
}

export function resetPaymentPort(): void {
  defaultPort = undefined;
  getFixturePayment().reset();
}

export function resetCheckoutState(): void {
  resetPaymentPort();
  resetDbCache();
  setCheckoutNow(undefined);
}

function paymentForSession(db: AppDb, sessionId: string) {
  for (const row of db.payments.values()) {
    if (row.polar_session === sessionId || row.provider_checkout_id === sessionId || row.intent_id === sessionId) return row;
  }
  const intent = getCheckoutIntent(db, sessionId);
  if (intent?.provider_checkout_id) {
    for (const row of db.payments.values()) if (row.provider_checkout_id === intent.provider_checkout_id) return row;
  }
  return undefined;
}

export function listingForSession(sessionId: string, db: AppDb = getDb()): Listing | undefined {
  const payment = paymentForSession(db, sessionId);
  if (!payment || payment.status !== "applied" || !payment.listing_id) return undefined;
  const row = db.listings.get(payment.listing_id);
  return row ? listingFromRow(row) : undefined;
}

export function findPaidByVenueKey(draft: ListingDraft, db: AppDb = getDb(), now: Date = checkoutNow()): Listing | undefined {
  return findLiveListingByVenueKey(db, venueKey(draft), now);
}

export function quoteCheckout(draft: ListingDraft, targetBidUsd: number, db: AppDb = getDb()): BidQuote {
  try {
    return quoteBid(findPaidByVenueKey(draft, db), targetBidUsd);
  } catch (error) {
    if (error instanceof ListingError) throw new CheckoutError(error.code, error.http, error.message);
    throw error;
  }
}

/** Rank can only change through the durable settlement function. */
export function applyPaidEvent(event: PaidEvent, db: AppDb = getDb()): Listing {
  let settlementEvent = event;
  // Older domain/unit callers supplied an already trusted paid fact without
  // an intent envelope. Keep that narrow compatibility path for local tests;
  // webhook-shaped events can never use it because they carry provider IDs
  // or a raw payload and therefore must correlate to a persisted intent.
  if (!event.intentId && !event.payloadJson && !event.providerEventId && !event.providerOrderId && !event.providerPaymentId) {
    const existing = findPaidByVenueKey(event.listingDraft!, db, new Date(event.paidAt));
    const targetBidUsd = event.targetBidUsd ?? (event.kind === "raise" ? (existing?.bidUsd ?? 0) + event.amountUsd : event.amountUsd);
    const legacyId = `legacy_${sha256(event.sessionId).slice(0, 32)}`;
    const intent = getCheckoutIntent(db, legacyId) ?? createCheckoutIntent(db, {
        id: legacyId,
        mode: "fixture",
        listingDraft: event.listingDraft!,
        kind: event.kind,
        targetBidUsd,
        quoteBaseBidUsd: event.quoteBaseBidUsd ?? (event.kind === "raise" ? existing?.bidUsd ?? null : null),
        chargeCents: event.amountCents ?? event.amountUsd * 100,
        currency: "USD",
        productId: "fixture",
        metadata: checkoutMetadata({ listingDraft: event.listingDraft!, amountUsd: event.amountUsd, kind: event.kind }, targetBidUsd, event.amountCents ?? event.amountUsd * 100),
        createdAt: event.paidAt,
      });
    if (!intent.provider_checkout_id) {
      attachCheckoutIntent(db, intent.id, {
        providerCheckoutId: event.sessionId,
        checkoutUrl: fixtureCheckoutUrlForLegacy(event.listingDraft!.city, event.sessionId),
      });
    }
    const attached = getCheckoutIntent(db, intent.id)!;
    settlementEvent = {
      ...event,
      intentId: intent.id,
      providerCheckoutId: attached.provider_checkout_id ?? event.sessionId,
      providerOrderId: `legacy_order_${event.sessionId}`,
      providerPaymentId: `legacy_payment_${event.sessionId}`,
      providerEventId: `legacy_delivery_${event.sessionId}`,
      businessEventId: `legacy_business_${event.sessionId}`,
      eventType: "order.completed",
      currency: "USD",
      productId: "fixture",
      metadata: parseIntentMetadata(attached.metadata_json),
      intentFingerprint: attached.fingerprint,
      targetBidUsd: targetBidUsd,
      quoteBaseBidUsd: attached.quote_base_bid_cents === null ? null : attached.quote_base_bid_cents / 100,
      amountCents: attached.charge_cents,
    };
  }
  const result = settlePaidEvent(db, settlementEvent);
  if (result.listing) return result.listing;
  if (result.status === "replayed") {
    const listing = listingForSession(settlementEvent.sessionId, db);
    if (listing) return listing;
  }
  const code = result.reason ?? (result.status === "reconciliation_required" ? "reconciliation_required" : "payment_rejected");
  throw new CheckoutError(code, result.status === "reconciliation_required" ? 409 : 400);
}

function parseIntentMetadata(raw: string): Record<string, string> {
  const value = JSON.parse(raw) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]));
}

function fixtureCheckoutUrlForLegacy(city: string, sessionId: string): string {
  return `/${city}/return?sessionId=${encodeURIComponent(sessionId)}`;
}

export function intentRecordForSession(sessionId: string, db: AppDb = getDb()): CheckoutIntentRow | undefined {
  return getCheckoutIntent(db, sessionId) ?? checkoutIntentByProviderCheckout(db, sessionId);
}

export function markSessionAbandoned(sessionId: string, db: AppDb = getDb()): void {
  const intent = intentRecordForSession(sessionId, db);
  if (intent) markCheckoutIntentAbandoned(db, intent.id);
}
