import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { getCity, resolveCity, type City } from "../src/core/cities";
import {
  ListingError,
  createListing,
  isPaidListing,
  venueKey,
  type Listing,
} from "../src/core/listing";
import {
  getBoardListings,
  listingsForLane,
  rankListings,
} from "../src/core/rank";
import { currentWindow } from "../src/core/window";
import {
  SCHEMA_SQL,
  findListingByVenueKey,
  insertListing,
  listingFromRow,
  listingsForCityRollingWeek,
  listingsForCityWindow,
  openDatabase,
  paymentEventByDeliveryId,
  paymentEventsForCheckout,
  recordPaymentEvent,
  upsertWindow,
} from "../src/db";

const nyc = getCity("nyc");
assert.ok(nyc);

const NYC_WINDOW = "nyc:2026-W34";
const LONDON_WINDOW = "london:2026-W34";

const london: City = {
  slug: "london",
  name: "London",
  timezone: "Europe/London",
  active: true,
};

function listing(
  partial: Partial<Listing> &
    Pick<Listing, "id" | "bidUsd" | "firstPaidAt">,
): Listing {
  const city = partial.city ?? "nyc";
  const windowId = partial.windowId ?? NYC_WINDOW;
  const venueName = partial.venueName ?? `Venue ${partial.id}`;
  const bookingUrl = partial.bookingUrl ?? `https://book.example.com/${partial.id}`;
  return createListing({
    ...partial,
    city,
    windowId,
    venueName,
    bookingUrl,
    bidUsd: partial.bidUsd,
    firstPaidAt: partial.firstPaidAt,
    lastPaidAt: partial.lastPaidAt ?? partial.firstPaidAt,
    clicks: partial.clicks ?? 0,
    kind: partial.kind ?? null,
    pitch: partial.pitch ?? null,
  });
}

test("higher bid ranks above; below-#1 still lists", () => {
  const ranked = rankListings(
    [
      listing({
        id: "five",
        venueName: "Five Dollar",
        bidUsd: 5,
        firstPaidAt: "2026-08-20T16:00:00.000Z",
        clicks: 90,
      }),
      listing({
        id: "twelve",
        venueName: "Twelve Dollar",
        bidUsd: 12,
        firstPaidAt: "2026-08-21T16:00:00.000Z",
        clicks: 0,
      }),
    ],
    { city: "nyc", windowId: NYC_WINDOW },
  );
  assert.deepEqual(
    ranked.map((row) => ({ id: row.id, rank: row.rank, bidUsd: row.bidUsd })),
    [
      { id: "twelve", rank: 1, bidUsd: 12 },
      { id: "five", rank: 2, bidUsd: 5 },
    ],
  );
});

test("equal bids: older firstPaidAt stays above, then id ASC", () => {
  const ranked = rankListings(
    [
      listing({
        id: "newer",
        bidUsd: 8,
        firstPaidAt: "2026-08-21T16:00:00.000Z",
        clicks: 40,
      }),
      listing({
        id: "older",
        bidUsd: 8,
        firstPaidAt: "2026-08-20T16:00:00.000Z",
        clicks: 0,
      }),
      listing({
        id: "b",
        bidUsd: 8,
        firstPaidAt: "2026-08-20T16:00:00.000Z",
      }),
      listing({
        id: "a",
        bidUsd: 8,
        firstPaidAt: "2026-08-20T16:00:00.000Z",
      }),
    ],
    { city: "nyc" },
  );
  assert.deepEqual(
    ranked.map((row) => row.id),
    ["a", "b", "older", "newer"],
  );
  assert.equal(ranked[0]?.rank, 1);
});

test("equal bids compare paid timestamps by instant, not offset-string order", () => {
  const ranked = rankListings(
    [
      listing({
        id: "utc-older",
        bidUsd: 9,
        firstPaidAt: "2026-08-20T16:30:00.000Z",
      }),
      listing({
        id: "offset-newer",
        bidUsd: 9,
        firstPaidAt: "2026-08-20T12:00:00-05:00",
      }),
    ],
    { city: "nyc", windowId: NYC_WINDOW },
  );
  assert.deepEqual(ranked.map((row) => row.id), ["utc-older", "offset-newer"]);
});

