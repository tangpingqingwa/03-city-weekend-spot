import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createSign, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { POST as postCheckout } from "../src/app/api/checkout/route";
import { CityBoard } from "../src/app/[city]/board";
import ReturnPage from "../src/app/[city]/return/page";
import { POST as postWebhook } from "../src/app/api/waffo/webhook/route";
import { GET as getPolarWebhook, POST as postPolarWebhook } from "../src/app/api/polar/webhook/route";
import CheckoutCompletePage from "../src/app/checkout/complete/page";
import { FixturePayment } from "../src/billing/fixture";
import { WaffoPayment } from "../src/billing/waffo";
import { WaffoPancake } from "@waffo/pancake-ts";
import {
  CheckoutError,
  applyPaidEvent,
  checkoutNow,
  createPaymentPort,
  getPaymentPort,
  paymentMode,
  parseAmountUsd,
  quoteCheckout,
  resetCheckoutState,
  setCheckoutNow,
} from "../src/billing/port";
import { assertRuntimeReadiness } from "../src/config";
import { MIN_BID_USD, getCity, type City } from "../src/core/cities";
import { ListingError, quoteBid } from "../src/core/listing";
import { getBoardListings, rankListings } from "../src/core/rank";
import { resolveReturn } from "../src/core/return";
import { currentWindow } from "../src/core/window";
import {
  checkoutIntentByProviderCheckout,
  createCheckoutIntent,
  getCheckoutIntent,
  getDb,
  listingsForCityWindow,
  markCheckoutIntentAbandoned,
  openDatabase,
  settlePaidEvent,
  type CheckoutIntentRow,
  type PaidSettlementInput,
} from "../src/db";
import { requireWaffoConfig } from "../src/billing/waffo-session";
import { POST as postCityCheckout } from "../src/app/[city]/checkout/route";
import { assertApplicationReadiness } from "../src/instrumentation";

/** Thursday 2026-08-20 12:00 EDT — open NYC weekend window. */
const OPEN_NYC = new Date("2026-08-20T16:00:00.000Z");
/** Monday 2026-08-24 00:00 EDT — next ISO week, window closed. */
const CLOSED_NYC = new Date("2026-08-24T04:00:00.000Z");

const nycCity = getCity("nyc");
if (!nycCity) {
  throw new Error("nyc catalog row is required");
}
const nyc: City = nycCity;

const waffoHarnessDirectories = new Set<string>();
const waffoHarnessDatabases = new Set<ReturnType<typeof openDatabase>>();

afterEach(() => {
  resetCheckoutState();
  for (const database of waffoHarnessDatabases) database.close();
  waffoHarnessDatabases.clear();
  for (const directory of waffoHarnessDirectories) rmSync(directory, { recursive: true, force: true });
  waffoHarnessDirectories.clear();
});

function windowIdAt(now: Date = checkoutNow()): string {
  return currentWindow(nyc, now).id;
}

function draft(
  overrides: Partial<{
    city: string;
    windowId: string;
    venueName: string;
    bookingUrl: string;
    kind: "restaurant" | "bar" | "show" | null;
    pitch: string | null;
  }> = {},
) {
  return {
    city: "nyc",
    windowId: windowIdAt(),
    venueName: "Sunday Roast",
    bookingUrl: "https://book.example.com/roast",
    kind: "restaurant" as const,
    pitch: null,
    ...overrides,
  };
}

function rankedNyc() {
  const windowId = windowIdAt();
  return rankListings(listingsForCityWindow(getDb(), "nyc", windowId), {
    city: "nyc",
    windowId,
  });
}

async function postJson(payload: Record<string, unknown>): Promise<Response> {
  return postCheckout(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    }),
  );
}

async function postForm(fields: Record<string, string>): Promise<Response> {
  const body = new URLSearchParams(fields);
  return postCheckout(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    }),
  );
}

type WaffoHarness = {
  db: ReturnType<typeof openDatabase>;
  payment: WaffoPayment;
  env: Record<string, string>;
  privateKey: string;
  publicKey: string;
  requests: string[];
};

