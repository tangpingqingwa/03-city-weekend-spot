import { listingForSession } from "../billing/port";

export type ReturnQuery = {
  sessionId?: string | string[];
  checkoutId?: string | string[];
  intent?: string | string[];
  status?: string | string[];
};

export type ReturnResolution = {
  status: "paid" | "pending";
  listingId?: string;
};

function firstQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Resolve a checkout return from payment state, never from the query status alone. */
export async function resolveReturn(
  params: ReturnQuery,
): Promise<ReturnResolution> {
  const sessionId = firstQuery(params.sessionId) ?? firstQuery(params.checkoutId) ?? firstQuery(params.intent);
  if (!sessionId) {
    return { status: "pending" };
  }

  // A browser-controlled return query is informational only. It reads the
  // already-applied local ledger; only a verified provider event (or an
  // explicit fixture test event) may change payment truth.
  const listing = listingForSession(sessionId);
  return listing ? { status: "paid", listingId: listing.id } : { status: "pending" };
}
