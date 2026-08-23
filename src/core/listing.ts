import { MIN_BID_USD, type CitySlug, type VenueKind } from "./cities";
import { canonicalizeBookingUrl, isNsfwCopy, UrlError } from "./url";

export const VENUE_NAME_MAX = 80;
export const PITCH_MAX = 120;
export const VENUE_KINDS = ["restaurant", "bar", "show"] as const;

export type ListingErrorCode =
  | "bid_not_whole"
  | "bid_below_min"
  | "bid_not_higher"
  | "url_insecure"
  | "url_forbidden"
  | "reviews_forbidden"
  | "listing_invalid";

export type CheckoutKind = "create" | "raise";

export type BidQuote = {
  kind: CheckoutKind;
  targetBidUsd: number;
  chargeUsd: number;
};

export class ListingError extends Error {
  readonly code: ListingErrorCode;
  readonly http = 400;

  constructor(code: ListingErrorCode, message: string) {
    super(message);
    this.name = "ListingError";
    this.code = code;
  }
}

/** Paid listing row. Rank updates only after a successful payment. */
export type Listing = {
  id: string;
  city: CitySlug;
  windowId: string;
  venueName: string;
  venueKey: string;
  kind: VenueKind | null;
  bookingUrl: string;
  pitch: string | null;
  bidUsd: number;
  firstPaidAt: string;
  lastPaidAt: string;
  clicks: number;
};

export type ListingDraft = {
  city: CitySlug;
  windowId: string;
  venueName: string;
  bookingUrl: string;
  kind?: VenueKind | null;
  pitch?: string | null;
};

export type ListingInput = ListingDraft & {
  id?: string;
  bidUsd: number;
  firstPaidAt: string;
  lastPaidAt?: string;
  clicks?: number;
};

const REVIEW_SPEAK =
  /\b(\d+(\.\d+)?\s*stars?|people say|testimonials?)\b/i;

function requireTrimmed(value: string, field: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) {
    throw new ListingError(
      "listing_invalid",
      `${field} must be 1–${max} characters`,
    );
  }
  return trimmed;
}

function rejectReviewSpeak(text: string): void {
  if (REVIEW_SPEAK.test(text)) {
    throw new ListingError(
      "reviews_forbidden",
      "reviews_forbidden: invented scores and quotes are not allowed",
    );
  }
}

function rejectNsfwCopy(text: string): void {
  if (isNsfwCopy(text)) {
    throw new ListingError("url_forbidden", "NSFW copy is not allowed");
  }
}

/** Store and match the stripped booking URL only. */
export function canonicalBookingUrl(raw: string): string {
  try {
    return canonicalizeBookingUrl(raw);
  } catch (error) {
    if (error instanceof UrlError) {
      throw new ListingError(
        error.code,
        error.code === "url_insecure"
          ? "booking URL must be https"
          : "booking URL is forbidden",
      );
    }
    throw error;
  }
}

function bookingHost(bookingUrl: string): string {
  const canonical = canonicalBookingUrl(bookingUrl);
  return new URL(canonical).hostname;
}

/**
 * Canonical raise key: lowercase venue + booking host + city + window.
 * Same key → raise. Different key → new listing that pays the full bid.
 */
export function venueKey(input: {
  venueName: string;
  bookingUrl: string;
  city: CitySlug;
  windowId: string;
}): string {
  const venue = input.venueName.trim().toLowerCase();
  const host = bookingHost(input.bookingUrl);
  return `${venue}|${host}|${input.city}|${input.windowId}`;
}

export function parseVenueKind(value: unknown): VenueKind | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new ListingError("listing_invalid", "kind must be restaurant, bar, or show");
  }
  if ((VENUE_KINDS as readonly string[]).includes(value)) {
    return value as VenueKind;
  }
  throw new ListingError("listing_invalid", "kind must be restaurant, bar, or show");
}

/** Poster field is “venue name and https booking URL”. Split that into both required parts. */
export function looksLikeBookingUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length < 1) return false;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

export function parsePosterVenue(raw: unknown): {
  venueName: string;
  bookingUrl: string;
} {
  if (typeof raw !== "string" || raw.trim().length < 1) {
    throw new ListingError("listing_invalid", "venue is required");
  }
  const trimmed = raw.trim();
  const parts = trimmed.split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  if (looksLikeBookingUrl(last) && parts.length > 1) {
    return {
      venueName: parts.slice(0, -1).join(" "),
      bookingUrl: last,
    };
  }
  if (looksLikeBookingUrl(trimmed)) {
    const host = (() => {
      try {
        const parsed = new URL(
          trimmed.includes("://") ? trimmed : `https://${trimmed}`,
        );
        return parsed.hostname.replace(/^www\./, "");
      } catch {
        return trimmed;
      }
    })();
    return { venueName: host, bookingUrl: trimmed };
  }
  throw new ListingError(
    "listing_invalid",
    "include a https booking URL with the venue name",
  );
}