function waffoHarness(fetchImpl?: typeof fetch, checkoutTimeoutMs?: number, directFetch = false): WaffoHarness {
  const keys = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const directory = mkdtempSync(join(tmpdir(), "city-weekend-waffo-harness-"));
  const databasePath = join(directory, "waffo.sqlite");
  waffoHarnessDirectories.add(directory);
  const env = {
    PAYMENT_MODE: "waffo-test",
    WAFFO_MERCHANT_ID: "MER_1234567890123456789012",
    WAFFO_STORE_ID: "STO_1234567890123456789012",
    WAFFO_PRODUCT_ID: "PROD_1234567890123456789012",
    WAFFO_PRIVATE_KEY: keys.privateKey,
    WAFFO_WEBHOOK_PUBLIC_KEY: keys.publicKey,
    PUBLIC_BASE_URL: "http://localhost:3000",
    DATABASE_PATH: databasePath,
  };
  const requests: string[] = [];
  const fetchFn = fetchImpl ?? (async (_input, init) => {
    requests.push(typeof init?.body === "string" ? init.body : "");
    return new Response(
      JSON.stringify({
        data: {
          sessionId: "CHK_1234567890123456789012",
          checkoutUrl: "https://pancake.waffo.ai/store/test-store/checkout/CHK_1234567890123456789012",
          expiresAt: "2026-08-20T17:00:00.000Z",
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  const db = openDatabase(databasePath);
  waffoHarnessDatabases.add(db);
  const client = new WaffoPancake({
    merchantId: env.WAFFO_MERCHANT_ID,
    privateKey: env.WAFFO_PRIVATE_KEY,
    fetch: fetchFn,
    environment: "test",
  });
  return {
    db,
    env,
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    requests,
    payment: directFetch
      ? new WaffoPayment({ env, db, fetch: fetchFn, webhookPublicKey: keys.publicKey, checkoutTimeoutMs })
      : new WaffoPayment({ env, db, client, webhookPublicKey: keys.publicKey, checkoutTimeoutMs }),
  };
}

function signWaffo(rawBody: string, privateKey: string, timestampMs = Date.now()): string {
  const timestamp = String(timestampMs);
  const signature = createSign("RSA-SHA256").update(`${timestamp}.${rawBody}`).end().sign(privateKey, "base64");
  return `t=${timestamp},v1=${signature}`;
}

function signedWaffoEvent(
  harness: WaffoHarness,
  sessionId: string,
  patch: Record<string, unknown> = {},
): { raw: string; headers: Record<string, string> } {
  const intent = getCheckoutIntent(harness.db, sessionId) ?? checkoutIntentByProviderCheckout(harness.db, sessionId) ?? (() => {
    throw new Error("test intent missing");
  })();
  const metadata = JSON.parse(intent.metadata_json) as Record<string, string>;
  const raw = JSON.stringify({
    id: "DEL_1234567890123456789012",
    timestamp: OPEN_NYC.toISOString(),
    eventType: "order.completed",
    eventId: "PAY_1234567890123456789012",
    storeId: harness.env.WAFFO_STORE_ID,
    storeName: "Test Store",
    mode: "test",
    data: {
      checkoutId: sessionId,
      orderId: "ORD_1234567890123456789012",
      paymentId: "PAY_1234567890123456789012",
      orderMerchantExternalId: intent.id,
      orderMetadata: metadata,
      productId: intent.product_id,
      currency: "USD",
      amount: "5.00",
      subtotal: "5.00",
      total: "5.00",
      taxAmount: "0.00",
      productName: "Weekend poster",
      orderStatus: "completed",
      paymentStatus: "succeeded",
      ...patch,
    },
  });
  return { raw, headers: { "x-waffo-signature": signWaffo(raw, harness.privateKey) } };
}

test("payment mode is explicit and defaults are never inferred from legacy provider flags", () => {
  assert.equal(paymentMode({ PAYMENT_MODE: "fixture", POLAR_LIVE: "1" }), "fixture");
  assert.throws(() => paymentMode({}), /BLOCKED-CONFIG: PAYMENT_MODE/);
  assert.throws(() => paymentMode({ WAFFO_MODE: "fixture" }), /WAFFO_MODE is retired/);
  assert.throws(() => paymentMode({ WAFFO_MODE: "waffo-prod" }), /WAFFO_MODE is retired/);
  assert.equal(createPaymentPort({ PAYMENT_MODE: "fixture" }).kind, "fixture");
  assert.throws(() => createPaymentPort({ PAYMENT_MODE: "waffo-prod" }), /BLOCKED-CONFIG: WAFFO_MERCHANT_ID/);
  assert.throws(() => createPaymentPort({ WAFFO_MODE: "waffo-prod" }), /WAFFO_MODE is retired/);
  assert.throws(
    () => new WaffoPayment({ env: { PAYMENT_MODE: "waffo-prod" }, mode: "waffo-test" }),
    /BLOCKED-CONFIG: PAYMENT_MODE and Waffo mode disagree/,
  );
});

test("application startup readiness fails closed before serving an invalid payment boundary", () => {
  assert.throws(
    () => assertApplicationReadiness({ PAYMENT_MODE: "waffo-prod" }),
    /BLOCKED-CONFIG: WAFFO_MERCHANT_ID/,
  );
  assert.throws(
    () => assertApplicationReadiness({ PAYMENT_MODE: "fixture", NODE_ENV: "production" }),
    /fixture mode is not allowed in production/,
  );
});

function settlementForIntent(
  intent: CheckoutIntentRow,
  suffix: string,
  overrides: Partial<PaidSettlementInput> = {},
): PaidSettlementInput {
  const draftValue = JSON.parse(intent.listing_draft_json) as NonNullable<PaidSettlementInput["listingDraft"]>;
  return {
    sessionId: `session_${suffix}`,
    intentId: intent.id,
    listingDraft: draftValue,
    amountUsd: intent.charge_cents / 100,
    amountCents: intent.charge_cents,
    kind: intent.kind,
    paidAt: OPEN_NYC.toISOString(),
    providerCheckoutId: null,
    providerOrderId: `order_${suffix}`,
    providerPaymentId: `payment_${suffix}`,
    providerEventId: `delivery_${suffix}`,
    businessEventId: `business_${suffix}`,
    eventType: "order.completed",
    currency: intent.currency,
    productId: intent.product_id,
    metadata: JSON.parse(intent.metadata_json) as Record<string, string>,
    intentFingerprint: intent.fingerprint,
    payloadJson: JSON.stringify({ delivery: `delivery_${suffix}` }),
    targetBidUsd: intent.target_bid_cents / 100,
    quoteBaseBidUsd: intent.quote_base_bid_cents === null ? null : intent.quote_base_bid_cents / 100,
    ...overrides,
  };
}

function createDirectFixtureIntent(id: string, draftValue: ReturnType<typeof draft>): CheckoutIntentRow {
  return createCheckoutIntent(getDb(), {
    id,
    mode: "fixture",
    listingDraft: draftValue,
    kind: "create",
    targetBidUsd: 5,
    chargeCents: 500,
    currency: "USD",
    productId: "fixture",
    storeId: "fixture",
    metadata: {
      city: draftValue.city,
      windowId: draftValue.windowId,
      venueName: draftValue.venueName,
      bookingUrl: draftValue.bookingUrl,
      kind: "create",
      targetBidCents: "500",
      chargeCents: "500",
      currency: "USD",
      canonicalUrl: draftValue.bookingUrl,
      productId: "fixture",
      mode: "fixture",
      storeId: "fixture",
      taxCategory: "digital_goods",
    },
    taxCategory: "digital_goods",
    createdAt: OPEN_NYC.toISOString(),
  });
}

test("terminal rejected, abandoned, and reconciliation intents cannot be reopened by later facts", () => {
  setCheckoutNow(OPEN_NYC);
  const db = getDb();
  const rejectedDraft = draft({ venueName: "Rejected Terminal", bookingUrl: "https://book.example.com/rejected-terminal" });
  const rejectedIntent = createDirectFixtureIntent("int_terminal_rejected", rejectedDraft);
  const rejected = settlePaidEvent(db, settlementForIntent(rejectedIntent, "rejected-first", { currency: "EUR" }));
  assert.equal(rejected.status, "rejected");
  assert.equal(getCheckoutIntent(db, rejectedIntent.id)?.status, "rejected");
  const eventCountAfterReject = (db.sqlite.prepare("SELECT COUNT(*) AS count FROM payment_events").get() as { count: number }).count;
  const replay = settlePaidEvent(db, settlementForIntent(rejectedIntent, "rejected-first", { currency: "EUR" }));
  assert.equal(replay.status, "rejected");
  assert.equal((db.sqlite.prepare("SELECT COUNT(*) AS count FROM payment_events").get() as { count: number }).count, eventCountAfterReject);
  const reopenedRejected = settlePaidEvent(db, settlementForIntent(rejectedIntent, "rejected-later"));
  assert.equal(reopenedRejected.status, "rejected");
  assert.equal(reopenedRejected.reason, "intent_rejected_terminal");
  assert.equal(getCheckoutIntent(db, rejectedIntent.id)?.status, "rejected");

  const abandonedDraft = draft({ venueName: "Abandoned Terminal", bookingUrl: "https://book.example.com/abandoned-terminal" });
  const abandonedIntent = createDirectFixtureIntent("int_terminal_abandoned", abandonedDraft);
  markCheckoutIntentAbandoned(db, abandonedIntent.id);
  const reopenedAbandoned = settlePaidEvent(db, settlementForIntent(abandonedIntent, "abandoned-later"));
  assert.equal(reopenedAbandoned.status, "rejected");
  assert.equal(reopenedAbandoned.reason, "intent_abandoned_terminal");
  assert.equal(getCheckoutIntent(db, abandonedIntent.id)?.status, "abandoned");

  const reconciliationDraft = draft({ venueName: "Reconciliation Terminal", bookingUrl: "https://book.example.com/reconciliation-terminal" });
  const seedIntent = createDirectFixtureIntent("int_terminal_seed", reconciliationDraft);
  assert.equal(settlePaidEvent(db, settlementForIntent(seedIntent, "reconciliation-seed")).status, "applied");
  const reconciliationIntent = createDirectFixtureIntent("int_terminal_reconciliation", reconciliationDraft);
  const conflict = settlePaidEvent(db, settlementForIntent(reconciliationIntent, "reconciliation-first"));
  assert.equal(conflict.status, "reconciliation_required");
  assert.equal(getCheckoutIntent(db, reconciliationIntent.id)?.status, "needs_reconciliation");
  const reopenedReconciliation = settlePaidEvent(db, settlementForIntent(reconciliationIntent, "reconciliation-later"));
  assert.equal(reopenedReconciliation.status, "rejected");
  assert.equal(reopenedReconciliation.reason, "intent_needs_reconciliation_terminal");
  assert.equal(getCheckoutIntent(db, reconciliationIntent.id)?.status, "needs_reconciliation");
  assert.equal(listingsForCityWindow(db, "nyc", windowIdAt()).filter((row) => row.venueName === reconciliationDraft.venueName).length, 1);
});

test("fixture mode fails closed under normal production deployment aliases", () => {
  for (const marker of ["VERCEL_ENV", "APP_ENV", "DEPLOY_ENV", "BUILD_ENV"] as const) {
    assert.throws(
      () => assertRuntimeReadiness({ PAYMENT_MODE: "fixture", [marker]: "production" }),
      /fixture mode is not allowed in production/,
    );
  }
  assert.throws(
    () => assertRuntimeReadiness({ PAYMENT_MODE: "fixture", NEXT_PHASE: "phase-production-build" }),
    /fixture mode is not allowed in production/,
  );
});

test("SPEC city checkout alias uses the path city and starts an unpaid fixture intent", async () => {
  setCheckoutNow(OPEN_NYC);
  const response = await postCityCheckout(
    new Request("http://localhost/nyc/checkout", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        venueName: "Alias Room",
        bookingUrl: "https://book.example.com/alias",
        amountUsd: "5",
      }),
    }),
    { params: Promise.resolve({ city: "nyc" }) },
  );
  assert.equal(response.status, 303);
  assert.match(response.headers.get("location") ?? "", /\/nyc\/return\?sessionId=/);
  assert.equal(rankedNyc().length, 0);
});

test("legacy provider compatibility flags cannot select or construct an adapter", () => {
  assert.equal(paymentMode({ PAYMENT_MODE: "fixture", POLAR_FIXTURE_ONLY: "1", POLAR_LIVE: "1" }), "fixture");
  assert.throws(() => createPaymentPort({ POLAR_LIVE: "1", POLAR_ACCESS_TOKEN: "ignored" }), /BLOCKED-CONFIG: PAYMENT_MODE/);
});

test("$5 fixture create lists at #1", async () => {
  setCheckoutNow(OPEN_NYC);
  const port = getPaymentPort();
  assert.equal(port.kind, "fixture");
  const started = await port.createCheckout({
    listingDraft: draft(),
    amountUsd: MIN_BID_USD,
    kind: "create",
  });
  assert.equal(rankedNyc().length, 0);

  const paid = await port.completeCheckout(started.sessionId);
  applyPaidEvent(paid);
  const ranked = rankedNyc();
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.rank, 1);
  assert.equal(ranked[0]?.bidUsd, 5);
  assert.equal(ranked[0]?.venueName, "Sunday Roast");
  assert.equal(ranked[0]?.clicks, 0);
});

test("abandoned checkout does not list", async () => {
  setCheckoutNow(OPEN_NYC);
  const port = new FixturePayment();
  const started = await port.createCheckout({
    listingDraft: draft({
      venueName: "Ghost Bar",
      bookingUrl: "https://book.example.com/ghost",
    }),
    amountUsd: 12,
    kind: "create",
  });
  await port.abandonCheckout(started.sessionId);
  await assert.rejects(port.completeCheckout(started.sessionId), /payment_incomplete/);
  assert.equal(rankedNyc().length, 0);
  assert.equal(port.getCheckout(started.sessionId)?.status, "abandoned");
});

test("open Waffo checkout stays off the poster until a paid event", async () => {
  setCheckoutNow(OPEN_NYC);
  const started = await postForm({
    city: "nyc",
    venue: "Ghost Bar https://book.example.com/ghost",
    amountUsd: "99",
  });
  assert.equal(started.status, 303);
  const location = started.headers.get("location") ?? "";
  assert.match(location, /\/nyc\/return\?sessionId=/);
  assert.equal(rankedNyc().length, 0);

  const pending = await resolveReturn({
    sessionId: new URL(location).searchParams.get("sessionId") ?? undefined,
    status: "abandoned",
  });
  assert.equal(pending.status, "pending");
  assert.equal(rankedNyc().length, 0);
  assert.equal(getBoardListings("nyc", OPEN_NYC).length, 0);
});

test("open fixture session lists only after paid event", async () => {
  setCheckoutNow(OPEN_NYC);
  const port = getPaymentPort();
  const started = await port.createCheckout({
    listingDraft: draft(),
    amountUsd: 5,
    kind: "create",
  });
  assert.equal(rankedNyc().length, 0);
  applyPaidEvent(await port.completeCheckout(started.sessionId));
  assert.equal(rankedNyc()[0]?.rank, 1);
});

test("poster form POST /api/checkout starts Waffo checkout and does not list unpaid", async () => {
  setCheckoutNow(OPEN_NYC);
  const started = await postForm({
    city: "nyc",
    venue: "Sunday Roast https://book.example.com/roast",
    amountUsd: "5",
  });
  assert.equal(started.status, 303);
  const location = started.headers.get("location") ?? "";
  assert.match(location, /\/nyc\/return\?sessionId=/);
  assert.equal(rankedNyc().length, 0);

  const sessionId = new URL(location).searchParams.get("sessionId");
  assert.ok(sessionId);
  const beforePayment = await resolveReturn({ sessionId, status: "paid" });
  assert.equal(beforePayment.status, "pending");
  applyPaidEvent(await getPaymentPort().completeCheckout(sessionId));
  const result = await resolveReturn({ sessionId });
  assert.equal(result.status, "paid");
  const ranked = rankedNyc();
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.rank, 1);
  assert.equal(ranked[0]?.bidUsd, 5);
  assert.equal(ranked[0]?.venueName, "Sunday Roast");
  assert.equal(ranked[0]?.bookingUrl, "https://book.example.com/roast");
});

test("poster form with only a venue name is listing_invalid and stays off the board", async () => {
  setCheckoutNow(OPEN_NYC);
  const missing = await postForm({
    city: "nyc",
    venue: "Sunday Roast",
    amountUsd: "5",
  });
  assert.equal(missing.status, 303);
  const location = missing.headers.get("location") ?? "";
  assert.match(location, /\/nyc\?error=listing_invalid/);
  assert.equal(rankedNyc().length, 0);
});

test("GET /nyc/return markup shows paid or pending and never trusts query alone", async () => {
  setCheckoutNow(OPEN_NYC);
  const pendingReturnHtml = renderToStaticMarkup(
    await ReturnPage({
      params: Promise.resolve({ city: "nyc" }),
      searchParams: Promise.resolve({ status: "paid" }),
    }),
  );
  assert.match(pendingReturnHtml, /data-return="pending"/);
  assert.match(pendingReturnHtml, /not yet paid|abandoned/i);
  assert.doesNotMatch(pendingReturnHtml, /data-return="paid"/);
  assert.equal(rankedNyc().length, 0);

  const started = await getPaymentPort().createCheckout({
    listingDraft: draft(),
    amountUsd: 5,
    kind: "create",
  });
  const pendingHtml = renderToStaticMarkup(
    await ReturnPage({
      params: Promise.resolve({ city: "nyc" }),
      searchParams: Promise.resolve({ sessionId: started.sessionId }),
    }),
  );
  assert.match(pendingHtml, /data-return="pending"/);
  assert.equal(rankedNyc().length, 0);

  // Fixture completion is an explicit test event, not a browser-return side effect.
  applyPaidEvent(await getPaymentPort().completeCheckout(started.sessionId));
  const paidHtml = renderToStaticMarkup(
    await ReturnPage({
      params: Promise.resolve({ city: "nyc" }),
      searchParams: Promise.resolve({ sessionId: started.sessionId }),
    }),
  );
  assert.match(paidHtml, /data-return="paid"/);
  assert.match(paidHtml, /on the poster/i);
  assert.equal(rankedNyc()[0]?.rank, 1);
});

test("GET /london/return stays city_unknown/404", async () => {
  await assert.rejects(
    () =>
      ReturnPage({
        params: Promise.resolve({ city: "london" }),
        searchParams: Promise.resolve({ status: "paid" }),
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "NEXT_HTTP_ERROR_FALLBACK;404",
  );
  assert.equal(rankedNyc().length, 0);
});

test("POST /api/checkout $5 then paid fixture event lists at #1", async () => {
  setCheckoutNow(OPEN_NYC);
  const started = await postJson({
    city: "nyc",
    venueName: "Sunday Roast",
    bookingUrl: "https://book.example.com/roast",
    amountUsd: 5,
    kind: "restaurant",
  });
  assert.equal(started.status, 200);
  const body = (await started.json()) as { checkoutUrl: string; sessionId: string };
  assert.match(body.checkoutUrl, /\/nyc\/return\?sessionId=/);
  assert.ok(body.sessionId);
  assert.equal(rankedNyc().length, 0);

  const paid = await getPaymentPort().completeCheckout(body.sessionId);
  applyPaidEvent(paid);
  const ranked = rankedNyc();
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.rank, 1);
  assert.equal(ranked[0]?.bidUsd, 5);
});

test("bids below $5 and cents are rejected and never charged", async () => {
  setCheckoutNow(OPEN_NYC);
  const below = await postJson({
    city: "nyc",
    venueName: "Cheap",
    bookingUrl: "https://book.example.com/cheap",
    amountUsd: 4,
  });
  assert.equal(below.status, 400);
  assert.deepEqual(await below.json(), { error: "bid_below_min" });

  const cents = await postJson({
    city: "nyc",
    venueName: "Cents",
    bookingUrl: "https://book.example.com/cents",
    amountUsd: "5.50",
  });
  assert.equal(cents.status, 400);
  assert.deepEqual(await cents.json(), { error: "bid_not_whole" });
  assert.equal(rankedNyc().length, 0);

  assert.throws(() => quoteBid(undefined, 4), (err: unknown) => {
    assert.ok(err instanceof ListingError);
    assert.equal(err.code, "bid_below_min");
    return true;
  });
});

test("unknown city is 404 city_unknown; http booking URL is rejected", async () => {
  setCheckoutNow(OPEN_NYC);
  const unknown = await postJson({
    city: "london",
    venueName: "Soho Room",
    bookingUrl: "https://book.example.co.uk/soho",
    amountUsd: 5,
  });
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { error: "city_unknown" });

  const insecure = await postJson({
    city: "nyc",
    venueName: "No Https",
    bookingUrl: "http://book.example.com/x",
    amountUsd: 5,
  });
  assert.equal(insecure.status, 400);
  assert.deepEqual(await insecure.json(), { error: "url_insecure" });
  assert.equal(rankedNyc().length, 0);
});

test("checkout outside the weekly weekend window is window_closed", async () => {
  setCheckoutNow(CLOSED_NYC);
  const closed = await postJson({
    city: "nyc",
    venueName: "Monday Ghost",
    bookingUrl: "https://book.example.com/monday",
    amountUsd: 5,
  });
  assert.equal(closed.status, 400);
  assert.deepEqual(await closed.json(), { error: "window_closed" });
  assert.equal(rankedNyc().length, 0);
});

test("fixture webhook only completes a known session; expired and unknown stay off-board", async () => {
  setCheckoutNow(OPEN_NYC);
  const started = await getPaymentPort().createCheckout({
    listingDraft: draft({ venueName: "Webhook Open", bookingUrl: "https://book.example.com/webhook-open" }),
    amountUsd: 5,
    kind: "create",
  });
  const paidBody = JSON.stringify({ type: "checkout.updated", data: { checkoutId: started.sessionId, status: "succeeded" } });
  const paid = await postWebhook(
    new Request("http://localhost/api/waffo/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: paidBody,
    }),
  );
  assert.equal(paid.status, 200);
  assert.deepEqual(await paid.json(), { received: true, applied: true });
  const ranked = rankedNyc();
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.rank, 1);
  assert.equal(ranked[0]?.bidUsd, 5);
  assert.equal(ranked[0]?.venueName, "Webhook Open");

  const again = await postWebhook(
    new Request("http://localhost/api/waffo/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: paidBody,
    }),
  );
  assert.equal(again.status, 200);
  assert.equal(rankedNyc().length, 1);

  const expired = await postWebhook(
    new Request("http://localhost/api/waffo/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "checkout.updated",
        data: { checkoutId: started.sessionId, status: "expired" },
      }),
    }),
  );
  assert.equal(expired.status, 200);
  assert.deepEqual(await expired.json(), { received: true, applied: false });
  assert.equal(rankedNyc().length, 1);

  const unknown = await postWebhook(
    new Request("http://localhost/api/waffo/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "checkout.updated", data: { checkoutId: "fix_unknown", status: "succeeded" } }),
    }),
  );
  assert.equal(unknown.status, 200);
  assert.deepEqual(await unknown.json(), { received: true, applied: false });
});

