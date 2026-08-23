import { NextResponse } from "next/server";
import {
  CheckoutError,
  getPaymentPort,
  parseAmountUsd,
  parseListingDraft,
  quoteCheckout,
  resolveCheckoutWindow,
} from "../../../billing/port";

export const CHECKOUT_PATH = "/api/checkout" as const;

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

function jsonError(code: string, status: number): NextResponse {
  return NextResponse.json({ error: code }, { status });
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

export async function POST(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const json = wantsJson(request);
  let body: Record<string, unknown>;
  try {
    body = await readBody(request);
  } catch (error) {
    if (error instanceof CheckoutError) {
      return jsonError(error.code, error.http);
    }
    return jsonError("listing_invalid", 400);
  }

  try {
    const targetBidUsd = parseAmountUsd(body.amountUsd ?? body.bidUsd);
    const { city, windowId } = resolveCheckoutWindow(body.city);
    const listingDraft = parseListingDraft(body, windowId, city);
    const quote = quoteCheckout(listingDraft, targetBidUsd);
    const started = await getPaymentPort().createCheckout({
      listingDraft,
      amountUsd: quote.chargeUsd,
      kind: quote.kind,
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
    if (message === "polar_unavailable" || message.startsWith("BLOCKED-SECRET")) {
      if (json) return jsonError("polar_unavailable", 503);
      const citySlug = typeof body.city === "string" ? body.city.trim() : "";
      const back = new URL(citySlug ? `/${citySlug}` : "/", origin);
      back.searchParams.set("error", "polar_unavailable");
      return NextResponse.redirect(back, 303);
    }
    throw error;
  }
}
