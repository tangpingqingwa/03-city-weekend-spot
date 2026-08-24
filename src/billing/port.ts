import { MIN_BID_USD, getCity, resolveCity, type CitySlug } from "../core/cities";
import {
  ListingError,
  createListing,
  isPaidListing,
  parsePitch,
  parsePosterVenue,
  parseTargetBidUsd,
  parseVenueKind,
  quoteBid,
  raiseListing,
  targetBidAfterPayment,
  venueKey,
  type BidQuote,
  type Listing,
  type ListingDraft,
} from "../core/listing";
import { assertWindowOpen, currentWindow } from "../core/window";
import {
  findListingByVenueKey as findDbListingByVenueKey,
  getDb,
  insertListing,
  listingFromRow,
  resetDbCache,
  updateListing,
  upsertWindow,
  type AppDb,
} from "../db";
import { FixturePayment, getFixturePayment } from "./fixture";
import { PolarPayment } from "./polar";

export type { ListingDraft };

export type PolarEnv = Record<string, string | undefined>;

/** Live Polar only when POLAR_LIVE=1. Unset / 0 / true stay fixture. */
export function polarLiveEnabled(env: PolarEnv = process.env): boolean {
  if (env.POLAR_FIXTURE_ONLY === "1") return false;
  return env.POLAR_LIVE === "1";
}

export function polarAccessToken(env: PolarEnv = process.env): string | undefined {
  const token = env.POLAR_ACCESS_TOKEN?.trim();
  return token ? token : undefined;
}

export function polarWebhookSecret(env: PolarEnv = process.env): string | undefined {
  const secret = env.POLAR_WEBHOOK_SECRET?.trim();
  return secret ? secret : undefined;
}

/** Optional Polar product. Sandbox checkout requires product_id. */
export function polarProductId(env: PolarEnv = process.env): string | undefined {
  const id = env.POLAR_PRODUCT_ID?.trim();
  return id ? id : undefined;
}

/** Default production host. Operator smoke may set POLAR_API_BASE to sandbox. */
export function polarApiBase(env: PolarEnv = process.env): string {
  const fromEnv = env.POLAR_API_BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `https://${["api", "polar", "sh"].join(".")}`;
}

export function publicBaseUrl(env: PolarEnv = process.env): string {
  const raw = env.PUBLIC_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:3000";
}

export type CheckoutKind = "create" | "raise";

export type CreateCheckoutInput = {
  listingDraft: ListingDraft;
  amountUsd: number;
  kind: CheckoutKind;
};

export type CheckoutStart = {
  checkoutUrl: string;
  sessionId: string;
};

export type CheckoutStatus = "open" | "paid" | "abandoned";

export type CheckoutRecord = {
  sessionId: string;
  status: CheckoutStatus;
  checkoutUrl: string;
  listingDraft: ListingDraft;
  amountUsd: number;
  kind: CheckoutKind;
  paidAt?: string;
};

export type PaidEvent = {
  sessionId: string;
  listingDraft: ListingDraft;
  amountUsd: number;
  kind: CheckoutKind;
  paidAt: string;
};

export type WebhookResult = PaidEvent | { ignored: true };

/** SPEC §8. Routes import this port, never `billing/polar.ts`. */
export type PaymentPort = {
  readonly kind: "fixture" | "live";
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutStart>;
  handleWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookResult>;
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

/** Tests freeze the weekend clock so CI is not day-of-week dependent. */
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
    if (error instanceof ListingError) {
      throw new CheckoutError(error.code, error.http, error.message);
    }
    throw error;
  }
}

export function parseListingDraft(
  body: Record<string, unknown>,
  windowId: string,
  city: CitySlug,
): ListingDraft {
  const hasExplicit =
    typeof body.venueName === "string" &&
    body.venueName.trim() !== "" &&
    typeof body.bookingUrl === "string" &&
    body.bookingUrl.trim() !== "";
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
      if (error instanceof ListingError) {
        throw new CheckoutError(error.code, error.http, error.message);
      }
      throw error;
    }
  } else {
    venueName = readRequiredText(body.venueName ?? body.venue, "venueName");
    bookingUrl = readRequiredText(body.bookingUrl, "bookingUrl");
  }
  const venueKind =
    body.kind === "create" || body.kind === "raise" ? body.venueKind : body.kind;
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
    if (error instanceof ListingError) {
      throw new CheckoutError(error.code, error.http, error.message);
    }
    throw error;
  }
}

export function resolveCheckoutWindow(cityRaw: unknown): {
  city: CitySlug;
  windowId: string;
} {
  const slug = typeof cityRaw === "string" ? cityRaw.trim() : "";
  const resolved = resolveCity(slug);
  if (!resolved.ok) {
    throw new CheckoutError(resolved.code, 404);
  }
  const window = assertWindowOpen(resolved.city.slug, checkoutNow());
  if (!window.ok) {
    throw new CheckoutError(window.code, window.http);
  }
  return { city: resolved.city.slug, windowId: window.window.id };
}