test("Waffo anonymous checkout persists intent before network and sends the official shape", async () => {
  setCheckoutNow(OPEN_NYC);
  const harness = waffoHarness();
  try {
    const started = await harness.payment.createCheckout({
      listingDraft: draft({ venueName: "Pancake Room", bookingUrl: "https://book.example.com/pancake" }),
      amountUsd: 5,
      kind: "create",
      targetBidUsd: 5,
      chargeCents: 500,
    });
    assert.equal(harness.requests.length, 1);
    const body = JSON.parse(harness.requests[0]!) as Record<string, unknown>;
    assert.equal(body.productId, harness.env.WAFFO_PRODUCT_ID);
    assert.equal(body.currency, "USD");
    assert.deepEqual(body.priceSnapshot, { amount: "5.00", taxCategory: "digital_goods" });
    assert.match(String(body.successUrl), new RegExp(`/checkout/complete\\?intent=${started.intentId}`));
    assert.equal(body.orderMerchantExternalId, started.intentId);
    const metadata = body.metadata as Record<string, unknown>;
    for (const value of Object.values(metadata)) assert.equal(typeof value, "string");
    assert.equal(metadata.intentId, started.intentId);
    assert.equal(metadata.productId, harness.env.WAFFO_PRODUCT_ID);
    const intent = getCheckoutIntent(harness.db, started.intentId!);
    assert.equal(intent?.status, "open");
    assert.equal(intent?.charge_cents, 500);
    assert.equal(intent?.provider_checkout_id, started.sessionId);
    assert.equal(getBoardListings("nyc", OPEN_NYC, harness.db).length, 0);
  } finally {
    harness.db.close();
  }
});