test("rankListings takes city; a second city uses the same rank.ts", () => {
  const rows = [
    listing({
      id: "nyc-five",
      city: "nyc",
      windowId: NYC_WINDOW,
      bidUsd: 5,
      firstPaidAt: "2026-08-20T16:00:00.000Z",
    }),
    listing({
      id: "london-twenty",
      city: "london",
      windowId: LONDON_WINDOW,
      venueName: "Soho Room",
      bookingUrl: "https://book.example.co.uk/soho",
      bidUsd: 20,
      firstPaidAt: "2026-08-20T12:00:00.000Z",
    }),
    listing({
      id: "london-eight",
      city: "london",
      windowId: LONDON_WINDOW,
      venueName: "East End Bar",
      bookingUrl: "https://book.example.co.uk/east",
      bidUsd: 8,
      firstPaidAt: "2026-08-20T11:00:00.000Z",
    }),
  ];

  const nycRanked = rankListings(rows, { city: "nyc", windowId: NYC_WINDOW });
  const londonRanked = rankListings(rows, { city: "london", windowId: LONDON_WINDOW });

  assert.deepEqual(
    nycRanked.map((row) => row.id),
    ["nyc-five"],
  );
  assert.deepEqual(
    londonRanked.map((row) => ({ id: row.id, rank: row.rank })),
    [
      { id: "london-twenty", rank: 1 },
      { id: "london-eight", rank: 2 },
    ],
  );
  assert.equal(currentWindow(london, new Date("2026-08-20T11:00:00.000Z")).city, "london");
});

test("previous-week bids never appear on the live (city, window) board", () => {
  const ranked = rankListings(
    listingsForLane(
      [
        listing({
          id: "last-week",
          windowId: "nyc:2026-W33",
          bidUsd: 50,
          firstPaidAt: "2026-08-13T16:00:00.000Z",
        }),
        listing({
          id: "this-week",
          windowId: NYC_WINDOW,
          bidUsd: 5,
          firstPaidAt: "2026-08-20T16:00:00.000Z",
        }),
      ],
      { city: "nyc", windowId: NYC_WINDOW },
    ),
    { city: "nyc", windowId: NYC_WINDOW },
  );
  assert.deepEqual(
    ranked.map((row) => row.id),
    ["this-week"],
  );
});

test("only the rolling last 7 days is ranked on the live board", () => {
  const now = new Date("2026-08-24T00:00:00.000Z");
  const ranked = rankListings(
    listingsForLane(
      [
        listing({
          id: "aged-out",
          windowId: "nyc:2026-W33",
          bidUsd: 50,
          firstPaidAt: "2026-08-16T23:59:59.000Z",
        }),
        listing({
          id: "still-live",
          windowId: "nyc:2026-W33",
          bidUsd: 12,
          firstPaidAt: "2026-08-17T00:00:00.000Z",
        }),
        listing({
          id: "this-week",
          windowId: NYC_WINDOW,
          bidUsd: 5,
          firstPaidAt: "2026-08-20T16:00:00.000Z",
        }),
      ],
      { city: "nyc", now },
    ),
    { city: "nyc", now },
  );
  assert.deepEqual(
    ranked.map((row) => row.id),
    ["still-live", "this-week"],
  );
});

test("live board keeps a Sunday pay across Monday 00:00 UTC and drops it after 7 days", () => {
  const db = openDatabase(":memory:");
  insertListing(
    db,
    listing({
      id: "lst_sunday",
      venueName: "Sunday Roast",
      windowId: "nyc:2026-W33",
      bidUsd: 12,
      firstPaidAt: "2026-08-16T12:00:00.000Z",
    }),
  );
  insertListing(
    db,
    listing({
      id: "lst_stale",
      venueName: "Stale Bar",
      windowId: "nyc:2026-W32",
      bidUsd: 50,
      firstPaidAt: "2026-08-09T12:00:00.000Z",
    }),
  );

  const monday = getBoardListings(
    "nyc",
    new Date("2026-08-17T00:00:00.000Z"),
    db,
  );
  assert.equal(monday.length, 1);
  assert.equal(monday[0]?.id, "lst_sunday");
  assert.equal(monday[0]?.venueName, "Sunday Roast");
  assert.equal(monday[0]?.rank, 1);

  const stillLive = getBoardListings(
    "nyc",
    new Date("2026-08-23T12:00:00.000Z"),
    db,
  );
  assert.equal(stillLive.length, 1);
  assert.equal(stillLive[0]?.id, "lst_sunday");

  const aged = getBoardListings(
    "nyc",
    new Date("2026-08-23T12:00:01.000Z"),
    db,
  );
  assert.equal(aged.length, 0);
  assert.equal(
    listingsForCityRollingWeek(
      db,
      "nyc",
      new Date("2026-08-17T00:00:00.000Z"),
    ).map((row) => row.id).join(","),
    "lst_sunday",
  );
});

test("unknown slug is 404 city_unknown; NYC is catalog data", () => {
  assert.deepEqual(resolveCity("london"), { ok: false, code: "city_unknown" });
  assert.equal(resolveCity("nyc").ok, true);
  assert.equal(nyc.slug, "nyc");
  assert.equal(nyc.timezone, "America/New_York");
});

