import { NextResponse } from "next/server";
import { canonicalizeBookingUrl } from "../../../../core/url";
import { incrementListingClicks } from "../../../../core/click";

export const dynamic = "force-dynamic";

type ClickContext = {
  params: Promise<{ id: string }>;
};

function outboundBookingUrl(stored: string): string {
  try {
    return canonicalizeBookingUrl(stored);
  } catch {
    return stored;
  }
}

/** Public booking hop. Increments clicks, then 302s to the stripped URL. */
export async function getClick(
  _request: Request,
  context: ClickContext,
): Promise<Response> {
  const params = await context.params;
  const listing = incrementListingClicks(params.id ?? "");
  if (!listing) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }
  const response = NextResponse.redirect(outboundBookingUrl(listing.bookingUrl), 302);
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export async function GET(request: Request, context: ClickContext): Promise<Response> {
  return getClick(request, context);
}
