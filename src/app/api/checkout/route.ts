import { NextResponse } from "next/server";
import {
  CheckoutError,
  getPaymentPort,
  parseAmountUsd,
  parseListingDraft,
  quoteCheckout,
  resolveCheckoutWindow,
} from "../../../billing/port";
import { getCheckoutIntent, getDb } from "../../../db";

function formRecord(form: FormData): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function jsonError(code: string, status: number, intentId?: string): NextResponse {
  return NextResponse.json(intentId ? { error: code, intentId } : { error: code }, { status });
}

const LOCAL_INTENT_ID = /^int_[A-Za-z0-9_-]{1,128}$/;
const RECOVERABLE_INTENT_STATUSES = new Set(["creating", "open", "unknown"]);

type IntentProbeRow = {
  id: unknown;
  city: unknown;
  window_id: unknown;
  kind: unknown;
  target_bid_cents: unknown;
  quote_base_bid_cents: unknown;
  charge_cents: unknown;
  listing_draft_json: unknown;
  status: unknown;
};

function localIntentId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const candidate = value.trim();
  return LOCAL_INTENT_ID.test(candidate) ? candidate : undefined;
}

function recoverableIntentId(candidate: unknown): string | undefined {
  const id = localIntentId(candidate);
  if (!id) return undefined;
  try {
    const intent = getCheckoutIntent(getDb(), id);
    return intent && RECOVERABLE_INTENT_STATUSES.has(intent.status) ? id : undefined;
  } catch {
    return undefined;
  }
}

function intentIdsBeforeProvider(): Set<string> | undefined {
  try {
    const rows = getDb().sqlite.prepare("SELECT id FROM checkout_intents").all() as Array<{ id?: unknown }>;
    return new Set(rows.flatMap((row) => typeof row.id === "string" ? [row.id] : []));
  } catch {
    return undefined;
  }
}

function draftMatches(raw: unknown, expected: {
  city: string;
  windowId: string;
  venueName: string;
  bookingUrl: string;
  kind?: string | null;
  pitch?: string | null;
}): boolean {
  try {
    const value = JSON.parse(String(raw)) as Record<string, unknown>;
    return value.city === expected.city &&
      value.windowId === expected.windowId &&
      value.venueName === expected.venueName &&
      value.bookingUrl === expected.bookingUrl &&
      (value.kind ?? null) === (expected.kind ?? null) &&
      (value.pitch ?? null) === (expected.pitch ?? null);
  } catch {
    return false;
  }
}

/**
 * Waffo currently reports an ambiguous failure without an intent field. Match
 * only the single durable intent created by this request, never an arbitrary
 * historical row that happens to have the same draft and quote.
 */
function newlyCreatedRecoverableIntent(
  before: Set<string> | undefined,
  listingDraft: {
    city: string;
    windowId: string;
    venueName: string;
    bookingUrl: string;
    kind?: string | null;
    pitch?: string | null;
  } | undefined,
  quote: { kind: string; targetBidUsd: number; chargeUsd: number } | undefined,
): string | undefined {
  if (!before || !listingDraft || !quote) return undefined;
  try {
    const rows = getDb().sqlite.prepare(
      `SELECT id, city, window_id, kind, target_bid_cents, quote_base_bid_cents,
              charge_cents, listing_draft_json, status
         FROM checkout_intents
        WHERE city = ? AND window_id = ? AND kind = ?
          AND target_bid_cents = ? AND charge_cents = ?`,
    ).all(
      listingDraft.city,
      listingDraft.windowId,
      quote.kind,
      quote.targetBidUsd * 100,
      quote.chargeUsd * 100,
    ) as unknown as IntentProbeRow[];
    const expectedQuoteBaseCents = quote.kind === "raise"
      ? (quote.targetBidUsd - quote.chargeUsd) * 100
      : null;
    const matches = rows.filter((row) => {
      const id = typeof row.id === "string" ? row.id : "";
      return id && !before.has(id) &&
        draftMatches(row.listing_draft_json, listingDraft) &&
        (row.quote_base_bid_cents === null || row.quote_base_bid_cents === undefined
          ? expectedQuoteBaseCents === null
          : Number(row.quote_base_bid_cents) === expectedQuoteBaseCents) &&
        RECOVERABLE_INTENT_STATUSES.has(String(row.status));
    });
    return matches.length === 1 ? recoverableIntentId(matches[0]?.id) : undefined;
  } catch {
    return undefined;
  }
}