test("rankListings does not mutate the input", () => {
  const rows = [
    listing({ id: "z", bidUsd: 5, firstPaidAt: "2026-08-21T16:00:00.000Z" }),
    listing({ id: "y", bidUsd: 8, firstPaidAt: "2026-08-20T16:00:00.000Z" }),
  ];
  const before = rows.map((row) => row.id);
  rankListings(rows, { city: "nyc" });
  assert.deepEqual(
    rows.map((row) => row.id),
    before,
  );
});

test("live board loader invents no venues", () => {
  assert.deepEqual(getBoardListings("nyc"), []);
  assert.deepEqual(getBoardListings("london"), []);
});

test("unpaid Waffo checkout stays off the live board until paid", () => {
  const db = openDatabase(":memory:");
  const now = new Date("2026-08-20T16:00:00.000Z");
  const window = currentWindow(nyc, now);
  upsertWindow(db, window);
  insertListing(
    db,
    listing({
      id: "lst_unpaid",
      venueName: "Ghost Bar",
      bidUsd: 99,
      firstPaidAt: "1970-01-01T00:00:00.000Z",
    }),
  );
  const unpaidRow = db.listings.get("lst_unpaid");
  assert.ok(unpaidRow);
  assert.equal(isPaidListing(listingFromRow(unpaidRow)), false);
  assert.equal(getBoardListings("nyc", now, db).length, 0);

  insertListing(
    db,
    listing({
      id: "lst_paid",
      venueName: "Sunday Roast",
      bidUsd: 5,
      firstPaidAt: "2026-08-20T16:00:00.000Z",
    }),
  );
  const live = getBoardListings("nyc", now, db);
  assert.equal(live.length, 1);
  assert.equal(live[0]?.id, "lst_paid");
  assert.equal(live[0]?.rank, 1);
  assert.equal(live[0]?.venueName, "Sunday Roast");
  assert.equal(live[0]?.firstPaidAt, "2026-08-20T16:00:00.000Z");
  assert.doesNotMatch(live.map((row) => row.id).join(","), /lst_unpaid/);
});

test("listing row requires venue + city + booking URL", () => {
  const row = createListing({
    id: "lst_ok",
    city: "nyc",
    windowId: NYC_WINDOW,
    venueName: "  Sunday Roast  ",
    bookingUrl: "https://book.example.com/roast",
    bidUsd: 5,
    firstPaidAt: "2026-08-20T16:00:00.000Z",
  });
  assert.equal(row.venueName, "Sunday Roast");
  assert.equal(row.city, "nyc");
  assert.equal(row.bookingUrl, "https://book.example.com/roast");
  assert.equal(
    row.venueKey,
    venueKey({
      venueName: "Sunday Roast",
      bookingUrl: "https://book.example.com/roast",
      city: "nyc",
      windowId: NYC_WINDOW,
    }),
  );
  assert.equal(row.venueKey, "sunday roast|book.example.com|nyc|nyc:2026-W34");

  assert.throws(
    () =>
      createListing({
        city: "nyc",
        windowId: NYC_WINDOW,
        venueName: "",
        bookingUrl: "https://book.example.com/x",
        bidUsd: 5,
        firstPaidAt: "2026-08-20T16:00:00.000Z",
      }),
    (error: unknown) => error instanceof ListingError && error.code === "listing_invalid",
  );
  assert.throws(
    () =>
      createListing({
        city: "nyc",
        windowId: NYC_WINDOW,
        venueName: "No Https",
        bookingUrl: "http://book.example.com/x",
        bidUsd: 5,
        firstPaidAt: "2026-08-20T16:00:00.000Z",
      }),
    (error: unknown) => error instanceof ListingError && error.code === "url_insecure",
  );
  assert.throws(
    () =>
      createListing({
        city: "nyc",
        windowId: NYC_WINDOW,
        venueName: "4.9 stars Bistro",
        bookingUrl: "https://book.example.com/x",
        bidUsd: 5,
        firstPaidAt: "2026-08-20T16:00:00.000Z",
      }),
    (error: unknown) => error instanceof ListingError && error.code === "reviews_forbidden",
  );
  assert.throws(
    () =>
      createListing({
        city: "nyc",
        windowId: NYC_WINDOW,
        venueName: "Cents",
        bookingUrl: "https://book.example.com/x",
        bidUsd: 5.5,
        firstPaidAt: "2026-08-20T16:00:00.000Z",
      }),
    (error: unknown) => error instanceof ListingError && error.code === "bid_not_whole",
  );
  assert.throws(
    () =>
      createListing({
        city: "nyc",
        windowId: NYC_WINDOW,
        venueName: "Cheap",
        bookingUrl: "https://book.example.com/x",
        bidUsd: 4,
        firstPaidAt: "2026-08-20T16:00:00.000Z",
      }),
    (error: unknown) => error instanceof ListingError && error.code === "bid_below_min",
  );
});

