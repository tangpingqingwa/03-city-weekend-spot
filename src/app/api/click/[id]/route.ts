import { NextResponse } from "next/server";
import type { Listing } from "../../../../core/listing";
import { canonicalizeBookingUrl } from "../../../../core/url";
import {
  getDb,
  listingFromRow,
  updateListing,
  type AppDb,
} from "../../../../db";

export const CLICK_PATH = "/api/click" as const;
export const dynamic = "force-dynamic";

type ClickContext = {
  params: Promise<{ id: string }> | { id: string };
};

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

function outboundBookingUrl(stored: string): string {
  try {
    return canonicalizeBookingUrl(stored);
  } catch {
    return stored;
  }
}

/** Public booking hop. Increments clicks, then 302s to the stripped URL. */
export async function GET(
  _request: Request,
  context: ClickContext,
): Promise<Response> {
  const params = await Promise.resolve(context.params);
  const listing = incrementListingClicks(params.id ?? "");
  if (!listing) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }
  const response = NextResponse.redirect(outboundBookingUrl(listing.bookingUrl), 302);
  response.headers.set("cache-control", "private, no-store");
  return response;
}
