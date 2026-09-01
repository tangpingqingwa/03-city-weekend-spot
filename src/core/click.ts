import type { Listing } from "./listing";
import {
  getDb,
  listingFromRow,
  updateListing,
  type AppDb,
} from "../db";
import { CLICK_PATH } from "./route-contract";

export function listingClickPath(id: string): string {
  return `${CLICK_PATH}/${id}`;
}

/** One increment per successful redirect. Destination is the stored booking URL. */
export function incrementListingClicks(
  id: string,
  db: AppDb = getDb(),
): Listing | undefined {
  const trimmed = id.trim();
  if (!trimmed) return undefined;
  const row = db.listings.get(trimmed);
  if (!row) return undefined;
  const listing: Listing = { ...listingFromRow(row), clicks: row.clicks + 1 };
  updateListing(db, listing);
  return listing;
}