test("Waffo classifies definitive API rejection and malformed checkout responses without listing", async () => {
  setCheckoutNow(OPEN_NYC);
  const rejectedHarness = waffoHarness(async () =>
    new Response(JSON.stringify({ data: null, errors: [{ message: "product unavailable", layer: "order" }] }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }),
  );
  try {
    await assert.rejects(
      rejectedHarness.payment.createCheckout({
        listingDraft: draft({ venueName: "Rejected Room", bookingUrl: "https://book.example.com/rejected" }),
        amountUsd: 5,
        kind: "create",
        targetBidUsd: 5,
        chargeCents: 500,
      }),
      /waffo_checkout_rejected/,
    );
    const rejected = rejectedHarness.db.sqlite.prepare("SELECT status, reason FROM checkout_intents LIMIT 1").get() as { status: string; reason: string };
    assert.equal(rejected.status, "rejected");
    assert.match(rejected.reason, /provider_checkout_rejected/);
    assert.equal(getBoardListings("nyc", OPEN_NYC, rejectedHarness.db).length, 0);
  } finally {
    rejectedHarness.db.close();
  }

  const malformedResponseHarness = waffoHarness(async () =>
    new Response("upstream unavailable", {
      status: 400,
      headers: { "content-type": "text/plain" },
    }),
  );
  try {
    await assert.rejects(
      malformedResponseHarness.payment.createCheckout({
        listingDraft: draft({ venueName: "Malformed Response", bookingUrl: "https://book.example.com/malformed-response" }),
        amountUsd: 5,
        kind: "create",
        targetBidUsd: 5,
        chargeCents: 500,
      }),
      /waffo_checkout_unknown/,
    );
    const malformedResponse = malformedResponseHarness.db.sqlite.prepare("SELECT status FROM checkout_intents LIMIT 1").get() as { status: string };
    assert.equal(malformedResponse.status, "unknown");
  } finally {
    malformedResponseHarness.db.close();
  }

  const malformedHarness = waffoHarness(async () =>
    new Response(JSON.stringify({ data: { sessionId: "", checkoutUrl: "not-a-url", expiresAt: "not-a-date" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  try {
    await assert.rejects(
      malformedHarness.payment.createCheckout({
        listingDraft: draft({ venueName: "Malformed Checkout", bookingUrl: "https://book.example.com/malformed-checkout" }),
        amountUsd: 5,
        kind: "create",
        targetBidUsd: 5,
        chargeCents: 500,
      }),
      /waffo_checkout_unknown/,
    );
    const unknown = malformedHarness.db.sqlite.prepare("SELECT status, reason FROM checkout_intents LIMIT 1").get() as { status: string; reason: string };
    assert.equal(unknown.status, "unknown");
    assert.match(unknown.reason, /provider_checkout_unknown/);
    assert.equal(getBoardListings("nyc", OPEN_NYC, malformedHarness.db).length, 0);
  } finally {
    malformedHarness.db.close();
  }
});

test("Waffo transient provider statuses remain recoverable unknown intents", async () => {
  setCheckoutNow(OPEN_NYC);
  for (const status of [408, 409, 429, 500]) {
    const harness = waffoHarness(async () =>
      new Response(JSON.stringify({ errors: [{ message: "try again", layer: "gateway" }] }), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
    try {
      await assert.rejects(
        harness.payment.createCheckout({
          listingDraft: draft({ venueName: `Transient ${status}`, bookingUrl: `https://book.example.com/transient-${status}` }),
          amountUsd: 5,
          kind: "create",
          targetBidUsd: 5,
          chargeCents: 500,
        }),
        /waffo_checkout_unknown/,
      );
      assert.equal((harness.db.sqlite.prepare("SELECT status FROM checkout_intents").get() as { status: string }).status, "unknown");
    } finally {
      harness.db.close();
    }
  }
});

test("signed Waffo order.completed settles once and exact replay is a no-op", async () => {
  setCheckoutNow(OPEN_NYC);
  const harness = waffoHarness();
  try {
    const started = await harness.payment.createCheckout({
      listingDraft: draft({ venueName: "Signed Room", bookingUrl: "https://book.example.com/signed" }),
      amountUsd: 5,
      kind: "create",
      targetBidUsd: 5,
      chargeCents: 500,
    });
    const webhook = signedWaffoEvent(harness, started.sessionId);
    const event = await harness.payment.handleWebhook(webhook.raw, webhook.headers);
    assert.ok(!("ignored" in event));
    const listed = applyPaidEvent(event, harness.db);
    assert.equal(listed.bidUsd, 5);
    assert.equal(getBoardListings("nyc", OPEN_NYC, harness.db).length, 1);
    const replay = await harness.payment.handleWebhook(webhook.raw, webhook.headers);
    assert.ok(!("ignored" in replay));
    const replayed = applyPaidEvent(replay, harness.db);
    assert.equal(replayed.id, listed.id);
    assert.equal((harness.db.sqlite.prepare("SELECT COUNT(*) AS count FROM payment_events").get() as { count: number }).count, 1);
    assert.equal((harness.db.sqlite.prepare("SELECT COUNT(*) AS count FROM payments").get() as { count: number }).count, 1);
  } finally {
    harness.db.close();
  }
});

test("Waffo provider identity reuse with changed facts is rejected and audited", async () => {
  setCheckoutNow(OPEN_NYC);
  const harness = waffoHarness();
  try {
    const started = await harness.payment.createCheckout({
      listingDraft: draft({ venueName: "Identity Room", bookingUrl: "https://book.example.com/identity" }),
      amountUsd: 5,
      kind: "create",
      targetBidUsd: 5,
      chargeCents: 500,
    });
    const first = signedWaffoEvent(harness, started.sessionId);
    const firstEvent = await harness.payment.handleWebhook(first.raw, first.headers);
    assert.ok(!("ignored" in firstEvent));
    applyPaidEvent(firstEvent, harness.db);

    const changedPayload = JSON.parse(first.raw) as { id: string; eventId: string; data: Record<string, unknown> };
    changedPayload.id = "DEL_9999999999999999999999";
    changedPayload.eventId = "PAY_9999999999999999999999";
    changedPayload.data.paymentId = "PAY_9999999999999999999999";
    changedPayload.data.orderId = "ORD_9999999999999999999999";
    changedPayload.data.amount = "6.00";
    changedPayload.data.subtotal = "6.00";
    changedPayload.data.total = "6.00";
    const raw = JSON.stringify(changedPayload);
    const changed = await harness.payment.handleWebhook(raw, {
      "x-waffo-signature": signWaffo(raw, harness.privateKey),
    });
    assert.ok(!("ignored" in changed));
    assert.throws(() => applyPaidEvent(changed, harness.db), /provider_identity_reuse/);
    assert.equal(harness.db.listings.size, 1);
    assert.equal(harness.db.payments.size, 1);
    assert.equal((harness.db.sqlite.prepare("SELECT COUNT(*) AS count FROM payment_event_conflicts WHERE identity_kind = 'provider_payment'").get() as { count: number }).count, 1);
  } finally {
    harness.db.close();
  }
});

test("official Waffo order.completed shape can correlate without a checkout field", async () => {
  setCheckoutNow(OPEN_NYC);
  const harness = waffoHarness();
  try {
    const started = await harness.payment.createCheckout({
      listingDraft: draft({ venueName: "Official Shape", bookingUrl: "https://book.example.com/official" }),
      amountUsd: 5,
      kind: "create",
      targetBidUsd: 5,
      chargeCents: 500,
    });
    const signed = signedWaffoEvent(harness, started.sessionId);
    const payload = JSON.parse(signed.raw) as { data: Record<string, unknown> };
    delete payload.data.checkoutId;
    const raw = JSON.stringify(payload);
    const event = await harness.payment.handleWebhook(raw, { "x-waffo-signature": signWaffo(raw, harness.privateKey) });
    assert.ok(!("ignored" in event));
    assert.equal(applyPaidEvent(event, harness.db).bidUsd, 5);
    assert.equal(getBoardListings("nyc", OPEN_NYC, harness.db).length, 1);
  } finally {
    harness.db.close();
  }
});

test("invalid Waffo signature and wrong event facts never rank", async () => {
  setCheckoutNow(OPEN_NYC);
  const harness = waffoHarness();
  try {
    const started = await harness.payment.createCheckout({
      listingDraft: draft({ venueName: "Guarded Room", bookingUrl: "https://book.example.com/guarded" }),
      amountUsd: 5,
      kind: "create",
      targetBidUsd: 5,
      chargeCents: 500,
    });
    const valid = signedWaffoEvent(harness, started.sessionId);
    await assert.rejects(harness.payment.handleWebhook(valid.raw, { "x-waffo-signature": "t=1,v1=bad" }), /signature/);
    await assert.rejects(
      harness.payment.handleWebhook(valid.raw, {
        "x-waffo-signature": signWaffo(valid.raw, harness.privateKey, Date.now() - 60 * 60 * 1000),
      }),
      /signature/,
    );
    const wrong = signedWaffoEvent(harness, started.sessionId, { currency: "EUR" });
    const result = await harness.payment.handleWebhook(wrong.raw, wrong.headers);
    assert.ok(!("ignored" in result));
    assert.throws(() => applyPaidEvent(result, harness.db), /immutable_fact_mismatch/);
    assert.equal(getBoardListings("nyc", OPEN_NYC, harness.db).length, 0);
    assert.equal(getCheckoutIntent(harness.db, started.intentId!)?.status, "rejected");

  } finally {
    harness.db.close();
  }

  const metadataHarness = waffoHarness();
  try {
    const started = await metadataHarness.payment.createCheckout({
      listingDraft: draft({ venueName: "Metadata Room", bookingUrl: "https://book.example.com/metadata" }),
      amountUsd: 5,
      kind: "create",
      targetBidUsd: 5,
      chargeCents: 500,
    });
    const nonStringMetadata = JSON.parse(signedWaffoEvent(metadataHarness, started.sessionId).raw) as { data: { orderMetadata: Record<string, unknown> } };
    nonStringMetadata.data.orderMetadata.targetBidCents = 500;
    const nonStringRaw = JSON.stringify(nonStringMetadata);
    const nonStringResult = await metadataHarness.payment.handleWebhook(nonStringRaw, {
      "x-waffo-signature": signWaffo(nonStringRaw, metadataHarness.privateKey),
    });
    assert.ok(!("ignored" in nonStringResult));
    assert.throws(() => applyPaidEvent(nonStringResult, metadataHarness.db), /immutable_fact_mismatch/);
    assert.equal(getBoardListings("nyc", OPEN_NYC, metadataHarness.db).length, 0);
  } finally {
    metadataHarness.db.close();
  }
});

test("Waffo binds the business payment ID and enforces exact tax-exclusive money", async () => {
  setCheckoutNow(OPEN_NYC);
  const harness = waffoHarness();
  try {
    const started = await harness.payment.createCheckout({
      listingDraft: draft({ venueName: "Tax Room", bookingUrl: "https://book.example.com/tax" }),
      amountUsd: 5,
      kind: "create",
      targetBidUsd: 5,
      chargeCents: 500,
    });
    const validWithTax = signedWaffoEvent(harness, started.sessionId, {
      amount: "6.00",
      taxAmount: "1.00",
      total: "6.00",
    });
    const taxEvent = await harness.payment.handleWebhook(validWithTax.raw, validWithTax.headers);
    assert.ok(!("ignored" in taxEvent));
    assert.equal(applyPaidEvent(taxEvent, harness.db).bidUsd, 5);
  } finally {
    harness.db.close();
  }

  const mismatchHarness = waffoHarness();
  try {
    const started = await mismatchHarness.payment.createCheckout({
      listingDraft: draft({ venueName: "Mismatch Room", bookingUrl: "https://book.example.com/mismatch" }),
      amountUsd: 5,
      kind: "create",
      targetBidUsd: 5,
      chargeCents: 500,
    });
    const signed = signedWaffoEvent(mismatchHarness, started.sessionId);
    const payload = JSON.parse(signed.raw) as { eventId: string };
    payload.eventId = "PAY_9999999999999999999999";
    const raw = JSON.stringify(payload);
    const event = await mismatchHarness.payment.handleWebhook(raw, { "x-waffo-signature": signWaffo(raw, mismatchHarness.privateKey) });
    assert.ok(!("ignored" in event));
    assert.throws(() => applyPaidEvent(event, mismatchHarness.db), /immutable_fact_mismatch/);
    assert.equal(mismatchHarness.db.listings.size, 0);
  } finally {
    mismatchHarness.db.close();
  }

  const malformedHarness = waffoHarness();
  try {
    const started = await malformedHarness.payment.createCheckout({
      listingDraft: draft({ venueName: "Malformed Money", bookingUrl: "https://book.example.com/malformed" }),
      amountUsd: 5,
      kind: "create",
      targetBidUsd: 5,
      chargeCents: 500,
    });
    const signed = signedWaffoEvent(malformedHarness, started.sessionId, { total: "not-money" });
    const event = await malformedHarness.payment.handleWebhook(signed.raw, signed.headers);
    assert.ok(!("ignored" in event));
    assert.throws(() => applyPaidEvent(event, malformedHarness.db), /immutable_fact_mismatch/);
    assert.equal(malformedHarness.db.listings.size, 0);
  } finally {
    malformedHarness.db.close();
  }
});

test("signed Waffo unknown intent is durably rejected without inventing a listing", async () => {
  setCheckoutNow(OPEN_NYC);
  const harness = waffoHarness();
  try {
    const started = await harness.payment.createCheckout({
      listingDraft: draft({ venueName: "Unknown Intent", bookingUrl: "https://book.example.com/unknown-intent" }),
      amountUsd: 5,
      kind: "create",
      targetBidUsd: 5,
      chargeCents: 500,
    });
    const signed = signedWaffoEvent(harness, started.sessionId);
    const payload = JSON.parse(signed.raw) as { data: Record<string, unknown> };
    delete payload.data.checkoutId;
    payload.data.orderMerchantExternalId = "int_9999999999999999999999";
    payload.data.orderMetadata = { intentId: "int_9999999999999999999999", intentFingerprint: "not-local" };
    const raw = JSON.stringify(payload);
    const event = await harness.payment.handleWebhook(raw, { "x-waffo-signature": signWaffo(raw, harness.privateKey) });
    assert.ok(!("ignored" in event));
    assert.throws(() => applyPaidEvent(event, harness.db), /unknown_intent/);
    const row = harness.db.sqlite.prepare("SELECT outcome, reason, intent_id FROM payment_events LIMIT 1").get() as { outcome: string; reason: string; intent_id: string | null };
    assert.deepEqual(row, { outcome: "rejected", reason: "unknown_intent", intent_id: null });
    assert.equal(harness.db.payments.size, 0);
    assert.equal(getBoardListings("nyc", OPEN_NYC, harness.db).length, 0);
  } finally {
    harness.db.close();
  }
});

test("Waffo settlement rolls back the event, payment, intent, and listing together", async () => {
  setCheckoutNow(OPEN_NYC);
  const harness = waffoHarness();
  try {
    const started = await harness.payment.createCheckout({
      listingDraft: draft({ venueName: "Rollback Room", bookingUrl: "https://book.example.com/rollback" }),
      amountUsd: 5,
      kind: "create",
      targetBidUsd: 5,
      chargeCents: 500,
    });
    harness.db.sqlite.exec("CREATE TRIGGER fail_listing_insert BEFORE INSERT ON listings BEGIN SELECT RAISE(ABORT, 'injected listing failure'); END");
    const signed = signedWaffoEvent(harness, started.sessionId);
    const event = await harness.payment.handleWebhook(signed.raw, signed.headers);
    assert.ok(!("ignored" in event));
    await assert.rejects(async () => applyPaidEvent(event, harness.db), /injected listing failure/);
    assert.equal((harness.db.sqlite.prepare("SELECT COUNT(*) AS count FROM listings").get() as { count: number }).count, 0);
    assert.equal((harness.db.sqlite.prepare("SELECT COUNT(*) AS count FROM payments").get() as { count: number }).count, 0);
    assert.equal((harness.db.sqlite.prepare("SELECT COUNT(*) AS count FROM payment_events").get() as { count: number }).count, 0);
    assert.equal(getCheckoutIntent(harness.db, started.intentId!)?.status, "open");
  } finally {
    harness.db.close();
  }
});

test("Waffo timeout leaves an unknown recoverable intent and makes no listing", async () => {
  setCheckoutNow(OPEN_NYC);
  const harness = waffoHarness(async () => {
    throw new Error("network timeout");
  });
  try {
    await assert.rejects(
      harness.payment.createCheckout({
        listingDraft: draft({ venueName: "Timeout Room", bookingUrl: "https://book.example.com/timeout" }),
        amountUsd: 5,
        kind: "create",
        targetBidUsd: 5,
        chargeCents: 500,
      }),
      /waffo_checkout_unknown/,
    );
    const row = harness.db.sqlite.prepare("SELECT status, reason FROM checkout_intents LIMIT 1").get() as { status: string; reason: string };
    assert.equal(row.status, "unknown");
    assert.match(row.reason, /provider_checkout_unknown/);
    assert.equal(getBoardListings("nyc", OPEN_NYC, harness.db).length, 0);
  } finally {
    harness.db.close();
  }
});

test("ambiguous checkout response returns only its durable intent for read-only recovery", async () => {
  setCheckoutNow(OPEN_NYC);
  const keys = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const directory = mkdtempSync(join(tmpdir(), "city-weekend-route-recovery-"));
  const databasePath = join(directory, "route-recovery.sqlite");
  waffoHarnessDirectories.add(directory);
  const envKeys = [
    "PAYMENT_MODE",
    "WAFFO_MODE",
    "WAFFO_MERCHANT_ID",
    "WAFFO_STORE_ID",
    "WAFFO_PRODUCT_ID",
    "WAFFO_PRIVATE_KEY",
    "WAFFO_WEBHOOK_PUBLIC_KEY",
    "WAFFO_WEBHOOK_TEST_PUBLIC_KEY",
    "WAFFO_WEBHOOK_PROD_PUBLIC_KEY",
    "PUBLIC_BASE_URL",
    "WAFFO_PUBLIC_BASE_URL",
    "DATABASE_PATH",
  ] as const;
  const previous = new Map(envKeys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    PAYMENT_MODE: "waffo-test",
    WAFFO_MERCHANT_ID: "MER_1234567890123456789012",
    WAFFO_STORE_ID: "STO_1234567890123456789012",
    WAFFO_PRODUCT_ID: "PROD_1234567890123456789012",
    WAFFO_PRIVATE_KEY: keys.privateKey,
    WAFFO_WEBHOOK_TEST_PUBLIC_KEY: keys.publicKey,
    PUBLIC_BASE_URL: "http://localhost:3000",
    DATABASE_PATH: databasePath,
  });
  globalThis.fetch = (async () => {
    throw new Error("offline provider");
  }) as typeof fetch;
  try {
    resetCheckoutState();
    setCheckoutNow(OPEN_NYC);
    const response = await postJson({
      city: "nyc",
      venueName: "Route Recovery Room",
      bookingUrl: "https://book.example.com/route-recovery",
      amountUsd: 5,
    });
    assert.equal(response.status, 503);
    const body = (await response.json()) as { error: string; intentId?: string };
    assert.deepEqual(Object.keys(body).sort(), ["error", "intentId"]);
    assert.equal(body.error, "waffo_unavailable");
    assert.match(body.intentId ?? "", /^int_[A-Za-z0-9-]{36}$/);
    assert.equal(getCheckoutIntent(getDb(), body.intentId!)?.status, "unknown");

    const html = renderToStaticMarkup(
      createElement(CityBoard, {
        city: nyc,
        listings: [],
        now: OPEN_NYC,
        checkoutError: `waffo_unavailable:${body.intentId}`,
      }),
    );
    assert.match(html, /Checkout is unavailable or still awaiting confirmation/);
    assert.match(html, /No rank is claimed until payment is confirmed/);
    assert.match(html, new RegExp(`/checkout/complete\\?intent=${body.intentId}`));
    assert.match(html, /data-checkout-recovery=""/);
  } finally {
    resetCheckoutState();
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Waffo lost checkout response recovers a signed event by intent metadata", async () => {
  setCheckoutNow(OPEN_NYC);
  const harness = waffoHarness(async () => {
    throw new Error("accepted then timed out");
  });
  try {
    let started: { intentId?: string };
    await assert.rejects(
      harness.payment.createCheckout({
        listingDraft: draft({ venueName: "Recovered Room", bookingUrl: "https://book.example.com/recovered" }),
        amountUsd: 5,
        kind: "create",
        targetBidUsd: 5,
        chargeCents: 500,
      }),
      /waffo_checkout_unknown/,
    );
    const intent = Array.from(harness.db.sqlite.prepare("SELECT id FROM checkout_intents").iterate()) as Array<{ id: string }>;
    started = { intentId: intent[0]?.id };
    assert.ok(started.intentId);
    assert.equal(getCheckoutIntent(harness.db, started.intentId)?.status, "unknown");

    const signed = signedWaffoEvent(harness, started.intentId);
    const payload = JSON.parse(signed.raw) as { data: Record<string, unknown> };
    delete payload.data.checkoutId;
    const raw = JSON.stringify(payload);
    const event = await harness.payment.handleWebhook(raw, { "x-waffo-signature": signWaffo(raw, harness.privateKey) });
    assert.ok(!("ignored" in event));
    const listed = applyPaidEvent(event, harness.db);
    assert.equal(listed.venueName, "Recovered Room");
    assert.equal(getCheckoutIntent(harness.db, started.intentId)?.status, "paid");
    assert.equal((harness.db.sqlite.prepare("SELECT provider_checkout_id FROM payment_events").get() as { provider_checkout_id: string | null }).provider_checkout_id, null);
    assert.equal(Array.from(harness.db.payments.values())[0]?.provider_checkout_id, null);

    const replay = await harness.payment.handleWebhook(raw, { "x-waffo-signature": signWaffo(raw, harness.privateKey) });
    assert.ok(!("ignored" in replay));
    assert.equal(applyPaidEvent(replay, harness.db).id, listed.id);
    assert.equal((harness.db.sqlite.prepare("SELECT COUNT(*) AS count FROM listings").get() as { count: number }).count, 1);
  } finally {
    harness.db.close();
  }
});

test("Waffo timeout recovery persists a newly observed checkout identity", async () => {
  setCheckoutNow(OPEN_NYC);
  const harness = waffoHarness(async () => {
    throw new Error("accepted then timed out");
  });
  try {
    await assert.rejects(
      harness.payment.createCheckout({
        listingDraft: draft({ venueName: "Recovered Checkout", bookingUrl: "https://book.example.com/recovered-checkout" }),
        amountUsd: 5,
        kind: "create",
        targetBidUsd: 5,
        chargeCents: 500,
      }),
      /waffo_checkout_unknown/,
    );
    const intent = Array.from(harness.db.sqlite.prepare("SELECT id FROM checkout_intents").iterate()) as Array<{ id: string }>;
    const intentId = intent[0]?.id;
    assert.ok(intentId);
    const signed = signedWaffoEvent(harness, intentId, { checkoutId: "CHK_RECOVERED_1234567890123456789012" });
    const event = await harness.payment.handleWebhook(signed.raw, signed.headers);
    assert.ok(!("ignored" in event));
    assert.equal(applyPaidEvent(event, harness.db).venueName, "Recovered Checkout");
    assert.equal(getCheckoutIntent(harness.db, intentId)?.provider_checkout_id, "CHK_RECOVERED_1234567890123456789012");
  } finally {
    harness.db.close();
  }
});

test("SQLite restart preserves an omitted Waffo checkout ID as null", () => {
  const directory = mkdtempSync(join(tmpdir(), "city-weekend-waffo-restart-"));
  const path = join(directory, "board.sqlite");
  let first: ReturnType<typeof openDatabase> | undefined;
  let restarted: ReturnType<typeof openDatabase> | undefined;
  try {
    first = openDatabase(path);
    first.payments.set("pay_lost_checkout", {
      id: "pay_lost_checkout",
      listing_id: null,
      polar_session: "intent_lost_checkout",
      provider_checkout_id: null,
      provider_order_id: "ORD_lost_checkout",
      provider_payment_id: "PAY_lost_checkout",
      intent_id: null,
      amount_usd: 5,
      amount_cents: 500,
      kind: "create",
      currency: "USD",
      product_id: "PROD_test",
      status: "reconciliation_required",
    });
    assert.equal(first.payments.get("pay_lost_checkout")?.provider_checkout_id, null);
    first.close();
    first = undefined;

    restarted = openDatabase(path);
    assert.equal(restarted.payments.get("pay_lost_checkout")?.provider_checkout_id, null);
    assert.equal(restarted.payments.get("pay_lost_checkout")?.polar_session, "intent_lost_checkout");
  } finally {
    first?.close();
    restarted?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("quoteBid charges the full first bid and only the raise difference", () => {
  assert.deepEqual(quoteBid(undefined, 5), {
    kind: "create",
    targetBidUsd: 5,
    chargeUsd: 5,
  });
  assert.deepEqual(quoteBid({ bidUsd: 5 }, 12), {
    kind: "raise",
    targetBidUsd: 12,
    chargeUsd: 7,
  });
  assert.throws(() => quoteBid({ bidUsd: 5 }, 5), (err: unknown) => {
    assert.ok(err instanceof ListingError);
    assert.equal(err.code, "bid_not_higher");
    return true;
  });
  assert.throws(() => quoteBid({ bidUsd: 12 }, 7), (err: unknown) => {
    assert.ok(err instanceof ListingError);
    assert.equal(err.code, "bid_not_higher");
    return true;
  });
});

test("SPEC acceptance 5: #2 raises $5 → $12 pays $7; firstPaidAt unchanged", async () => {
  setCheckoutNow(OPEN_NYC);
  const port = getPaymentPort();
  const firstPaidAt = "2026-08-20T16:00:00.000Z";
  const incumbent = applyPaidEvent({
    sessionId: "chk_incumbent_12",
    listingDraft: draft({
      venueName: "Twelve Dollar",
      bookingUrl: "https://book.example.com/twelve",
    }),
    amountUsd: 12,
    kind: "create",
    paidAt: "2026-08-20T17:00:00.000Z",
  });
  const opener = applyPaidEvent({
    sessionId: "chk_opener_5",
    listingDraft: draft({
      venueName: "Sunday Roast",
      bookingUrl: "https://book.example.com/roast",
    }),
    amountUsd: 5,
    kind: "create",
    paidAt: firstPaidAt,
  });
  const before = rankedNyc();
  assert.equal(before[0]?.id, incumbent.id);
  assert.equal(before[1]?.id, opener.id);
  assert.equal(before[1]?.bidUsd, 5);

  const raiseJson = await postJson({
    city: "nyc",
    venueName: "Sunday Roast",
    bookingUrl: "https://book.example.com/roast",
    amountUsd: 12,
    kind: "restaurant",
  });
  assert.equal(raiseJson.status, 200);
  const raiseBody = (await raiseJson.json()) as {
    checkoutUrl: string;
    sessionId: string;
  };
  const raiseSession = port.getCheckout(raiseBody.sessionId);
  assert.equal(raiseSession?.kind, "raise");
  assert.equal(raiseSession?.amountUsd, 7);
  assert.equal(rankedNyc().length, 2);
  assert.equal(rankedNyc().find((row) => row.id === opener.id)?.bidUsd, 5);

  const paid = await port.completeCheckout(raiseBody.sessionId);
  assert.equal(paid.kind, "raise");
  assert.equal(paid.amountUsd, 7);
  const raised = applyPaidEvent(paid);
  assert.equal(raised.id, opener.id);
  assert.equal(raised.bidUsd, 12);
  assert.equal(raised.firstPaidAt, firstPaidAt);
  assert.equal(raised.lastPaidAt, OPEN_NYC.toISOString());

  const ranked = rankedNyc();
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0]?.id, opener.id);
  assert.equal(ranked[0]?.rank, 1);
  assert.equal(ranked[0]?.bidUsd, 12);
  assert.equal(ranked[0]?.firstPaidAt, firstPaidAt);
  assert.equal(ranked[1]?.id, incumbent.id);
  assert.equal(ranked[1]?.bidUsd, 12);
});

test("different listing pays the full amount and cannot steal a raise difference", async () => {
  setCheckoutNow(OPEN_NYC);
  applyPaidEvent({
    sessionId: "chk_cover_12",
    listingDraft: draft({
      venueName: "Cover Bar",
      bookingUrl: "https://book.example.com/cover",
    }),
    amountUsd: 12,
    kind: "create",
    paidAt: "2026-08-20T16:00:00.000Z",
  });

  const steal = await postJson({
    city: "nyc",
    venueName: "Rival Room",
    bookingUrl: "https://book.example.com/rival",
    amountUsd: 7,
  });
  assert.equal(steal.status, 200);
  const stealBody = (await steal.json()) as { sessionId: string };
  const stealSession = getPaymentPort().getCheckout(stealBody.sessionId);
  assert.equal(stealSession?.kind, "create");
  assert.equal(stealSession?.amountUsd, 7);

  const paid = await getPaymentPort().completeCheckout(stealBody.sessionId);
  applyPaidEvent(paid);

  const ranked = rankedNyc();
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0]?.venueName, "Cover Bar");
  assert.equal(ranked[0]?.bidUsd, 12);
  assert.equal(ranked[0]?.rank, 1);
  assert.equal(ranked[1]?.venueName, "Rival Room");
  assert.equal(ranked[1]?.bidUsd, 7);
  assert.equal(ranked[1]?.rank, 2);
});

test("bid_not_higher when raise is not above the current bid", async () => {
  setCheckoutNow(OPEN_NYC);
  applyPaidEvent({
    sessionId: "chk_stay_8",
    listingDraft: draft({
      venueName: "Stay Spot",
      bookingUrl: "https://book.example.com/stay",
    }),
    amountUsd: 8,
    kind: "create",
    paidAt: "2026-08-20T16:00:00.000Z",
  });

  const same = await postJson({
    city: "nyc",
    venueName: "Stay Spot",
    bookingUrl: "https://book.example.com/stay",
    amountUsd: 8,
  });
  assert.equal(same.status, 400);
  assert.deepEqual(await same.json(), { error: "bid_not_higher" });

  const lower = await postJson({
    city: "nyc",
    venueName: "Stay Spot",
    bookingUrl: "https://book.example.com/stay",
    amountUsd: 5,
  });
  assert.equal(lower.status, 400);
  assert.deepEqual(await lower.json(), { error: "bid_not_higher" });

  const ranked = rankedNyc();
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.bidUsd, 8);
  assert.equal(getPaymentPort().getCheckout("unused"), undefined);
});

test("same venue next weekend window is a new full-bid listing", () => {
  setCheckoutNow(OPEN_NYC);
  applyPaidEvent({
    sessionId: "chk_last_week",
    listingDraft: draft({
      windowId: "nyc:2026-W33",
      venueName: "Sunday Roast",
      bookingUrl: "https://book.example.com/roast",
    }),
    amountUsd: 20,
    kind: "create",
    paidAt: "2026-08-13T16:00:00.000Z",
  });
  const quote = quoteCheckout(draft(), 5);
  assert.equal(quote.kind, "create");
  assert.equal(quote.chargeUsd, 5);
  const next = applyPaidEvent({
    sessionId: "chk_this_week",
    listingDraft: draft(),
    amountUsd: 5,
    kind: "create",
    paidAt: "2026-08-20T16:00:00.000Z",
  });
  assert.equal(next.bidUsd, 5);
  assert.equal(next.windowId, windowIdAt());
  assert.equal(rankedNyc().length, 1);
  assert.equal(rankedNyc()[0]?.id, next.id);
});

test("SQLite stores make paid sessions and raises durable across independent stores", () => {
  setCheckoutNow(OPEN_NYC);
  const directory = mkdtempSync(join(tmpdir(), "city-weekend-checkout-"));
  const path = join(directory, "board.sqlite");
  let left: ReturnType<typeof openDatabase> | undefined;
  let right: ReturnType<typeof openDatabase> | undefined;
  let restarted: ReturnType<typeof openDatabase> | undefined;
  try {
    left = openDatabase(path);
    right = openDatabase(path);
    const listingDraft = draft({
      venueName: "Durable Room",
      bookingUrl: "https://book.example.com/durable",
    });
    const firstEvent = {
      sessionId: "checkout-durable-create",
      listingDraft,
      amountUsd: 5,
      kind: "create" as const,
      paidAt: OPEN_NYC.toISOString(),
    };
    const created = applyPaidEvent(firstEvent, left);
    const replayed = applyPaidEvent(firstEvent, right);
    assert.equal(replayed.id, created.id);
    assert.equal(right.listings.size, 1);
    assert.equal(right.payments.size, 1);

    // Distinct checkout sessions for the same lane serialize on the one
    // listing row, preserving both paid raises without duplicate venues.
    applyPaidEvent(
      {
        sessionId: "checkout-durable-raise-a",
        listingDraft,
        amountUsd: 7,
        kind: "raise",
        paidAt: "2026-08-20T16:00:01.000Z",
      },
      left,
    );
    applyPaidEvent(
      {
        sessionId: "checkout-durable-raise-b",
        listingDraft,
        amountUsd: 3,
        kind: "raise",
        paidAt: "2026-08-20T16:00:02.000Z",
      },
      right,
    );
    assert.equal(left.listings.size, 1);
    assert.equal(right.payments.size, 3);
    assert.equal(right.listings.get(created.id)?.bid_usd, 15);
    assert.equal(right.listings.get(created.id)?.first_paid_at, OPEN_NYC.toISOString());

    left.close();
    left = undefined;
    right.close();
    right = undefined;
    restarted = openDatabase(path);
    assert.equal(restarted.listings.size, 1);
    assert.equal(restarted.payments.size, 3);
    assert.equal(restarted.listings.get(created.id)?.bid_usd, 15);
  } finally {
    left?.close();
    right?.close();
    restarted?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("SQLite serializes concurrent stale raises: one $5→$12 applies and the other reconciles", async () => {
  setCheckoutNow(OPEN_NYC);
  const directory = mkdtempSync(join(tmpdir(), "city-weekend-concurrent-"));
  const path = join(directory, "board.sqlite");
  let seed: ReturnType<typeof openDatabase> | undefined;
  let reader: ReturnType<typeof openDatabase> | undefined;
  try {
    seed = openDatabase(path);
    applyPaidEvent(
      {
        sessionId: "checkout-concurrent-seed",
        listingDraft: draft({
          venueName: "Concurrent Room",
          bookingUrl: "https://book.example.com/concurrent",
        }),
        amountUsd: 5,
        kind: "create",
        paidAt: OPEN_NYC.toISOString(),
      },
      seed,
    );
    seed.close();
    seed = undefined;

    const portUrl = new URL("../src/billing/port.ts", import.meta.url).href;
    const childCode = `
      const { applyPaidEvent, setCheckoutNow } = await import(${JSON.stringify(portUrl)});
      const { openDatabase } = await import(${JSON.stringify(new URL("../src/db.ts", import.meta.url).href)});
      const now = new Date("2026-08-20T16:00:00.000Z");
      setCheckoutNow(now);
      const db = openDatabase(process.env.DATABASE_PATH);
      try {
        applyPaidEvent({
          sessionId: process.env.RAISE_SESSION,
          listingDraft: {
            city: "nyc",
            windowId: "nyc:2026-W34",
            venueName: "Concurrent Room",
            bookingUrl: "https://book.example.com/concurrent",
            kind: "restaurant",
            pitch: null,
          },
          amountUsd: 7,
          targetBidUsd: 12,
          quoteBaseBidUsd: 5,
          kind: "raise",
          paidAt: process.env.RAISE_PAID_AT,
        }, db);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("stale_raise_requires_reconciliation")) throw error;
      }
      db.close();
    `;
    const runRaise = (session: string, paidAt: string): Promise<void> =>
      new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ["--input-type=module", "--import=tsx/esm", "--eval", childCode],
          {
            cwd: process.cwd(),
            env: {
              ...process.env,
              DATABASE_PATH: path,
              PAYMENT_MODE: "fixture",
              RAISE_SESSION: session,
              RAISE_PAID_AT: paidAt,
            },
            stdio: ["ignore", "ignore", "pipe"],
          },
        );
        let stderr = "";
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.once("error", reject);
        child.once("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`raise child exited ${code}: ${stderr}`));
        });
      });

    await Promise.all([
      runRaise("checkout-concurrent-a", "2026-08-20T16:00:01.000Z"),
      runRaise("checkout-concurrent-b", "2026-08-20T16:00:02.000Z"),
    ]);

    reader = openDatabase(path);
    assert.equal(reader.listings.size, 1);
    assert.equal(reader.payments.size, 3);
    assert.equal(
      (reader.sqlite.prepare("SELECT COUNT(*) AS count FROM payments WHERE status = 'reconciliation_required'").get() as { count: number }).count,
      1,
    );
    assert.equal(Array.from(reader.listings.values())[0]?.bid_usd, 12);
    assert.equal((reader.sqlite.prepare("SELECT COUNT(*) AS count FROM payment_events WHERE outcome = 'reconciliation_required'").get() as { count: number }).count, 1);
  } finally {
    seed?.close();
    reader?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("checkout complete is a read-only intent status page", async () => {
  setCheckoutNow(OPEN_NYC);
  const port = getPaymentPort();
  const started = await port.createCheckout({
    listingDraft: draft({ venueName: "Complete Room", bookingUrl: "https://book.example.com/complete" }),
    amountUsd: 5,
    kind: "create",
  });
  const before = getCheckoutIntent(getDb(), started.intentId!);
  assert.equal(before?.status, "open");

  const pendingMarkup = renderToStaticMarkup(
    await CheckoutCompletePage({
      searchParams: Promise.resolve({ intent: started.intentId, status: "paid" } as { intent: string; status: string }),
    }),
  );
  assert.match(pendingMarkup, /data-checkout-state="pending"/);
  assert.equal(getCheckoutIntent(getDb(), started.intentId!)?.status, "open");

  const canceled = await resolveReturn({ intent: started.intentId, status: "cancel" });
  assert.deepEqual(canceled, { status: "pending" });
  assert.equal(getCheckoutIntent(getDb(), started.intentId!)?.status, "open");

  applyPaidEvent(await port.completeCheckout(started.sessionId));
  const paidMarkup = renderToStaticMarkup(
    await CheckoutCompletePage({ searchParams: Promise.resolve({ intent: started.intentId }) }),
  );
  assert.match(paidMarkup, /data-checkout-state="paid"/);
});

test("retired Polar webhook is inert while canonical Waffo route remains owned", async () => {
  const request = new Request("http://localhost/api/polar/webhook", {
    method: "POST",
    body: JSON.stringify({ type: "order.completed" }),
  });
  const post = await postPolarWebhook(request);
  assert.equal(post.status, 410);
  assert.deepEqual(await post.json(), { error: "polar_webhook_retired", canonical: "/api/waffo/webhook" });
  assert.equal((await getPolarWebhook(new Request("http://localhost/api/polar/webhook"))).status, 410);
});

test("signed Waffo malformed-present checkout and product fields cannot fall back", async () => {
  setCheckoutNow(OPEN_NYC);
  for (const [field, value] of [["checkoutId", ""], ["productId", ""]] as const) {
    const harness = waffoHarness();
    try {
      const started = await harness.payment.createCheckout({
        listingDraft: draft({ venueName: `Malformed ${field}`, bookingUrl: `https://book.example.com/${field}` }),
        amountUsd: 5,
        kind: "create",
        targetBidUsd: 5,
        chargeCents: 500,
      });
      const signed = signedWaffoEvent(harness, started.sessionId, { [field]: value });
      const event = await harness.payment.handleWebhook(signed.raw, signed.headers);
      assert.ok(!("ignored" in event));
      assert.throws(() => applyPaidEvent(event, harness.db), /immutable_fact_mismatch/);
      assert.equal(harness.db.listings.size, 0);
      assert.equal((harness.db.sqlite.prepare("SELECT outcome FROM payment_events").get() as { outcome: string }).outcome, "rejected");
    } finally {
      harness.db.close();
    }
  }
});

test("Waffo checkout timeout aborts fetch and leaves an unknown intent", async () => {
  setCheckoutNow(OPEN_NYC);
  let aborted = false;
  const harness = waffoHarness(
    async (_input, init) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        aborted = true;
        reject(new Error("aborted"));
        return;
      }
      signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("aborted"));
      }, { once: true });
    }),
    250,
    true,
  );
  try {
    await assert.rejects(
      harness.payment.createCheckout({
        listingDraft: draft({ venueName: "Never Responds", bookingUrl: "https://book.example.com/never" }),
        amountUsd: 5,
        kind: "create",
        targetBidUsd: 5,
        chargeCents: 500,
      }),
      /waffo_checkout_unknown/,
    );
    assert.equal(aborted, true);
    const row = harness.db.sqlite.prepare("SELECT status, reason FROM checkout_intents").get() as { status: string; reason: string };
    assert.equal(row.status, "unknown");
    assert.match(row.reason, /waffo_checkout_timeout/);
  } finally {
    harness.db.close();
  }
});

test("Waffo checkout deadline also covers a response body read", async () => {
  setCheckoutNow(OPEN_NYC);
  let aborted = false;
  const harness = waffoHarness(
    async (_input, init) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("{\"data\":"));
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            controller.error(new Error("aborted"));
          }, { once: true });
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "application/json" } });
    },
    250,
    true,
  );
  try {
    await assert.rejects(
      harness.payment.createCheckout({
        listingDraft: draft({ venueName: "Body Hang Room", bookingUrl: "https://book.example.com/body-hang" }),
        amountUsd: 5,
        kind: "create",
        targetBidUsd: 5,
        chargeCents: 500,
      }),
      /waffo_checkout_unknown/,
    );
    assert.equal(aborted, true);
    assert.equal((harness.db.sqlite.prepare("SELECT status FROM checkout_intents").get() as { status: string }).status, "unknown");
  } finally {
    harness.db.close();
  }
});