function readRequiredText(raw: unknown, field: string): string {
  if (typeof raw !== "string") {
    throw new CheckoutError("listing_invalid", 400, `${field} is required`);
  }
  const trimmed = raw.trim();
  if (trimmed.length < 1) {
    throw new CheckoutError("listing_invalid", 400, `${field} is required`);
  }
  return trimmed;
}

export function createPaymentPort(env: PolarEnv = process.env): PaymentPort {
  if (polarLiveEnabled(env)) {
    const token = polarAccessToken(env);
    if (!token) {
      throw new Error("BLOCKED-SECRET: POLAR_ACCESS_TOKEN");
    }
    return new PolarPayment({ env });
  }
  return env === process.env ? getFixturePayment() : new FixturePayment();
}

let defaultPort: PaymentPort | undefined;

/** Shared adapter so checkout and webhook see the same fixture sessions. */
export function getPaymentPort(env: PolarEnv = process.env): PaymentPort {
  if (env !== process.env) {
    return createPaymentPort(env);
  }
  if (!defaultPort) {
    defaultPort = createPaymentPort(env);
  }
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
    if (row.polar_session === sessionId) return row;
  }
  return undefined;
}

export function listingForSession(
  sessionId: string,
  db: AppDb = getDb(),
): Listing | undefined {
  const payment = paymentForSession(db, sessionId);
  if (!payment) return undefined;
  const row = db.listings.get(payment.listing_id);
  return row ? listingFromRow(row) : undefined;
}

export function findPaidByVenueKey(
  draft: ListingDraft,
  db: AppDb = getDb(),
): Listing | undefined {
  const key = venueKey(draft);
  const existing = findDbListingByVenueKey(db, key);
  if (!existing) return undefined;
  return isPaidListing(existing) ? existing : undefined;
}

export function quoteCheckout(
  draft: ListingDraft,
  targetBidUsd: number,
  db: AppDb = getDb(),
): BidQuote {
  try {
    return quoteBid(findPaidByVenueKey(draft, db), targetBidUsd);
  } catch (error) {
    if (error instanceof ListingError) {
      throw new CheckoutError(error.code, error.http, error.message);
    }
    throw error;
  }
}

function ensureWindow(db: AppDb, listing: Listing): void {
  const city = getCity(listing.city);
  if (city) {
    const window = currentWindow(city, checkoutNow());
    if (window.id === listing.windowId) {
      upsertWindow(db, window);
    }
  }
}

/** Rank updates only after a successful paid event. Session replay is a no-op. */
export function applyPaidEvent(event: PaidEvent, db: AppDb = getDb()): Listing {
  const replayed = paymentForSession(db, event.sessionId);
  if (replayed) {
    const row = db.listings.get(replayed.listing_id);
    if (!row) {
      throw new Error(`checkout ${event.sessionId} points at a missing listing`);
    }
    return listingFromRow(row);
  }

  const existing = findPaidByVenueKey(event.listingDraft, db);
  let listing: Listing;
  try {
    const targetBidUsd = targetBidAfterPayment(
      existing,
      event.amountUsd,
      event.kind,
    );
    quoteBid(existing, targetBidUsd);
    if (existing) {
      listing = raiseListing(existing, {
        targetBidUsd,
        lastPaidAt: event.paidAt,
        venueName: event.listingDraft.venueName,
        bookingUrl: event.listingDraft.bookingUrl,
        kind: event.listingDraft.kind,
        pitch: event.listingDraft.pitch,
      });
    } else {
      listing = createListing({
        id: `lst_${event.sessionId}`,
        city: event.listingDraft.city,
        windowId: event.listingDraft.windowId,
        venueName: event.listingDraft.venueName,
        bookingUrl: event.listingDraft.bookingUrl,
        kind: event.listingDraft.kind,
        pitch: event.listingDraft.pitch,
        bidUsd: targetBidUsd,
        firstPaidAt: event.paidAt,
        lastPaidAt: event.paidAt,
        clicks: 0,
      });
    }
  } catch (error) {
    if (error instanceof ListingError) {
      throw new CheckoutError(error.code, error.http, error.message);
    }
    throw error;
  }

  ensureWindow(db, listing);
  if (existing) {
    updateListing(db, listing);
  } else {
    insertListing(db, listing);
  }
  db.payments.set(event.sessionId, {
    id: event.sessionId,
    listing_id: listing.id,
    polar_session: event.sessionId,
    amount_usd: event.amountUsd,
    kind: event.kind,
  });
  return listing;
}
