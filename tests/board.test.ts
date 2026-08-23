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
  fixtureListing({
    id: "lst_three",
    venueName: "Cellar Show",
    bidUsd: 5,
    clicks: 0,
    rank: 3,
    kind: "show",
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
  assert.match(html, /data-weekend-answer=""/);
  assert.match(html, /data-book-one-first=""/);
  assert.match(html, /data-book-number-one=""/);
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
  const show = html.indexOf("Cellar Show");
  assert.ok(roast >= 0 && bar > roast && show > bar);
  assert.match(html, /class="city-name"/);
  assert.match(html, /\$12/);
  assert.match(html, /\$8/);
  assert.match(html, /\$5/);
  assert.match(html, /4 clicks/);
  assert.match(html, /1 click/);
  assert.match(html, /0 clicks/);
  assert.match(html, /data-kind=""/);
  assert.match(html, /Bar/);
  assert.match(html, /Show/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars/i);
});

test("occupied NYC board names one List a venue hop to the claim form", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-list-venue/);
  assert.doesNotMatch(empty, /List a venue/);
  assert.match(empty, /No #1/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /Print this weekend/);
  assert.match(empty, /id="claim"/);
  assert.match(empty, /action="\/api\/checkout"/);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const hop = occupied.indexOf('data-list-venue=""');
  const afterList = occupied.indexOf('data-book-after-list=""');
  const afterBook = occupied.indexOf('data-list-after-book-hop=""');
  const afterListHop = occupied.indexOf('data-book-after-list-hop=""');
  const answer = occupied.indexOf("data-weekend-answer");
  const bookOne = occupied.indexOf("data-book-number-one");
  const later = occupied.indexOf("Late Bar");
  const claim = occupied.indexOf('id="claim"');
  const form = occupied.indexOf("data-bid-form");
  assert.ok(hop >= 0 && afterList > hop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && answer > afterListHop);
  assert.ok(bookOne > answer && later > bookOne && claim > later && form > claim);
  assert.equal((occupied.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((occupied.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(occupied, /class="list-venue"[^>]*href="#claim"/);
  assert.match(occupied, />List a venue</);
  assert.match(occupied, /List a venue this weekend/);
  assert.match(occupied, /class="book-one"/);
  assert.match(occupied, /Claim #1 for/);
  assert.match(occupied, /action="\/api\/checkout"/);
  assert.doesNotMatch(occupied, /Print this weekend/);
  assert.doesNotMatch(occupied, /data-empty-board/);
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board books the paid #1 as the weekend answer", () => {
  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const later = html.indexOf("Late Bar");
  const claim = html.indexOf("data-bid-form");
  const outbid = html.indexOf(">Outbid<");
  assert.ok(listHop >= 0 && afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && answer > afterListHop);
  assert.ok(bookOne > answer && later > bookOne && claim > later && outbid > claim);
  assert.match(html, /class="weekend-answer"/);
  assert.match(html, /class="book-one"/);
  assert.equal(html.split("data-book-number-one").length - 1, 1);
  assert.match(html, /href="\/api\/click\/lst_top"/);
  assert.match(html, /data-rank="1"/);
  assert.match(html, /Sunday Roast/);
  assert.match(html, /\$12/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.match(html, /Claim #1 for/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.match(laterCard, /data-rank="2"/);
  assert.match(laterCard, />Book</);
  assert.match(laterCard, /href="\/api\/click\/lst_two"/);
  assert.doesNotMatch(laterCard, /data-weekend-answer/);
  assert.doesNotMatch(laterCard, /data-book-one-first/);
  assert.doesNotMatch(laterCard, /data-book-number-one/);
  assert.doesNotMatch(laterCard, /class="book-one"/);
});

test("occupied later ranks stamp Book as the certain hop, not a second #1", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(empty, /data-list-after-book/);
  assert.match(empty, /No #1/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  const stamp = laterCard.indexOf("data-later-book");
  const hop = laterCard.indexOf("data-book-later");
  const book = laterCard.indexOf(">Book<");
  const bid = laterCard.indexOf("data-bid");
  assert.ok(stamp >= 0 && hop > stamp && book > hop && bid > book);
  assert.match(laterCard, /data-rank="2"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);
  assert.match(laterCard, /class="book-later"/);
  assert.match(laterCard, />Book</);
  assert.match(laterCard, /href="\/api\/click\/lst_two"/);
  assert.match(laterCard, /Late Bar/);
  assert.match(laterCard, /\$8/);
  assert.doesNotMatch(laterCard, /data-weekend-answer/);
  assert.doesNotMatch(laterCard, /data-book-one-first/);
  assert.doesNotMatch(laterCard, /data-book-number-one/);
  assert.doesNotMatch(laterCard, /class="book-one"/);
  assert.doesNotMatch(laterCard, /class="booking"/);
  assert.doesNotMatch(laterCard, /data-list-after-book/);
  assert.doesNotMatch(laterCard, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const later = html.indexOf('data-listing-id="lst_two"');
  const laterStamp = html.indexOf("data-later-book");
  const laterHop = html.indexOf("data-book-later");
  const laterHref = html.indexOf('href="/api/click/lst_two"');
  const last = html.indexOf('data-listing-id="lst_three"');
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && answer > afterListHop && bookOne > answer);
  assert.ok(later > bookOne && laterStamp > later && laterHop > laterStamp);
  assert.ok(laterHref > later && last > later && lastHref > last);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/data-later-book/g) ?? []).length, 2);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/class="book-later"/g) ?? []).length, 2);
  assert.doesNotMatch(html.slice(0, later), /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(html.slice(later), /data-weekend-answer|data-book-number-one|class="book-one"/);
  assert.match(html, /class="book-one"/);
  assert.match(html, />List a venue</);
  assert.match(html, /List a venue this weekend/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board lists after later-rank Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-list-after-book/);
  assert.doesNotMatch(empty, /after later Books/);
  assert.doesNotMatch(empty, /data-list-venue/);
  assert.match(empty, /No #1/);
  assert.match(empty, /Print this weekend/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);
  assert.doesNotMatch(onlyOne, /after later Books/);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.match(onlyOne, /data-list-venue=""/);
  assert.match(onlyOne, /data-book-number-one/);
  assert.match(onlyOne, /class="book-one"/);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-list-after-book/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && answer > afterListHop && bookOne > answer);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.match(html, /class="list-after-book"[^>]*href="#claim"/);
  assert.match(html, />List a venue</);
  assert.match(html, /after later Books/);
  assert.match(html, /Paying less than #1 still lists/);
  assert.match(html, /List a venue this weekend/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board books after the list hop", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-book-after-list/);
  assert.doesNotMatch(empty, /after the list hop/);
  assert.doesNotMatch(empty, /data-list-venue/);
  assert.match(empty, /No #1/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyAfter = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  assert.ok(onlyList >= 0 && onlyAfter > onlyList && onlyAfterBook > onlyAfter);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyAnswer > onlyAfterListHop);
  assert.ok(onlyBookOne > onlyAnswer);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.match(onlyOne, /class="book-after-list"/);
  assert.match(onlyOne, /after the list hop/);
  assert.match(onlyOne, /href="\/api\/click\/lst_top"/);
  assert.equal((onlyOne.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-book-after-list/);
  assert.doesNotMatch(laterCard, /after the list hop/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && answer > afterListHop);
  assert.ok(bookOne > answer && laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(html, /class="book-after-list"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /after the list hop/);
  assert.match(html, />List a venue</);
  assert.match(html, /after later Books/);
  assert.match(html, /List a venue this weekend/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board lists after Book follows the list hop", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-list-after-book-hop/);
  assert.doesNotMatch(empty, /after Book follows List/);
  assert.doesNotMatch(empty, /data-book-after-list/);
  assert.doesNotMatch(empty, /data-list-venue/);
  assert.match(empty, /No #1/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyAfter = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  assert.ok(onlyList >= 0 && onlyAfter > onlyList && onlyAfterBook > onlyAfter);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyAnswer > onlyAfterListHop);
  assert.ok(onlyBookOne > onlyAnswer);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.match(onlyOne, /class="list-after-book-hop"[^>]*href="#claim"/);
  assert.match(onlyOne, /after Book follows List/);
  assert.match(onlyOne, /class="book-after-list"/);
  assert.match(onlyOne, /after the list hop/);
  assert.match(onlyOne, /href="\/api\/click\/lst_top"/);
  assert.equal((onlyOne.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-list-after-book-hop/);
  assert.doesNotMatch(laterCard, /after Book follows List/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && answer > afterListHop);
  assert.ok(bookOne > answer && laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(html, /class="list-after-book-hop"[^>]*href="#claim"/);
  assert.match(html, /after Book follows List/);
  assert.match(html, /class="book-after-list"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /after the list hop/);
  assert.match(html, />List a venue</);
  assert.match(html, /after later Books/);
  assert.match(html, /List a venue this weekend/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board books after List follows Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-book-after-list-hop/);
  assert.doesNotMatch(empty, /after List follows Book/);
  assert.doesNotMatch(empty, /data-list-after-book-hop/);
  assert.doesNotMatch(empty, /data-book-after-list/);
  assert.doesNotMatch(empty, /data-list-venue/);
  assert.match(empty, /No #1/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyAfter = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  assert.ok(onlyList >= 0 && onlyAfter > onlyList && onlyAfterBook > onlyAfter);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyAnswer > onlyAfterListHop);
  assert.ok(onlyBookOne > onlyAnswer);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.match(onlyOne, /class="book-after-list-hop"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(onlyOne, /after List follows Book/);
  assert.match(onlyOne, /class="list-after-book-hop"[^>]*href="#claim"/);
  assert.match(onlyOne, /after Book follows List/);
  assert.match(onlyOne, /class="book-after-list"/);
  assert.match(onlyOne, /after the list hop/);
  assert.equal((onlyOne.match(/data-book-after-list-hop=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-book-after-list-hop/);
  assert.doesNotMatch(laterCard, /after List follows Book/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && answer > afterListHop);
  assert.ok(bookOne > answer && laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-book-after-list-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(html, /class="book-after-list-hop"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /after List follows Book/);
  assert.match(html, /class="list-after-book-hop"[^>]*href="#claim"/);
  assert.match(html, /after Book follows List/);
  assert.match(html, /class="book-after-list"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /after the list hop/);
  assert.match(html, />List a venue</);
  assert.match(html, /after later Books/);
  assert.match(html, /List a venue this weekend/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board books #1 as the first hop without another Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-book-one-first/);
  assert.doesNotMatch(empty, /data-book-number-one/);
  assert.doesNotMatch(empty, /class="book-one"/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyStamp = onlyOne.indexOf('data-book-one-first=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyBid = onlyOne.indexOf('data-bid=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  assert.ok(onlyAfterListHop >= 0 && onlyStamp > onlyAfterListHop);
  assert.ok(onlyAnswer > onlyStamp && onlyBookOne > onlyAnswer);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="book-one"/);
  assert.match(onlyOne, /href="\/api\/click\/lst_top"/);
  assert.equal((onlyOne.match(/data-book-one-first=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-book-one-first/);
  assert.doesNotMatch(laterCard, /data-book-number-one/);
  assert.doesNotMatch(laterCard, /class="book-one"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const stamp = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const bid = html.indexOf('data-bid=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && stamp > afterListHop);
  assert.ok(answer > stamp && bookOne > answer && bid > bookOne);
  assert.ok(laterHop > bid && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-book-one-first=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(html, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /class="book-after-list-hop"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /after List follows Book/);
  assert.match(html, /class="list-after-book-hop"[^>]*href="#claim"/);
  assert.match(html, /after Book follows List/);
  assert.match(html, /class="book-after-list"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /after the list hop/);
  assert.match(html, />List a venue</);
  assert.match(html, /after later Books/);
  assert.match(html, /List a venue this weekend/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html.slice(laterHop), /data-book-one-first|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board lists after Book #1 without another Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-list-after-book-one/);
  assert.doesNotMatch(empty, /data-list-venue/);
  assert.doesNotMatch(empty, /data-book-number-one|class="book-one"/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyStamp = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyStamp >= 0);
  assert.ok(Math.abs(onlyStamp - onlyList) < 80);
  assert.ok(onlyAfterList > onlyList && onlyAfterList > onlyStamp);
  assert.ok(onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyAnswer > onlyAfterListHop);
  assert.ok(onlyBookOne > onlyAnswer && onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-list-after-book-one/);
  assert.doesNotMatch(laterCard, /data-list-venue/);
  assert.doesNotMatch(laterCard, /data-book-number-one|class="book-one"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const stamp = html.indexOf('data-list-after-book-one=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && stamp >= 0);
  assert.ok(Math.abs(stamp - listHop) < 80);
  assert.ok(afterList > listHop && afterList > stamp);
  assert.ok(afterBook > afterList && afterListHop > afterBook);
  assert.ok(first > afterListHop && answer > first && bookOne > answer);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-one-first=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(html, /class="list-venue"[^>]*href="#claim"/);
  assert.match(html, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, />List a venue</);
  assert.match(html, /after later Books/);
  assert.match(html, /after Book follows List/);
  assert.match(html, /after List follows Book/);
  assert.match(html, /after the list hop/);
  assert.match(html, /List a venue this weekend/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html.slice(laterHop), /data-list-after-book-one/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
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