function intentIdFromError(error: unknown): unknown {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  return record.intentId ?? record.intent_id;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CheckoutError("listing_invalid", 400);
    }
    return parsed as Record<string, unknown>;
  }
  return formRecord(await request.formData());
}

/** Shared handler for the legacy API path and the normative city alias. */
export async function handleCheckout(request: Request, cityOverride?: string): Promise<Response> {
  const origin = new URL(request.url).origin;
  const json = wantsJson(request);
  let body: Record<string, unknown> = {};
  try {
    body = await readBody(request);
    if (cityOverride) body = { ...body, city: cityOverride };
  } catch (error) {
    if (error instanceof CheckoutError) {
      return jsonError(error.code, error.http);
    }
    return jsonError("listing_invalid", 400);
  }

  let recoveryDraft: ReturnType<typeof parseListingDraft> | undefined;
  let recoveryQuote: ReturnType<typeof quoteCheckout> | undefined;
  let intentIdsBefore: Set<string> | undefined;
  try {
    const targetBidUsd = parseAmountUsd(body.amountUsd ?? body.bidUsd);
    const { city, windowId } = resolveCheckoutWindow(body.city);
    const listingDraft = parseListingDraft(body, windowId, city);
    const quote = quoteCheckout(listingDraft, targetBidUsd);
    recoveryDraft = listingDraft;
    recoveryQuote = quote;
    intentIdsBefore = intentIdsBeforeProvider();
    const started = await getPaymentPort().createCheckout({
      listingDraft,
      amountUsd: quote.chargeUsd,
      kind: quote.kind,
      targetBidUsd: quote.targetBidUsd,
      quoteBaseBidUsd: quote.kind === "raise" ? quote.targetBidUsd - quote.chargeUsd : null,
      chargeCents: quote.chargeUsd * 100,
    });
    if (json) {
      return NextResponse.json({
        checkoutUrl: started.checkoutUrl,
        sessionId: started.sessionId,
      });
    }
    const location = started.checkoutUrl.startsWith("http")
      ? started.checkoutUrl
      : `${origin}${started.checkoutUrl}`;
    return NextResponse.redirect(location, 303);
  } catch (error) {
    if (error instanceof CheckoutError) {
      if (json) return jsonError(error.code, error.http);
      const citySlug = typeof body.city === "string" ? body.city.trim() : "";
      const back = new URL(citySlug ? `/${citySlug}` : "/", origin);
      back.searchParams.set("error", error.code);
      return NextResponse.redirect(back, 303);
    }
    const message = error instanceof Error ? error.message : "";
    if (message === "waffo_checkout_rejected") {
      if (json) return jsonError(message, 400);
      const citySlug = typeof body.city === "string" ? body.city.trim() : "";
      const back = new URL(citySlug ? `/${citySlug}` : "/", origin);
      back.searchParams.set("error", message);
      return NextResponse.redirect(back, 303);
    }
    if (message === "waffo_checkout_unknown" || message.startsWith("BLOCKED-CONFIG")) {
      const intentId = message === "waffo_checkout_unknown"
        ? recoverableIntentId(intentIdFromError(error)) ?? newlyCreatedRecoverableIntent(intentIdsBefore, recoveryDraft, recoveryQuote)
        : undefined;
      if (json) return jsonError("waffo_unavailable", 503, intentId);
      const citySlug = typeof body.city === "string" ? body.city.trim() : "";
      const back = new URL(citySlug ? `/${citySlug}` : "/", origin);
      back.searchParams.set("error", intentId ? `waffo_unavailable:${intentId}` : "waffo_unavailable");
      return NextResponse.redirect(back, 303);
    }
    throw error;
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleCheckout(request);
}
