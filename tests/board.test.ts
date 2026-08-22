import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CityBoard, ListingCard } from "../src/app/[city]/board";
import { getCity, type BoardListing } from "../src/core/cities";
import { default as HomePage } from "../src/app/page";

const nyc = getCity("nyc");
assert.ok(nyc);

function fixtureListing(
  overrides: Partial<BoardListing> &
    Pick<BoardListing, "id" | "venueName" | "bidUsd" | "rank">,
): BoardListing {
  return {
    city: "nyc",
    kind: "restaurant",
    bookingUrl: `https://book.example.com/${overrides.id}`,
    pitch: null,
    clicks: 0,
    ...overrides,
  };
}

const rankedCards: BoardListing[] = [
  fixtureListing({
    id: "lst_top",
    venueName: "Sunday Roast",
    bidUsd: 12,
    clicks: 4,
    rank: 1,
    kind: "restaurant",
  }),
  fixtureListing({
    id: "lst_two",
    venueName: "Late Bar",
    bidUsd: 8,
    clicks: 1,
    rank: 2,
    kind: "bar",
  }),
];

test("GET / uses the default board path (redirect to /nyc)", () => {
  assert.throws(
    () => HomePage(),
    (error: unknown) => {
      assert.ok(error && typeof error === "object");
      const digest =
        "digest" in error && typeof error.digest === "string"
          ? error.digest
          : "";
      assert.match(digest, /NEXT_REDIRECT/);
      assert.match(digest, /\/nyc/);
      return true;
    },
  );
});

test("empty NYC window renders the bid form and no cards", () => {
  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.match(html, /data-board=""/);
  assert.match(html, /data-city="nyc"/);
  assert.match(html, /data-bid-form=""/);
  assert.match(html, /Venue name or booking URL/);
  assert.match(html, /name="amountUsd"/);
  assert.match(html, />Outbid</);
  assert.match(html, /data-empty-board="true"/);
  assert.match(html, /Rank is money, not stars/);
  assert.doesNotMatch(html, /data-listing-card/);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count/i);
});

test("cards show rank, venue, $bid, clicks, and booking — not stars", () => {
  const html = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[0] }),
  );
  assert.match(html, /data-rank="1"/);
  assert.match(html, /#1/);
  assert.match(html, /Sunday Roast/);
  assert.match(html, /\$12/);
  assert.match(html, /4 clicks/);
  assert.match(html, /Book/);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count/i);
});

test("ranked cards keep money order in markup", () => {
  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const roast = html.indexOf("Sunday Roast");
  const bar = html.indexOf("Late Bar");
  assert.ok(roast >= 0 && bar > roast);
  assert.match(html, /\$12/);
  assert.match(html, /\$8/);
  assert.match(html, /4 clicks/);
  assert.match(html, /1 click/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars/i);
});
