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
  assert.match(html, /Venue name and https booking URL/);
  assert.match(html, /name="amountUsd"/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.match(html, /name="city"/);
  assert.match(html, /value="nyc"/);
  assert.match(html, />Outbid</);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /data-empty-board="true"/);
  assert.match(html, /Rank is money, not stars/);
  assert.doesNotMatch(html, /Checkout is not live/);
  assert.doesNotMatch(html, /data-checkout-stub/);
  assert.doesNotMatch(html, /data-listing-card/);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count/i);
});

test("empty board reads like an unpublished weekend poster", () => {
  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.match(html, /class="city-name"/);
  assert.match(html, />New York City</);
  assert.match(html, /One city · one weekend/);
  assert.match(html, /This Friday \/ Saturday/);
  assert.match(html, /class="empty-answer"/);
  assert.match(html, /No #1/);
  assert.match(html, /This weekend is unpublished/);
  assert.match(html, /Nothing is invented here/);
  assert.doesNotMatch(html, /empty-kicker/);
  assert.doesNotMatch(html, /city-kicker/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /second prize|editor.?s pick|rated 4\.9/i);
});

test("first-time visitor reads the weekend answer before claim chrome", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  const emptyAnswer = empty.indexOf("data-empty-board");
  const emptyClaim = empty.indexOf("data-bid-form");
  assert.ok(emptyAnswer >= 0 && emptyClaim > emptyAnswer);
  const noOne = empty.indexOf("No #1");
  const unpublished = empty.indexOf("This weekend is unpublished");
  assert.ok(noOne >= 0 && unpublished > noOne);
  assert.match(empty, /class="empty-answer"/);
  assert.match(empty, /class="empty-note"/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const topCard = occupied.indexOf("data-listing-card");
  const occupiedClaim = occupied.indexOf("data-bid-form");
  assert.ok(topCard >= 0 && occupiedClaim > topCard);
  assert.match(occupied, /Sunday Roast/);
  assert.match(occupied, /\$12/);
  assert.doesNotMatch(occupied, /data-empty-board/);
});

test("cards show rank, venue, kind, $bid, clicks, and Book — not stars", () => {
  const withPitch: BoardListing = {
    ...rankedCards[0],
    pitch: "Friday roast, walk-ins after nine.",
  };
  const html = renderToStaticMarkup(
    createElement(ListingCard, { listing: withPitch }),
  );
  assert.match(html, /data-rank="1"/);
  assert.match(html, /#1/);
  assert.match(html, /Sunday Roast/);
  assert.match(html, /data-kind=""/);
  assert.match(html, /Restaurant/);
  assert.match(html, /Friday roast, walk-ins after nine/);
  assert.match(html, /\$12/);
  assert.match(html, /4 clicks/);
  assert.match(html, />Book</);
  assert.match(html, /href="\/api\/click\/lst_top"/);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("ranked cards keep money order in markup", () => {
  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const roast = html.indexOf("Sunday Roast");
  const bar = html.indexOf("Late Bar");
  assert.ok(roast >= 0 && bar > roast);
  assert.match(html, /class="city-name"/);
  assert.match(html, /\$12/);
  assert.match(html, /\$8/);
  assert.match(html, /4 clicks/);
  assert.match(html, /1 click/);
  assert.match(html, /data-kind=""/);
  assert.match(html, /Bar/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars/i);
});

test("failed checkout returns an honest error on the poster, not a stub", () => {
  const html = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      checkoutError: "listing_invalid",
    }),
  );
  assert.match(html, /data-checkout-error="true"/);
  assert.match(html, /Need a venue name and a https booking URL/);
  assert.doesNotMatch(html, /Checkout is not live/);
  assert.doesNotMatch(html, /data-listing-card/);
});