export function parsePitch(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ListingError("listing_invalid", "pitch must be a string");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > PITCH_MAX) {
    throw new ListingError("listing_invalid", `pitch must be ≤ ${PITCH_MAX} characters`);
  }
  rejectReviewSpeak(trimmed);
  rejectNsfwCopy(trimmed);
  return trimmed;
}

/** Whole US dollars. Floor and raise-vs-create live in quoteBid. */
export function parseTargetBidUsd(value: unknown): number {
  if (typeof value === "boolean") {
    throw new ListingError("bid_not_whole", "bid must be a whole USD amount");
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
      throw new ListingError("bid_not_whole", "bid must be a whole USD amount");
    }
    return value;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new ListingError("bid_not_whole", "bid must be a whole USD amount");
  }
  const trimmed = value.trim().replace(/^\$/, "");
  if (!/^\d+$/.test(trimmed)) {
    throw new ListingError("bid_not_whole", "bid must be a whole USD amount");
  }
  const parsed = Number(trimmed);
  if (parsed < 1) {
    throw new ListingError("bid_not_whole", "bid must be a whole USD amount");
  }
  return parsed;
}

/** Whole dollars only. First bid in a window must be ≥ $5. */
export function parseBidUsd(value: unknown): number {
  const parsed = parseTargetBidUsd(value);
  if (parsed < MIN_BID_USD) {
    throw new ListingError("bid_below_min", `first bid must be at least $${MIN_BID_USD}`);
  }
  return parsed;
}

/**
 * First listing this city + window pays the full bid (≥ $5).
 * Same venue key pays only new − current. Raise must be ≥ current + $1.
 */
export function quoteBid(
  existing: Pick<Listing, "bidUsd"> | undefined,
  targetBidUsd: number,
): BidQuote {
  if (!Number.isInteger(targetBidUsd) || targetBidUsd < 1) {
    throw new ListingError("bid_not_whole", "bid must be a whole USD amount");
  }
  if (!existing) {
    if (targetBidUsd < MIN_BID_USD) {
      throw new ListingError(
        "bid_below_min",
        `first bid must be at least $${MIN_BID_USD}`,
      );
    }
    return { kind: "create", targetBidUsd, chargeUsd: targetBidUsd };
  }
  if (targetBidUsd <= existing.bidUsd) {
    throw new ListingError(
      "bid_not_higher",
      "raise must be greater than the current bid",
    );
  }
  return {
    kind: "raise",
    targetBidUsd,
    chargeUsd: targetBidUsd - existing.bidUsd,
  };
}

export function targetBidAfterPayment(
  existing: Pick<Listing, "bidUsd"> | undefined,
  chargedUsd: number,
  kind: CheckoutKind,
): number {
  if (kind === "raise") {
    if (!existing) {
      throw new ListingError(
        "bid_not_higher",
        "raise must be greater than the current bid",
      );
    }
    return existing.bidUsd + chargedUsd;
  }
  return chargedUsd;
}

export function findListingByVenueKey(
  listings: readonly Listing[],
  input: {
    venueName: string;
    bookingUrl: string;
    city: CitySlug;
    windowId: string;
  },
): Listing | undefined {
  const key = venueKey(input);
  return listings.find((row) => row.venueKey === key);
}

/** Same row, new bid. firstPaidAt and clicks stay put. */
export function raiseListing(
  existing: Listing,
  input: {
    targetBidUsd: number;
    lastPaidAt: string;
    venueName?: string;
    bookingUrl?: string;
    kind?: VenueKind | null;
    pitch?: string | null;
  },
): Listing {
  const quote = quoteBid(existing, input.targetBidUsd);
  return createListing({
    id: existing.id,
    city: existing.city,
    windowId: existing.windowId,
    venueName: input.venueName ?? existing.venueName,
    bookingUrl: input.bookingUrl ?? existing.bookingUrl,
    kind: input.kind !== undefined ? input.kind : existing.kind,
    pitch: input.pitch !== undefined ? input.pitch : existing.pitch,
    bidUsd: quote.targetBidUsd,
    firstPaidAt: existing.firstPaidAt,
    lastPaidAt: input.lastPaidAt,
    clicks: existing.clicks,
  });
}

export function createListing(input: ListingInput): Listing {
  const venueName = requireTrimmed(input.venueName, "venueName", VENUE_NAME_MAX);
  rejectReviewSpeak(venueName);
  rejectNsfwCopy(venueName);
  const bookingUrl = canonicalBookingUrl(input.bookingUrl);
  const kind = parseVenueKind(input.kind);
  const pitch = parsePitch(input.pitch);
  const bidUsd = parseBidUsd(input.bidUsd);
  const firstPaidAt = input.firstPaidAt;
  const lastPaidAt = input.lastPaidAt ?? firstPaidAt;
  const key = venueKey({
    venueName,
    bookingUrl,
    city: input.city,
    windowId: input.windowId,
  });
  return {
    id: input.id ?? `${input.city}:${key}:${firstPaidAt}`,
    city: input.city,
    windowId: input.windowId,
    venueName,
    venueKey: key,
    kind,
    bookingUrl,
    pitch,
    bidUsd,
    firstPaidAt,
    lastPaidAt,
    clicks: input.clicks ?? 0,
  };
}