test("Waffo rejects unsafe checkout destinations and implausible expiry", async () => {
  setCheckoutNow(OPEN_NYC);
  const responses = [
    { checkoutUrl: "https://buyer:secret@127.0.0.1/internal", expiresAt: "2026-08-20T17:00:00.000Z" },
    { checkoutUrl: "https://checkout.waffo.ai:443/explicit-default-port", expiresAt: "2026-08-20T17:00:00.000Z" },
    { checkoutUrl: "https://checkout.waffo.ai/expired", expiresAt: "2020-01-01T00:00:00.000Z" },
    { checkoutUrl: "https://checkout.waffo.ai/far-future", expiresAt: "2030-01-01T00:00:00.000Z" },
  ];
  for (const [index, response] of responses.entries()) {
    const harness = waffoHarness(async () => new Response(JSON.stringify({ data: {
      sessionId: `CHK_UNSAFE_${index}`,
      ...response,
    } }), { status: 200, headers: { "content-type": "application/json" } }));
    try {
      await assert.rejects(
        harness.payment.createCheckout({
          listingDraft: draft({ venueName: `Unsafe ${index}`, bookingUrl: `https://book.example.com/unsafe-${index}` }),
          amountUsd: 5,
          kind: "create",
          targetBidUsd: 5,
          chargeCents: 500,
        }),
        /waffo_checkout_unknown/,
      );
      assert.equal((harness.db.sqlite.prepare("SELECT status FROM checkout_intents").get() as { status: string }).status, "unknown");
    } finally {
      harness.db.close();
    }
  }
});