test("in-memory db seeds NYC and ranks only that city + window", () => {
  const db = openDatabase(":memory:");
  assert.equal(db.cities.get("nyc")?.timezone, "America/New_York");
  assert.equal(db.cities.get("london"), undefined);
  assert.match(SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS cities/);
  assert.match(SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS windows/);
  assert.match(SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS listings/);
  assert.match(SCHEMA_SQL, /venue_name/);
  assert.match(SCHEMA_SQL, /booking_url/);

  const window = currentWindow(nyc, new Date("2026-08-20T16:00:00.000Z"));
  upsertWindow(db, window);
  insertListing(
    db,
    listing({
      id: "db-low",
      bidUsd: 5,
      firstPaidAt: "2026-08-20T16:00:00.000Z",
    }),
  );
  insertListing(
    db,
    listing({
      id: "db-high",
      bidUsd: 9,
      firstPaidAt: "2026-08-21T16:00:00.000Z",
    }),
  );

  const ranked = rankListings(listingsForCityWindow(db, "nyc", window.id), {
    city: "nyc",
    windowId: window.id,
  });
  assert.deepEqual(
    ranked.map((row) => ({ id: row.id, rank: row.rank, bidUsd: row.bidUsd })),
    [
      { id: "db-high", rank: 1, bidUsd: 9 },
      { id: "db-low", rank: 2, bidUsd: 5 },
    ],
  );
});

test("file-backed SQLite preserves rank data across restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "city-weekend-rank-"));
  const path = join(directory, "board.sqlite");
  let writer: ReturnType<typeof openDatabase> | undefined;
  let reader: ReturnType<typeof openDatabase> | undefined;
  try {
    const now = new Date("2026-08-20T16:00:00.000Z");
    const window = currentWindow(nyc, now);
    writer = openDatabase(path);
    upsertWindow(writer, window);
    insertListing(
      writer,
      listing({
        id: "restart-listing",
        windowId: window.id,
        venueName: "Restart Room",
        bookingUrl: "https://book.example.com/restart",
        bidUsd: 12,
        firstPaidAt: now.toISOString(),
      }),
    );
    assert.equal(getBoardListings("nyc", now, writer)[0]?.rank, 1);
    writer.close();
    writer = undefined;

    reader = openDatabase(path);
    assert.equal(reader.listings.size, 1);
    assert.equal(getBoardListings("nyc", now, reader)[0]?.bidUsd, 12);
    assert.equal(reader.windows.get(window.id)?.city, "nyc");
  } finally {
    writer?.close();
    reader?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("venue history permits a new cycle and changed delivery replay is rejected", () => {
  const directory = mkdtempSync(join(tmpdir(), "city-weekend-ledger-"));
  const path = join(directory, "board.sqlite");
  let left: ReturnType<typeof openDatabase> | undefined;
  let right: ReturnType<typeof openDatabase> | undefined;
  try {
    left = openDatabase(path);
    right = openDatabase(path);
    const first = listing({
      id: "lane-first",
      venueName: "Same Lane",
      bookingUrl: "https://book.example.com/same-lane",
      bidUsd: 5,
      firstPaidAt: "2026-08-20T16:00:00.000Z",
    });
    const second = listing({
      id: "lane-second",
      venueName: "Same Lane",
      bookingUrl: "https://book.example.com/same-lane",
      bidUsd: 5,
      firstPaidAt: "2026-08-20T16:00:01.000Z",
    });
    insertListing(left, first);
    const canonical = insertListing(right, second);
    assert.equal(canonical.id, second.id);
    assert.equal(left.listings.size, 2);
    assert.equal(right.listings.size, 2);
    assert.equal(findListingByVenueKey(right, first.venueKey)?.id, second.id);

    const event = {
      provider_event_id: "delivery-1",
      provider_checkout_id: "checkout-1",
      event_type: "order.completed",
      business_event_id: "business-1",
      received_at: "2026-08-20T16:00:02.000Z",
      payload_json: '{"checkout_id":"checkout-1"}',
    };
    const recorded = recordPaymentEvent(left, event);
    const replay = recordPaymentEvent(right, event);
    assert.deepEqual(replay, recorded);
    assert.equal(paymentEventByDeliveryId(right, "delivery-1")?.provider_checkout_id, "checkout-1");
    assert.equal(paymentEventsForCheckout(left, "checkout-1").length, 1);
    assert.throws(
      () => recordPaymentEvent(right!, { ...event, payload_json: '{"checkout_id":"checkout-1","changed":true}' }),
      /payment_event_identity_reuse/,
    );
    assert.equal((left!.sqlite.prepare("SELECT COUNT(*) AS count FROM payment_event_conflicts").get() as { count: number }).count, 1);
  } finally {
    left?.close();
    right?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
