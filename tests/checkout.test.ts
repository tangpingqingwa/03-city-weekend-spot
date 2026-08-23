import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, test } from "node:test";
import { POST as postCheckout } from "../src/app/api/checkout/route";
import { POST as postWebhook } from "../src/app/api/polar/webhook/route";
import { FixturePayment } from "../src/billing/fixture";
import { PolarPayment, POLAR_API_BASE } from "../src/billing/polar";
import {
  CheckoutError,
  applyPaidEvent,
  checkoutNow,
  createPaymentPort,
  getPaymentPort,
  parseAmountUsd,
  polarApiBase,
  polarLiveEnabled,
  quoteCheckout,
  resetCheckoutState,
  setCheckoutNow,
} from "../src/billing/port";
import { MIN_BID_USD, getCity, type City } from "../src/core/cities";
import { ListingError, quoteBid } from "../src/core/listing";
import { rankListings } from "../src/core/rank";
import { currentWindow } from "../src/core/window";
import { getDb, listingsForCityWindow } from "../src/db";

/** Thursday 2026-08-20 12:00 EDT — open NYC weekend window. */
const OPEN_NYC = new Date("2026-08-20T16:00:00.000Z");
/** Monday 2026-08-24 00:00 EDT — next ISO week, window closed. */
const CLOSED_NYC = new Date("2026-08-24T04:00:00.000Z");

const nycCity = getCity("nyc");
if (!nycCity) {
  throw new Error("nyc catalog row is required");
}
const nyc: City = nycCity;

