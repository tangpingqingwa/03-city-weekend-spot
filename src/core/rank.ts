import { resolveCity, type BoardListing, type CitySlug } from "./cities";
import { getDb, listingsForCityRollingWeek, type AppDb } from "../db";
import { isPaidListing, type Listing } from "./listing";
import { bidInRollingWeek } from "./window";

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
  now?: Date;
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
    if (query.now !== undefined && !bidInRollingWeek(listing.firstPaidAt, query.now)) {
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
 * Live board for `city` + rolling last 7 days from paid createdAt.
 * ISO `{city}:{iso_week}` stays a Polar/audit label. Monday 00:00 UTC is not
 * occupancy expiry. Empty until Polar reports paid. Unpaid never invent a #1.
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
  const paid = listingsForCityRollingWeek(db, city, now).filter(isPaidListing);
  return rankListings(paid, {
    city,
    now,
  }).map(toBoardListing);
}
