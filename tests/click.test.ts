import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GET as getClick } from "../src/app/api/click/[id]/route";
import { GET as getCityClick } from "../src/app/[city]/click/[id]/route";
import { ListingCard } from "../src/app/[city]/board";
import {
  applyPaidEvent,
  resetCheckoutState,
  setCheckoutNow,
} from "../src/billing/port";
import { getCity, type City } from "../src/core/cities";
import { incrementListingClicks, listingClickPath } from "../src/core/click";
import { getBoardListings } from "../src/core/rank";
import { currentWindow } from "../src/core/window";
import { getDb, openDatabase } from "../src/db";

/** Thursday 2026-08-20 12:00 EDT — open NYC weekend window. */
const OPEN_NYC = new Date("2026-08-20T16:00:00.000Z");

const nycCity = getCity("nyc");
if (!nycCity) {
  throw new Error("nyc catalog row is required");
}
const nyc: City = nycCity;

afterEach(() => {
  resetCheckoutState();
});

function windowIdAt(now: Date = OPEN_NYC): string {
  return currentWindow(nyc, now).id;
}

function paidListing(
  overrides: Partial<{
    sessionId: string;
    venueName: string;
    bookingUrl: string;
  }> = {},
) {
  setCheckoutNow(OPEN_NYC);
  return applyPaidEvent({
    sessionId: overrides.sessionId ?? "chk_click",
    listingDraft: {
      city: "nyc",
      windowId: windowIdAt(),
      venueName: overrides.venueName ?? "Sunday Roast",
      bookingUrl:
        overrides.bookingUrl ?? "https://book.example.com/roast",
      kind: "restaurant",
      pitch: null,
    },
    amountUsd: 5,
    kind: "create",
    paidAt: "2026-08-20T16:00:00.000Z",
  });
}

test("GET /api/click/:id 302s to the stripped booking URL and increments public clicks", async () => {
  const listing = paidListing({
    bookingUrl: "https://book.example.com/roast?utm_source=board&fbclid=1#frag",
  });
  assert.equal(listing.bookingUrl, "https://book.example.com/roast");
  assert.equal(listing.clicks, 0);
  assert.equal(listingClickPath(listing.id), `/api/click/${listing.id}`);

  const response = await getClick(
    new Request(`http://localhost/api/click/${listing.id}`),
    { params: Promise.resolve({ id: listing.id }) },
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://book.example.com/roast");
  assert.doesNotMatch(response.headers.get("location") ?? "", /utm_|fbclid|#/);
  assert.equal(getDb().listings.get(listing.id)?.clicks, 1);

  const again = await getClick(
    new Request(`http://localhost/api/click/${listing.id}`),
    { params: Promise.resolve({ id: listing.id }) },
  );
  assert.equal(again.status, 302);
  assert.equal(getDb().listings.get(listing.id)?.clicks, 2);
  assert.equal(getBoardListings("nyc", OPEN_NYC)[0]?.clicks, 2);
});

test("SPEC acceptance 9: click booking CTA 302s and public clicks +1", async () => {
  const listing = paidListing({
    sessionId: "chk_accept_9",
    bookingUrl: "https://book.example.com/cta?utm_source=x",
  });
  const response = await getClick(
    new Request(`http://localhost${listingClickPath(listing.id)}`),
    { params: Promise.resolve({ id: listing.id }) },
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://book.example.com/cta");
  assert.equal(getDb().listings.get(listing.id)?.clicks, 1);
});

test("SPEC city click alias preserves the same redirect and click ledger", async () => {
  const listing = paidListing({
    sessionId: "chk_city_click",
    bookingUrl: "https://book.example.com/city-click",
  });
  const response = await getCityClick(
    new Request(`http://localhost/nyc/click/${listing.id}`),
    { params: Promise.resolve({ id: listing.id }) },
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://book.example.com/city-click");
  assert.equal(getDb().listings.get(listing.id)?.clicks, 1);
});

test("unknown listing click is 404 and does not invent a hop", async () => {
  setCheckoutNow(OPEN_NYC);
  const missing = await getClick(new Request("http://localhost/api/click/missing"), {
    params: Promise.resolve({ id: "missing" }),
  });
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "listing_not_found" });
  assert.equal(getDb().listings.size, 0);
  assert.equal(getBoardListings("nyc", OPEN_NYC).length, 0);

  const blank = await getClick(new Request("http://localhost/api/click/"), {
    params: Promise.resolve({ id: "   " }),
  });
  assert.equal(blank.status, 404);
});

test("board card shows the public click count", async () => {
  const listing = paidListing({ sessionId: "chk_card_clicks" });
  await getClick(new Request(`http://localhost/api/click/${listing.id}`), {
    params: Promise.resolve({ id: listing.id }),
  });
  const ranked = getBoardListings("nyc", OPEN_NYC);
  assert.equal(ranked[0]?.clicks, 1);
  const html = renderToStaticMarkup(
    createElement(ListingCard, { listing: ranked[0]! }),
  );
  assert.match(html, /data-clicks=""/);
  assert.match(html, /1 click/);
  assert.doesNotMatch(html, /★|star rating|4\.8|review count/i);
});

test("file-backed SQLite preserves paid listing clicks across restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "city-weekend-click-"));
  const path = join(directory, "board.sqlite");
  let writer: ReturnType<typeof openDatabase> | undefined;
  let firstReader: ReturnType<typeof openDatabase> | undefined;
  let restarted: ReturnType<typeof openDatabase> | undefined;
  try {
    writer = openDatabase(path);
    setCheckoutNow(OPEN_NYC);
    const listing = applyPaidEvent(
      {
        sessionId: "chk_restart_click",
        listingDraft: {
          city: "nyc",
          windowId: windowIdAt(),
          venueName: "Restart Click Room",
          bookingUrl: "https://book.example.com/restart-click",
          kind: "restaurant",
          pitch: null,
        },
        amountUsd: 5,
        kind: "create",
        paidAt: OPEN_NYC.toISOString(),
      },
      writer,
    );
    writer.close();
    writer = undefined;

    firstReader = openDatabase(path);
    const clicked = incrementListingClicks(listing.id, firstReader);
    assert.equal(clicked?.clicks, 1);
    firstReader.close();
    firstReader = undefined;

    restarted = openDatabase(path);
    assert.equal(restarted.listings.get(listing.id)?.clicks, 1);
    assert.equal(getBoardListings("nyc", OPEN_NYC, restarted)[0]?.clicks, 1);
  } finally {
    writer?.close();
    firstReader?.close();
    restarted?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