test("Waffo money modes require durable storage and production callback origin", () => {
  const harness = waffoHarness();
  try {
    assert.throws(() => requireWaffoConfig({ ...harness.env, DATABASE_PATH: ":memory:" }, "waffo-test", harness.publicKey), /BLOCKED-CONFIG: DATABASE_PATH/);
    assert.throws(
      () => requireWaffoConfig({
        ...harness.env,
        PAYMENT_MODE: "waffo-prod",
        DATABASE_PATH: "/tmp/city-weekend-prod.sqlite",
        PUBLIC_BASE_URL: "https://public.example.com/base?tenant=x#frag",
        WAFFO_WEBHOOK_PROD_PUBLIC_KEY: harness.publicKey,
      }, "waffo-prod", harness.publicKey),
      /PUBLIC_BASE_URL/,
    );
    assert.throws(
      () => requireWaffoConfig({
        ...harness.env,
        PAYMENT_MODE: "waffo-prod",
        DATABASE_PATH: "/tmp/city-weekend-prod.sqlite",
        PUBLIC_BASE_URL: "https://public.example.com:443",
        WAFFO_WEBHOOK_PROD_PUBLIC_KEY: harness.publicKey,
      }, "waffo-prod", harness.publicKey),
      /PUBLIC_BASE_URL/,
    );
  } finally {
    harness.db.close();
  }
});

test("Waffo production accepts a systemd-escaped webhook public key", () => {
  const harness = waffoHarness();
  try {
    const config = requireWaffoConfig({
      ...harness.env,
      PAYMENT_MODE: "waffo-prod",
      PUBLIC_BASE_URL: "https://cityweekend.lol",
      WAFFO_API_BASE: "https://api.waffo.ai",
      WAFFO_WEBHOOK_PROD_PUBLIC_KEY: harness.publicKey.replace(/\n/g, "\\n"),
    }, "waffo-prod");
    assert.equal(config.webhookPublicKey, harness.publicKey.trim());
  } finally {
    harness.db.close();
  }
});
