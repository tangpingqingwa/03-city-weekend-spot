import { MIN_BID_USD, type CitySlug, type VenueKind } from "./cities";

export const VENUE_NAME_MAX = 80;
export const PITCH_MAX = 120;
export const VENUE_KINDS = ["restaurant", "bar", "show"] as const;

export type ListingErrorCode =
  | "bid_not_whole"
  | "bid_below_min"
  | "url_insecure"
  | "reviews_forbidden"
  | "listing_invalid";

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

function bookingHost(bookingUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(bookingUrl);
  } catch {
    throw new ListingError("url_insecure", "booking URL must be https");
  }
  if (parsed.protocol !== "https:") {
    throw new ListingError("url_insecure", "booking URL must be https");
  }
  const host = parsed.hostname.trim().toLowerCase();
  if (!host) {
    throw new ListingError("url_insecure", "booking URL must be https");
  }
  return host;
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
  return trimmed;
}

/** Whole dollars only. First bid in a window must be ≥ $5. */
export function parseBidUsd(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ListingError("bid_not_whole", "bid must be a whole USD amount");
  }
  if (!Number.isInteger(value)) {
    throw new ListingError("bid_not_whole", "bid must be a whole USD amount");
  }
  if (value < MIN_BID_USD) {
    throw new ListingError("bid_below_min", `first bid must be at least $${MIN_BID_USD}`);
  }
  return value;
}

export function createListing(input: ListingInput): Listing {
  const venueName = requireTrimmed(input.venueName, "venueName", VENUE_NAME_MAX);
  rejectReviewSpeak(venueName);
  const bookingUrl = input.bookingUrl.trim();
  bookingHost(bookingUrl);
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
