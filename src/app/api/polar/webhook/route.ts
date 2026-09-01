import { NextResponse } from "next/server";

/**
 * Polar is retired. Keep the path explicit and inert so an old provider
 * registration cannot settle anything after the Waffo migration.
 */
export function POST(_request: Request): Response {
  return NextResponse.json(
    { error: "polar_webhook_retired", canonical: "/api/waffo/webhook" },
    { status: 410 },
  );
}

export function GET(_request: Request): Response {
  return POST(_request);
}