afterEach(() => {
  resetCheckoutState();
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

test("createPaymentPort stays fixture unless POLAR_LIVE=1", () => {
  assert.equal(polarLiveEnabled({}), false);
  assert.equal(polarLiveEnabled({ POLAR_LIVE: "0" }), false);
  assert.equal(polarLiveEnabled({ POLAR_LIVE: "true" }), false);
  assert.equal(polarLiveEnabled({ POLAR_LIVE: "1", POLAR_FIXTURE_ONLY: "1" }), false);
  assert.equal(createPaymentPort({}).kind, "fixture");
  assert.equal(createPaymentPort({ POLAR_LIVE: "0" }).kind, "fixture");
  assert.equal(createPaymentPort({ POLAR_LIVE: "true" }).kind, "fixture");
  assert.throws(
    () => createPaymentPort({ POLAR_LIVE: "1" }),
    /BLOCKED-SECRET: POLAR_ACCESS_TOKEN/,
  );
  const live = createPaymentPort({
    POLAR_LIVE: "1",
    POLAR_ACCESS_TOKEN: "polar_tok_test",
  });
  assert.equal(live.kind, "live");
});

test("POLAR_FIXTURE_ONLY=1 wins over POLAR_LIVE=1", () => {
  const previousLive = process.env.POLAR_LIVE;
  const previousFixture = process.env.POLAR_FIXTURE_ONLY;
  process.env.POLAR_LIVE = "1";
  process.env.POLAR_FIXTURE_ONLY = "1";
  try {
    resetCheckoutState();
    assert.equal(polarLiveEnabled(), false);
    assert.equal(getPaymentPort().kind, "fixture");
    assert.throws(() => new PolarPayment({ env: process.env }), /POLAR_LIVE=1/);
  } finally {
    if (previousLive === undefined) delete process.env.POLAR_LIVE;
    else process.env.POLAR_LIVE = previousLive;
    if (previousFixture === undefined) delete process.env.POLAR_FIXTURE_ONLY;
    else process.env.POLAR_FIXTURE_ONLY = previousFixture;
    resetCheckoutState();
  }
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

test("fixture webhook paid event lists; expired does not", async () => {
  setCheckoutNow(OPEN_NYC);
  const paidBody = JSON.stringify({
    type: "checkout.updated",
    data: {
      id: "chk_recorded_paid",
      status: "succeeded",
      amount: 500,
      metadata: {
        city: "nyc",
        windowId: windowIdAt(),
        venueName: "Webhook Open",
        bookingUrl: "https://book.example.com/webhook-open",
        amountUsd: "5",
        kind: "create",
      },
    },
  });
  const paid = await postWebhook(
    new Request("http://localhost/api/polar/webhook", {
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
    new Request("http://localhost/api/polar/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: paidBody,
    }),
  );
  assert.equal(again.status, 200);
  assert.equal(rankedNyc().length, 1);

  const expired = await postWebhook(
    new Request("http://localhost/api/polar/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "checkout.updated",
        data: {
          id: "chk_recorded_expired",
          status: "expired",
          amount: 800,
          metadata: {
            city: "nyc",
            windowId: windowIdAt(),
            venueName: "Ghost",
            bookingUrl: "https://book.example.com/ghost",
            amountUsd: "8",
          },
        },
      }),
    }),
  );
  assert.equal(expired.status, 200);
  assert.deepEqual(await expired.json(), { received: true, applied: false });
  assert.equal(rankedNyc().length, 1);
});

test("polarApiBase defaults to production and honors POLAR_API_BASE", () => {
  assert.equal(polarApiBase({}), POLAR_API_BASE);
  assert.equal(polarApiBase({ POLAR_API_BASE: POLAR_API_BASE }), POLAR_API_BASE);
  const sandboxApi = `https://${["sandbox-api", "polar", "sh"].join(".")}`;
  assert.equal(polarApiBase({ POLAR_API_BASE: `${sandboxApi}/` }), sandboxApi);
});

test("live PolarCheckout never fetches unless POLAR_LIVE=1", async () => {
  setCheckoutNow(OPEN_NYC);
  assert.throws(
    () => new PolarPayment({ env: {} }),
    /PolarPayment requires POLAR_LIVE=1/,
  );
  assert.throws(
    () => new PolarPayment({ env: { POLAR_LIVE: "1" } }),
    /BLOCKED-SECRET: POLAR_ACCESS_TOKEN/,
  );

  let fetches = 0;
  const polar = new PolarPayment({
    env: {
      POLAR_LIVE: "1",
      POLAR_ACCESS_TOKEN: "polar_tok_test",
      PUBLIC_BASE_URL: "http://localhost:3000",
    },
    fetch: async (input) => {
      fetches += 1;
      assert.equal(String(input), `${polarApiBase()}/v1/checkouts/`);
      assert.equal(String(input), `${POLAR_API_BASE}/v1/checkouts/`);
      return new Response(
        JSON.stringify({
          id: "chk_recorded_open",
          status: "open",
          url: "https://example.test/checkout/chk_recorded_open",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const session = await polar.createCheckout({
    listingDraft: draft(),
    amountUsd: 5,
    kind: "create",
  });
  assert.equal(fetches, 1);
  assert.equal(session.sessionId, "chk_recorded_open");
  assert.equal(session.checkoutUrl, "https://example.test/checkout/chk_recorded_open");
  await assert.rejects(
    polar.completeCheckout(session.sessionId),
    /completes via webhook only/,
  );
  assert.equal(rankedNyc().length, 0);
});

test("live Polar checkout uses POLAR_API_BASE override and optional product_id", async () => {
  setCheckoutNow(OPEN_NYC);
  const sandboxApi = `https://${["sandbox-api", "polar", "sh"].join(".")}`;
  const sandboxCheckout = `https://${["sandbox", "polar", "sh"].join(".")}/checkout/chk_sandbox_open`;
  let fetches = 0;
  const polar = new PolarPayment({
    env: {
      POLAR_LIVE: "1",
      POLAR_ACCESS_TOKEN: "polar_tok_test",
      POLAR_API_BASE: `${sandboxApi}/`,
      POLAR_PRODUCT_ID: "prod_sandbox_test",
      PUBLIC_BASE_URL: "http://localhost:3000",
    },
    fetch: async (input, init) => {
      fetches += 1;
      assert.equal(String(input), `${sandboxApi}/v1/checkouts/`);
      assert.notEqual(String(input), `${POLAR_API_BASE}/v1/checkouts/`);
      const raw = typeof init?.body === "string" ? init.body : "";
      const body = JSON.parse(raw) as Record<string, unknown>;
      assert.equal(body.product_id, "prod_sandbox_test");
      assert.equal(body.amount, 500);
      assert.equal(body.currency, "usd");
      const metadata = body.metadata as Record<string, unknown>;
      assert.equal(metadata.pitch, undefined);
      return new Response(
        JSON.stringify({
          id: "chk_sandbox_open",
          status: "open",
          url: sandboxCheckout,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  const session = await polar.createCheckout({
    listingDraft: draft({ pitch: null }),
    amountUsd: 5,
    kind: "create",
  });
  assert.equal(fetches, 1);
  assert.equal(session.sessionId, "chk_sandbox_open");
  assert.equal(session.checkoutUrl, sandboxCheckout);
  assert.equal(rankedNyc().length, 0);
});

test("live Polar webhook signed paid event lists", async () => {
  setCheckoutNow(OPEN_NYC);
  const secret = "whsec_test";
  const polar = new PolarPayment({
    env: {
      POLAR_LIVE: "1",
      POLAR_ACCESS_TOKEN: "polar_tok_test",
      POLAR_WEBHOOK_SECRET: secret,
    },
    fetch: async () => {
      throw new Error("live Polar must not fetch from webhook tests");
    },
  });
  const raw = JSON.stringify({
    type: "checkout.updated",
    data: {
      id: "chk_underbid",
      status: "succeeded",
      amount: 800,
      metadata: {
        city: "nyc",
        windowId: windowIdAt(),
        venueName: "Underbid",
        bookingUrl: "https://book.example.com/underbid",
        amountUsd: "8",
        kind: "create",
      },
    },
  });
  await assert.rejects(polar.handleWebhook(raw, {}), /signature/);

  const webhookId = "msg_1";
  const timestamp = "1710000000";
  const signature = createHmac("sha256", secret)
    .update(`${webhookId}.${timestamp}.${raw}`)
    .digest("base64");
  const result = await polar.handleWebhook(raw, {
    "webhook-id": webhookId,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  });
  assert.ok(!("ignored" in result));
  if ("ignored" in result) return;
  applyPaidEvent(result);
  const ranked = rankedNyc();
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.bidUsd, 8);
  assert.equal(ranked[0]?.venueName, "Underbid");
  assert.equal(ranked[0]?.rank, 1);
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
  assert.notEqual(raised.lastPaidAt, firstPaidAt);

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
