import { resolveCity, type BoardListing, type CitySlug } from "./cities";
import { getDb, listingsForCityWindow, type AppDb } from "../db";
import { isPaidListing, type Listing } from "./listing";
import { currentWindow } from "./window";

export type RankableListing = Pick<
  Listing,
  "id" | "city" | "windowId" | "bidUsd" | "firstPaidAt"
>;

export type RankedListing<T extends RankableListing = Listing> = T & {
  rank: number;
};

export type RankQuery = {
  city: CitySlug;
  windowId?: string;
};

/**
 * ORDER BY bid_usd DESC, first_paid_at ASC, id ASC.
 * Ranking is `(city, window)`. NYC is a catalog slug, not a special case.
 */
export function compareListings(a: RankableListing, b: RankableListing): number {
  if (a.bidUsd !== b.bidUsd) {
    return b.bidUsd - a.bidUsd;
  }
  if (a.firstPaidAt !== b.firstPaidAt) {
    return a.firstPaidAt < b.firstPaidAt ? -1 : 1;
  }
  if (a.id !== b.id) {
    return a.id < b.id ? -1 : 1;
  }
  return 0;
}

export function listingsForLane<T extends RankableListing>(
  listings: readonly T[],
  query: RankQuery,
): T[] {
  return listings.filter((listing) => {
    if (listing.city !== query.city) {
      return false;
    }
    if (query.windowId !== undefined && listing.windowId !== query.windowId) {
      return false;
    }
    return true;
  });
}

export function rankListings<T extends RankableListing>(
  listings: readonly T[],
  query: RankQuery,
): RankedListing<T>[] {
  const lane = listingsForLane(listings, query);
  const ordered = [...lane].sort(compareListings);
  return ordered.map((listing, index) => ({ ...listing, rank: index + 1 }));
}

export function toBoardListing(listing: RankedListing): BoardListing {
  return {
    id: listing.id,
    city: listing.city,
    venueName: listing.venueName,
    kind: listing.kind,
    bookingUrl: listing.bookingUrl,
    pitch: listing.pitch,
    bidUsd: listing.bidUsd,
    clicks: listing.clicks,
    rank: listing.rank,
    firstPaidAt: listing.firstPaidAt,
  };
}

/**
 * Live board for `city` + its current weekend window.
 * Empty until Polar reports paid. Unpaid / abandoned never invent a #1.
 */
export function getBoardListings(
  city: CitySlug,
  now: Date = new Date(),
  db: AppDb = getDb(),
): BoardListing[] {
  const resolved = resolveCity(city);
  if (!resolved.ok) {
    return [];
  }
  const window = currentWindow(resolved.city, now);
  const paid = listingsForCityWindow(db, city, window.id).filter(isPaidListing);
  return rankListings(paid, {
    city,
    windowId: window.id,
  }).map(toBoardListing);
}
