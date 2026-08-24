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
  assert.match(html, /data-empty-unpublished=""/);
  assert.match(html, /data-occupied="false"/);
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
  assert.match(html, /data-book-after-list-one=""/);
  assert.match(html, /data-book-after-list-two=""/);
  assert.match(html, /data-book-after-list-three=""/);
  assert.match(html, /data-book-after-list-four=""/);
  assert.match(html, /data-book-after-list-five=""/);
  assert.match(html, /data-book-after-list-six=""/);
  assert.match(html, /data-book-after-list-seven=""/);
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

test("occupied NYC board books #1 after List a venue without another Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-book-after-list-one/);
  assert.doesNotMatch(empty, /data-book-number-one|class="book-one"/);
  assert.doesNotMatch(empty, /data-list-after-book-one|data-list-venue/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[0] }),
  );
  const onlyCardFirst = onlyCard.indexOf('data-book-one-first=""');
  const onlyCardAnswer = onlyCard.indexOf("data-weekend-answer");
  const onlyCardBook = onlyCard.indexOf("data-book-number-one");
  const onlyCardStamp = onlyCard.indexOf('data-book-after-list-one=""');
  const onlyCardBid = onlyCard.indexOf('data-bid=""');
  assert.ok(onlyCardFirst >= 0 && onlyCardAnswer > onlyCardFirst);
  assert.ok(onlyCardBook > onlyCardAnswer && onlyCardStamp >= 0);
  assert.ok(Math.abs(onlyCardStamp - onlyCardBook) < 80);
  assert.ok(onlyCardBid > onlyCardBook);
  assert.match(onlyCard, /class="book-one"/);
  assert.match(onlyCard, /href="\/api\/click\/lst_top"/);
  assert.equal((onlyCard.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/class="book-one"/g) ?? []).length, 1);
  assert.doesNotMatch(onlyCard, /data-book-after-list=""|data-book-after-list-hop/);
  assert.doesNotMatch(onlyCard, /data-later-book|data-book-later|book-later/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyListStamp = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyFirst = onlyOne.indexOf('data-book-one-first=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyStamp = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyListStamp >= 0);
  assert.ok(Math.abs(onlyListStamp - onlyList) < 80);
  assert.ok(onlyAfterList > onlyList && onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyFirst > onlyAfterListHop);
  assert.ok(onlyAnswer > onlyFirst && onlyBookOne > onlyAnswer);
  assert.ok(onlyStamp >= 0 && Math.abs(onlyStamp - onlyBookOne) < 80);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-book-after-list-one/);
  assert.doesNotMatch(laterCard, /data-book-number-one|class="book-one"/);
  assert.doesNotMatch(laterCard, /data-list-after-book-one|data-list-venue/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const listStamp = html.indexOf('data-list-after-book-one=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const stamp = html.indexOf('data-book-after-list-one=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && listStamp >= 0);
  assert.ok(Math.abs(listStamp - listHop) < 80);
  assert.ok(afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && first > afterListHop);
  assert.ok(answer > first && bookOne > answer);
  assert.ok(stamp >= 0 && Math.abs(stamp - bookOne) < 80);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-one-first=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(html, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /class="list-venue"[^>]*href="#claim"/);
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
  assert.doesNotMatch(html.slice(laterHop), /data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board lists after Book #1 is re-concentrated without another Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-list-after-book-two/);
  assert.doesNotMatch(empty, /data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(empty, /data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyStamp = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyBookStamp = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyAfterOne >= 0 && onlyStamp >= 0);
  assert.ok(Math.abs(onlyAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyStamp - onlyList) < 120);
  assert.ok(onlyAfterList > onlyList && onlyAfterList > onlyStamp);
  assert.ok(onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyAnswer > onlyAfterListHop);
  assert.ok(onlyBookOne > onlyAnswer && onlyBookStamp >= 0);
  assert.ok(Math.abs(onlyBookStamp - onlyBookOne) < 80);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-list-after-book-two/);
  assert.doesNotMatch(laterCard, /data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(laterCard, /data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterOne = html.indexOf('data-list-after-book-one=""');
  const stamp = html.indexOf('data-list-after-book-two=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const bookStamp = html.indexOf('data-book-after-list-one=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterOne >= 0 && stamp >= 0);
  assert.ok(Math.abs(afterOne - listHop) < 80);
  assert.ok(Math.abs(stamp - listHop) < 120);
  assert.ok(afterList > listHop && afterList > stamp);
  assert.ok(afterBook > afterList && afterListHop > afterBook);
  assert.ok(first > afterListHop && answer > first && bookOne > answer);
  assert.ok(bookStamp >= 0 && Math.abs(bookStamp - bookOne) < 80);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
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
  assert.doesNotMatch(html.slice(laterHop), /data-list-after-book-two/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board books #1 after List a venue is re-concentrated without another Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-book-after-list-two/);
  assert.doesNotMatch(empty, /data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(empty, /data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[0] }),
  );
  const onlyCardFirst = onlyCard.indexOf('data-book-one-first=""');
  const onlyCardAnswer = onlyCard.indexOf("data-weekend-answer");
  const onlyCardBook = onlyCard.indexOf("data-book-number-one");
  const onlyCardAfterOne = onlyCard.indexOf('data-book-after-list-one=""');
  const onlyCardStamp = onlyCard.indexOf('data-book-after-list-two=""');
  const onlyCardBid = onlyCard.indexOf('data-bid=""');
  assert.ok(onlyCardFirst >= 0 && onlyCardAnswer > onlyCardFirst);
  assert.ok(onlyCardBook > onlyCardAnswer && onlyCardAfterOne >= 0 && onlyCardStamp >= 0);
  assert.ok(Math.abs(onlyCardAfterOne - onlyCardBook) < 80);
  assert.ok(Math.abs(onlyCardStamp - onlyCardBook) < 120);
  assert.ok(onlyCardBid > onlyCardBook);
  assert.match(onlyCard, /class="book-one"/);
  assert.match(onlyCard, /href="\/api\/click\/lst_top"/);
  assert.equal((onlyCard.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/class="book-one"/g) ?? []).length, 1);
  assert.doesNotMatch(onlyCard, /data-book-after-list=""|data-book-after-list-hop/);
  assert.doesNotMatch(onlyCard, /data-later-book|data-book-later|book-later/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyListAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyListStamp = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyFirst = onlyOne.indexOf('data-book-one-first=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyAfterOne = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyStamp = onlyOne.indexOf('data-book-after-list-two=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyListAfterOne >= 0 && onlyListStamp >= 0);
  assert.ok(Math.abs(onlyListAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyListStamp - onlyList) < 120);
  assert.ok(onlyAfterList > onlyList && onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyFirst > onlyAfterListHop);
  assert.ok(onlyAnswer > onlyFirst && onlyBookOne > onlyAnswer);
  assert.ok(onlyAfterOne >= 0 && Math.abs(onlyAfterOne - onlyBookOne) < 80);
  assert.ok(onlyStamp >= 0 && Math.abs(onlyStamp - onlyBookOne) < 120);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.equal((onlyOne.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-book-after-list-two/);
  assert.doesNotMatch(laterCard, /data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(laterCard, /data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const listAfterOne = html.indexOf('data-list-after-book-one=""');
  const listStamp = html.indexOf('data-list-after-book-two=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const afterOne = html.indexOf('data-book-after-list-one=""');
  const stamp = html.indexOf('data-book-after-list-two=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && listAfterOne >= 0 && listStamp >= 0);
  assert.ok(Math.abs(listAfterOne - listHop) < 80);
  assert.ok(Math.abs(listStamp - listHop) < 120);
  assert.ok(afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && first > afterListHop);
  assert.ok(answer > first && bookOne > answer);
  assert.ok(afterOne >= 0 && Math.abs(afterOne - bookOne) < 80);
  assert.ok(stamp >= 0 && Math.abs(stamp - bookOne) < 120);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-one-first=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(html, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /class="list-venue"[^>]*href="#claim"/);
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
  assert.doesNotMatch(html.slice(laterHop), /data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board lists after Book #1 is re-concentrated again without another Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-list-after-book-three/);
  assert.doesNotMatch(empty, /data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(empty, /data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyAfterTwo = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyStamp = onlyOne.indexOf('data-list-after-book-three=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyBookAfterOne = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyBookAfterTwo = onlyOne.indexOf('data-book-after-list-two=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyAfterOne >= 0 && onlyAfterTwo >= 0 && onlyStamp >= 0);
  assert.ok(Math.abs(onlyAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyAfterTwo - onlyList) < 120);
  assert.ok(Math.abs(onlyStamp - onlyList) < 160);
  assert.ok(onlyAfterList > onlyList && onlyAfterList > onlyStamp);
  assert.ok(onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyAnswer > onlyAfterListHop);
  assert.ok(onlyBookOne > onlyAnswer && onlyBookAfterOne >= 0 && onlyBookAfterTwo >= 0);
  assert.ok(Math.abs(onlyBookAfterOne - onlyBookOne) < 80);
  assert.ok(Math.abs(onlyBookAfterTwo - onlyBookOne) < 120);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.equal((onlyOne.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-list-after-book-three/);
  assert.doesNotMatch(laterCard, /data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(laterCard, /data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterOne = html.indexOf('data-list-after-book-one=""');
  const afterTwo = html.indexOf('data-list-after-book-two=""');
  const stamp = html.indexOf('data-list-after-book-three=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const bookAfterOne = html.indexOf('data-book-after-list-one=""');
  const bookAfterTwo = html.indexOf('data-book-after-list-two=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterOne >= 0 && afterTwo >= 0 && stamp >= 0);
  assert.ok(Math.abs(afterOne - listHop) < 80);
  assert.ok(Math.abs(afterTwo - listHop) < 120);
  assert.ok(Math.abs(stamp - listHop) < 160);
  assert.ok(afterList > listHop && afterList > stamp);
  assert.ok(afterBook > afterList && afterListHop > afterBook);
  assert.ok(first > afterListHop && answer > first && bookOne > answer);
  assert.ok(bookAfterOne >= 0 && Math.abs(bookAfterOne - bookOne) < 80);
  assert.ok(bookAfterTwo >= 0 && Math.abs(bookAfterTwo - bookOne) < 120);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
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
  assert.doesNotMatch(html.slice(laterHop), /data-list-after-book-three/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board books #1 after List a venue is re-concentrated again without another Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-book-after-list-three/);
  assert.doesNotMatch(empty, /data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(empty, /data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[0] }),
  );
  const onlyCardFirst = onlyCard.indexOf('data-book-one-first=""');
  const onlyCardAnswer = onlyCard.indexOf("data-weekend-answer");
  const onlyCardBook = onlyCard.indexOf("data-book-number-one");
  const onlyCardAfterOne = onlyCard.indexOf('data-book-after-list-one=""');
  const onlyCardAfterTwo = onlyCard.indexOf('data-book-after-list-two=""');
  const onlyCardStamp = onlyCard.indexOf('data-book-after-list-three=""');
  const onlyCardBid = onlyCard.indexOf('data-bid=""');
  assert.ok(onlyCardFirst >= 0 && onlyCardAnswer > onlyCardFirst);
  assert.ok(onlyCardBook > onlyCardAnswer && onlyCardAfterOne >= 0 && onlyCardAfterTwo >= 0 && onlyCardStamp >= 0);
  assert.ok(Math.abs(onlyCardAfterOne - onlyCardBook) < 80);
  assert.ok(Math.abs(onlyCardAfterTwo - onlyCardBook) < 120);
  assert.ok(Math.abs(onlyCardStamp - onlyCardBook) < 160);
  assert.ok(onlyCardBid > onlyCardBook);
  assert.match(onlyCard, /class="book-one"/);
  assert.match(onlyCard, /href="\/api\/click\/lst_top"/);
  assert.equal((onlyCard.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/class="book-one"/g) ?? []).length, 1);
  assert.doesNotMatch(onlyCard, /data-book-after-list=""|data-book-after-list-hop/);
  assert.doesNotMatch(onlyCard, /data-later-book|data-book-later|book-later/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyListAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyListAfterTwo = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyListStamp = onlyOne.indexOf('data-list-after-book-three=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyFirst = onlyOne.indexOf('data-book-one-first=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyAfterOne = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyAfterTwo = onlyOne.indexOf('data-book-after-list-two=""');
  const onlyStamp = onlyOne.indexOf('data-book-after-list-three=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyListAfterOne >= 0 && onlyListAfterTwo >= 0 && onlyListStamp >= 0);
  assert.ok(Math.abs(onlyListAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyListAfterTwo - onlyList) < 120);
  assert.ok(Math.abs(onlyListStamp - onlyList) < 160);
  assert.ok(onlyAfterList > onlyList && onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyFirst > onlyAfterListHop);
  assert.ok(onlyAnswer > onlyFirst && onlyBookOne > onlyAnswer);
  assert.ok(onlyAfterOne >= 0 && Math.abs(onlyAfterOne - onlyBookOne) < 80);
  assert.ok(onlyAfterTwo >= 0 && Math.abs(onlyAfterTwo - onlyBookOne) < 120);
  assert.ok(onlyStamp >= 0 && Math.abs(onlyStamp - onlyBookOne) < 160);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.equal((onlyOne.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-book-after-list-three/);
  assert.doesNotMatch(laterCard, /data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(laterCard, /data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const listAfterOne = html.indexOf('data-list-after-book-one=""');
  const listAfterTwo = html.indexOf('data-list-after-book-two=""');
  const listStamp = html.indexOf('data-list-after-book-three=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const afterOne = html.indexOf('data-book-after-list-one=""');
  const afterTwo = html.indexOf('data-book-after-list-two=""');
  const stamp = html.indexOf('data-book-after-list-three=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && listAfterOne >= 0 && listAfterTwo >= 0 && listStamp >= 0);
  assert.ok(Math.abs(listAfterOne - listHop) < 80);
  assert.ok(Math.abs(listAfterTwo - listHop) < 120);
  assert.ok(Math.abs(listStamp - listHop) < 160);
  assert.ok(afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && first > afterListHop);
  assert.ok(answer > first && bookOne > answer);
  assert.ok(afterOne >= 0 && Math.abs(afterOne - bookOne) < 80);
  assert.ok(afterTwo >= 0 && Math.abs(afterTwo - bookOne) < 120);
  assert.ok(stamp >= 0 && Math.abs(stamp - bookOne) < 160);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-one-first=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(html, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /class="list-venue"[^>]*href="#claim"/);
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
  assert.doesNotMatch(html.slice(laterHop), /data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board lists after the louder Book #1 without another Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-list-after-book-four/);
  assert.doesNotMatch(empty, /data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(empty, /data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyAfterTwo = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyAfterThree = onlyOne.indexOf('data-list-after-book-three=""');
  const onlyStamp = onlyOne.indexOf('data-list-after-book-four=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyBookAfterOne = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyBookAfterTwo = onlyOne.indexOf('data-book-after-list-two=""');
  const onlyBookAfterThree = onlyOne.indexOf('data-book-after-list-three=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyAfterOne >= 0 && onlyAfterTwo >= 0 && onlyAfterThree >= 0 && onlyStamp >= 0);
  assert.ok(Math.abs(onlyAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyAfterTwo - onlyList) < 120);
  assert.ok(Math.abs(onlyAfterThree - onlyList) < 160);
  assert.ok(Math.abs(onlyStamp - onlyList) < 200);
  assert.ok(onlyAfterList > onlyList && onlyAfterList > onlyStamp);
  assert.ok(onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyAnswer > onlyAfterListHop);
  assert.ok(onlyBookOne > onlyAnswer && onlyBookAfterOne >= 0 && onlyBookAfterTwo >= 0 && onlyBookAfterThree >= 0);
  assert.ok(Math.abs(onlyBookAfterOne - onlyBookOne) < 80);
  assert.ok(Math.abs(onlyBookAfterTwo - onlyBookOne) < 120);
  assert.ok(Math.abs(onlyBookAfterThree - onlyBookOne) < 160);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.equal((onlyOne.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-list-after-book-four/);
  assert.doesNotMatch(laterCard, /data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(laterCard, /data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterOne = html.indexOf('data-list-after-book-one=""');
  const afterTwo = html.indexOf('data-list-after-book-two=""');
  const afterThree = html.indexOf('data-list-after-book-three=""');
  const stamp = html.indexOf('data-list-after-book-four=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const bookAfterOne = html.indexOf('data-book-after-list-one=""');
  const bookAfterTwo = html.indexOf('data-book-after-list-two=""');
  const bookAfterThree = html.indexOf('data-book-after-list-three=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterOne >= 0 && afterTwo >= 0 && afterThree >= 0 && stamp >= 0);
  assert.ok(Math.abs(afterOne - listHop) < 80);
  assert.ok(Math.abs(afterTwo - listHop) < 120);
  assert.ok(Math.abs(afterThree - listHop) < 160);
  assert.ok(Math.abs(stamp - listHop) < 200);
  assert.ok(afterList > listHop && afterList > stamp);
  assert.ok(afterBook > afterList && afterListHop > afterBook);
  assert.ok(first > afterListHop && answer > first && bookOne > answer);
  assert.ok(bookAfterOne >= 0 && Math.abs(bookAfterOne - bookOne) < 80);
  assert.ok(bookAfterTwo >= 0 && Math.abs(bookAfterTwo - bookOne) < 120);
  assert.ok(bookAfterThree >= 0 && Math.abs(bookAfterThree - bookOne) < 160);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
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
  assert.doesNotMatch(html.slice(laterHop), /data-list-after-book-four/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board books #1 after the louder List a venue without another Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-book-after-list-four/);
  assert.doesNotMatch(empty, /data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(empty, /data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[0] }),
  );
  const onlyCardFirst = onlyCard.indexOf('data-book-one-first=""');
  const onlyCardAnswer = onlyCard.indexOf("data-weekend-answer");
  const onlyCardBook = onlyCard.indexOf("data-book-number-one");
  const onlyCardAfterOne = onlyCard.indexOf('data-book-after-list-one=""');
  const onlyCardAfterTwo = onlyCard.indexOf('data-book-after-list-two=""');
  const onlyCardAfterThree = onlyCard.indexOf('data-book-after-list-three=""');
  const onlyCardStamp = onlyCard.indexOf('data-book-after-list-four=""');
  const onlyCardBid = onlyCard.indexOf('data-bid=""');
  assert.ok(onlyCardFirst >= 0 && onlyCardAnswer > onlyCardFirst);
  assert.ok(onlyCardBook > onlyCardAnswer && onlyCardAfterOne >= 0 && onlyCardAfterTwo >= 0 && onlyCardAfterThree >= 0 && onlyCardStamp >= 0);
  assert.ok(Math.abs(onlyCardAfterOne - onlyCardBook) < 80);
  assert.ok(Math.abs(onlyCardAfterTwo - onlyCardBook) < 120);
  assert.ok(Math.abs(onlyCardAfterThree - onlyCardBook) < 160);
  assert.ok(Math.abs(onlyCardStamp - onlyCardBook) < 200);
  assert.ok(onlyCardBid > onlyCardBook);
  assert.match(onlyCard, /class="book-one"/);
  assert.match(onlyCard, /href="\/api\/click\/lst_top"/);
  assert.equal((onlyCard.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/class="book-one"/g) ?? []).length, 1);
  assert.doesNotMatch(onlyCard, /data-book-after-list=""|data-book-after-list-hop/);
  assert.doesNotMatch(onlyCard, /data-later-book|data-book-later|book-later/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyListAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyListAfterTwo = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyListAfterThree = onlyOne.indexOf('data-list-after-book-three=""');
  const onlyListStamp = onlyOne.indexOf('data-list-after-book-four=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyFirst = onlyOne.indexOf('data-book-one-first=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyAfterOne = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyAfterTwo = onlyOne.indexOf('data-book-after-list-two=""');
  const onlyAfterThree = onlyOne.indexOf('data-book-after-list-three=""');
  const onlyStamp = onlyOne.indexOf('data-book-after-list-four=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyListAfterOne >= 0 && onlyListAfterTwo >= 0 && onlyListAfterThree >= 0 && onlyListStamp >= 0);
  assert.ok(Math.abs(onlyListAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyListAfterTwo - onlyList) < 120);
  assert.ok(Math.abs(onlyListAfterThree - onlyList) < 160);
  assert.ok(Math.abs(onlyListStamp - onlyList) < 200);
  assert.ok(onlyAfterList > onlyList && onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyFirst > onlyAfterListHop);
  assert.ok(onlyAnswer > onlyFirst && onlyBookOne > onlyAnswer);
  assert.ok(onlyAfterOne >= 0 && Math.abs(onlyAfterOne - onlyBookOne) < 80);
  assert.ok(onlyAfterTwo >= 0 && Math.abs(onlyAfterTwo - onlyBookOne) < 120);
  assert.ok(onlyAfterThree >= 0 && Math.abs(onlyAfterThree - onlyBookOne) < 160);
  assert.ok(onlyStamp >= 0 && Math.abs(onlyStamp - onlyBookOne) < 200);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.equal((onlyOne.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-book-after-list-four/);
  assert.doesNotMatch(laterCard, /data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(laterCard, /data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const listAfterOne = html.indexOf('data-list-after-book-one=""');
  const listAfterTwo = html.indexOf('data-list-after-book-two=""');
  const listAfterThree = html.indexOf('data-list-after-book-three=""');
  const listStamp = html.indexOf('data-list-after-book-four=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const afterOne = html.indexOf('data-book-after-list-one=""');
  const afterTwo = html.indexOf('data-book-after-list-two=""');
  const afterThree = html.indexOf('data-book-after-list-three=""');
  const stamp = html.indexOf('data-book-after-list-four=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && listAfterOne >= 0 && listAfterTwo >= 0 && listAfterThree >= 0 && listStamp >= 0);
  assert.ok(Math.abs(listAfterOne - listHop) < 80);
  assert.ok(Math.abs(listAfterTwo - listHop) < 120);
  assert.ok(Math.abs(listAfterThree - listHop) < 160);
  assert.ok(Math.abs(listStamp - listHop) < 200);
  assert.ok(afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && first > afterListHop);
  assert.ok(answer > first && bookOne > answer);
  assert.ok(afterOne >= 0 && Math.abs(afterOne - bookOne) < 80);
  assert.ok(afterTwo >= 0 && Math.abs(afterTwo - bookOne) < 120);
  assert.ok(afterThree >= 0 && Math.abs(afterThree - bookOne) < 160);
  assert.ok(stamp >= 0 && Math.abs(stamp - bookOne) < 200);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-one-first=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(html, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /class="list-venue"[^>]*href="#claim"/);
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
  assert.doesNotMatch(html.slice(laterHop), /data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board lists after the louder Book #1 is re-concentrated again without another Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-list-after-book-five/);
  assert.doesNotMatch(empty, /data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(empty, /data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyAfterTwo = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyAfterThree = onlyOne.indexOf('data-list-after-book-three=""');
  const onlyAfterFour = onlyOne.indexOf('data-list-after-book-four=""');
  const onlyStamp = onlyOne.indexOf('data-list-after-book-five=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyBookAfterOne = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyBookAfterTwo = onlyOne.indexOf('data-book-after-list-two=""');
  const onlyBookAfterThree = onlyOne.indexOf('data-book-after-list-three=""');
  const onlyBookAfterFour = onlyOne.indexOf('data-book-after-list-four=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyAfterOne >= 0 && onlyAfterTwo >= 0 && onlyAfterThree >= 0 && onlyAfterFour >= 0 && onlyStamp >= 0);
  assert.ok(Math.abs(onlyAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyAfterTwo - onlyList) < 120);
  assert.ok(Math.abs(onlyAfterThree - onlyList) < 160);
  assert.ok(Math.abs(onlyAfterFour - onlyList) < 200);
  assert.ok(Math.abs(onlyStamp - onlyList) < 240);
  assert.ok(onlyAfterList > onlyList && onlyAfterList > onlyStamp);
  assert.ok(onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyAnswer > onlyAfterListHop);
  assert.ok(onlyBookOne > onlyAnswer && onlyBookAfterOne >= 0 && onlyBookAfterTwo >= 0 && onlyBookAfterThree >= 0 && onlyBookAfterFour >= 0);
  assert.ok(Math.abs(onlyBookAfterOne - onlyBookOne) < 80);
  assert.ok(Math.abs(onlyBookAfterTwo - onlyBookOne) < 120);
  assert.ok(Math.abs(onlyBookAfterThree - onlyBookOne) < 160);
  assert.ok(Math.abs(onlyBookAfterFour - onlyBookOne) < 200);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.equal((onlyOne.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-list-after-book-five/);
  assert.doesNotMatch(laterCard, /data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(laterCard, /data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterOne = html.indexOf('data-list-after-book-one=""');
  const afterTwo = html.indexOf('data-list-after-book-two=""');
  const afterThree = html.indexOf('data-list-after-book-three=""');
  const afterFour = html.indexOf('data-list-after-book-four=""');
  const stamp = html.indexOf('data-list-after-book-five=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const bookAfterOne = html.indexOf('data-book-after-list-one=""');
  const bookAfterTwo = html.indexOf('data-book-after-list-two=""');
  const bookAfterThree = html.indexOf('data-book-after-list-three=""');
  const bookAfterFour = html.indexOf('data-book-after-list-four=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterOne >= 0 && afterTwo >= 0 && afterThree >= 0 && afterFour >= 0 && stamp >= 0);
  assert.ok(Math.abs(afterOne - listHop) < 80);
  assert.ok(Math.abs(afterTwo - listHop) < 120);
  assert.ok(Math.abs(afterThree - listHop) < 160);
  assert.ok(Math.abs(afterFour - listHop) < 200);
  assert.ok(Math.abs(stamp - listHop) < 240);
  assert.ok(afterList > listHop && afterList > stamp);
  assert.ok(afterBook > afterList && afterListHop > afterBook);
  assert.ok(first > afterListHop && answer > first && bookOne > answer);
  assert.ok(bookAfterOne >= 0 && Math.abs(bookAfterOne - bookOne) < 80);
  assert.ok(bookAfterTwo >= 0 && Math.abs(bookAfterTwo - bookOne) < 120);
  assert.ok(bookAfterThree >= 0 && Math.abs(bookAfterThree - bookOne) < 160);
  assert.ok(bookAfterFour >= 0 && Math.abs(bookAfterFour - bookOne) < 200);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
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
  assert.doesNotMatch(html.slice(laterHop), /data-list-after-book-five/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board books #1 after the louder List a venue is re-concentrated again without another Book", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-book-after-list-five/);
  assert.doesNotMatch(empty, /data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(empty, /data-list-after-book-five|data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[0] }),
  );
  const onlyCardFirst = onlyCard.indexOf('data-book-one-first=""');
  const onlyCardAnswer = onlyCard.indexOf("data-weekend-answer");
  const onlyCardBook = onlyCard.indexOf("data-book-number-one");
  const onlyCardAfterOne = onlyCard.indexOf('data-book-after-list-one=""');
  const onlyCardAfterTwo = onlyCard.indexOf('data-book-after-list-two=""');
  const onlyCardAfterThree = onlyCard.indexOf('data-book-after-list-three=""');
  const onlyCardAfterFour = onlyCard.indexOf('data-book-after-list-four=""');
  const onlyCardStamp = onlyCard.indexOf('data-book-after-list-five=""');
  const onlyCardBid = onlyCard.indexOf('data-bid=""');
  assert.ok(onlyCardFirst >= 0 && onlyCardAnswer > onlyCardFirst);
  assert.ok(onlyCardBook > onlyCardAnswer && onlyCardAfterOne >= 0 && onlyCardAfterTwo >= 0 && onlyCardAfterThree >= 0 && onlyCardAfterFour >= 0 && onlyCardStamp >= 0);
  assert.ok(Math.abs(onlyCardAfterOne - onlyCardBook) < 80);
  assert.ok(Math.abs(onlyCardAfterTwo - onlyCardBook) < 120);
  assert.ok(Math.abs(onlyCardAfterThree - onlyCardBook) < 160);
  assert.ok(Math.abs(onlyCardAfterFour - onlyCardBook) < 200);
  assert.ok(Math.abs(onlyCardStamp - onlyCardBook) < 240);
  assert.ok(onlyCardBid > onlyCardBook);
  assert.match(onlyCard, /class="book-one"/);
  assert.match(onlyCard, /href="\/api\/click\/lst_top"/);
  assert.equal((onlyCard.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/class="book-one"/g) ?? []).length, 1);
  assert.doesNotMatch(onlyCard, /data-book-after-list=""|data-book-after-list-hop/);
  assert.doesNotMatch(onlyCard, /data-later-book|data-book-later|book-later/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyListAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyListAfterTwo = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyListAfterThree = onlyOne.indexOf('data-list-after-book-three=""');
  const onlyListAfterFour = onlyOne.indexOf('data-list-after-book-four=""');
  const onlyListStamp = onlyOne.indexOf('data-list-after-book-five=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyFirst = onlyOne.indexOf('data-book-one-first=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyAfterOne = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyAfterTwo = onlyOne.indexOf('data-book-after-list-two=""');
  const onlyAfterThree = onlyOne.indexOf('data-book-after-list-three=""');
  const onlyAfterFour = onlyOne.indexOf('data-book-after-list-four=""');
  const onlyStamp = onlyOne.indexOf('data-book-after-list-five=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyListAfterOne >= 0 && onlyListAfterTwo >= 0 && onlyListAfterThree >= 0 && onlyListAfterFour >= 0 && onlyListStamp >= 0);
  assert.ok(Math.abs(onlyListAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyListAfterTwo - onlyList) < 120);
  assert.ok(Math.abs(onlyListAfterThree - onlyList) < 160);
  assert.ok(Math.abs(onlyListAfterFour - onlyList) < 200);
  assert.ok(Math.abs(onlyListStamp - onlyList) < 240);
  assert.ok(onlyAfterList > onlyList && onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyFirst > onlyAfterListHop);
  assert.ok(onlyAnswer > onlyFirst && onlyBookOne > onlyAnswer);
  assert.ok(onlyAfterOne >= 0 && Math.abs(onlyAfterOne - onlyBookOne) < 80);
  assert.ok(onlyAfterTwo >= 0 && Math.abs(onlyAfterTwo - onlyBookOne) < 120);
  assert.ok(onlyAfterThree >= 0 && Math.abs(onlyAfterThree - onlyBookOne) < 160);
  assert.ok(onlyAfterFour >= 0 && Math.abs(onlyAfterFour - onlyBookOne) < 200);
  assert.ok(onlyStamp >= 0 && Math.abs(onlyStamp - onlyBookOne) < 240);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.equal((onlyOne.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-book-after-list-five/);
  assert.doesNotMatch(laterCard, /data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(laterCard, /data-list-after-book-five|data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const listAfterOne = html.indexOf('data-list-after-book-one=""');
  const listAfterTwo = html.indexOf('data-list-after-book-two=""');
  const listAfterThree = html.indexOf('data-list-after-book-three=""');
  const listAfterFour = html.indexOf('data-list-after-book-four=""');
  const listStamp = html.indexOf('data-list-after-book-five=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const afterOne = html.indexOf('data-book-after-list-one=""');
  const afterTwo = html.indexOf('data-book-after-list-two=""');
  const afterThree = html.indexOf('data-book-after-list-three=""');
  const afterFour = html.indexOf('data-book-after-list-four=""');
  const stamp = html.indexOf('data-book-after-list-five=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && listAfterOne >= 0 && listAfterTwo >= 0 && listAfterThree >= 0 && listAfterFour >= 0 && listStamp >= 0);
  assert.ok(Math.abs(listAfterOne - listHop) < 80);
  assert.ok(Math.abs(listAfterTwo - listHop) < 120);
  assert.ok(Math.abs(listAfterThree - listHop) < 160);
  assert.ok(Math.abs(listAfterFour - listHop) < 200);
  assert.ok(Math.abs(listStamp - listHop) < 240);
  assert.ok(afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && first > afterListHop);
  assert.ok(answer > first && bookOne > answer);
  assert.ok(afterOne >= 0 && Math.abs(afterOne - bookOne) < 80);
  assert.ok(afterTwo >= 0 && Math.abs(afterTwo - bookOne) < 120);
  assert.ok(afterThree >= 0 && Math.abs(afterThree - bookOne) < 160);
  assert.ok(afterFour >= 0 && Math.abs(afterFour - bookOne) < 200);
  assert.ok(stamp >= 0 && Math.abs(stamp - bookOne) < 240);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-one-first=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(html, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /class="list-venue"[^>]*href="#claim"/);
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
  assert.doesNotMatch(html.slice(laterHop), /data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board lists after Book #1 is re-concentrated again without another List", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-list-after-book-six/);
  assert.doesNotMatch(empty, /data-list-after-book-five|data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(empty, /data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyAfterTwo = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyAfterThree = onlyOne.indexOf('data-list-after-book-three=""');
  const onlyAfterFour = onlyOne.indexOf('data-list-after-book-four=""');
  const onlyAfterFive = onlyOne.indexOf('data-list-after-book-five=""');
  const onlyStamp = onlyOne.indexOf('data-list-after-book-six=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyBookAfterOne = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyBookAfterTwo = onlyOne.indexOf('data-book-after-list-two=""');
  const onlyBookAfterThree = onlyOne.indexOf('data-book-after-list-three=""');
  const onlyBookAfterFour = onlyOne.indexOf('data-book-after-list-four=""');
  const onlyBookAfterFive = onlyOne.indexOf('data-book-after-list-five=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyAfterOne >= 0 && onlyAfterTwo >= 0 && onlyAfterThree >= 0 && onlyAfterFour >= 0 && onlyAfterFive >= 0 && onlyStamp >= 0);
  assert.ok(Math.abs(onlyAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyAfterTwo - onlyList) < 120);
  assert.ok(Math.abs(onlyAfterThree - onlyList) < 160);
  assert.ok(Math.abs(onlyAfterFour - onlyList) < 200);
  assert.ok(Math.abs(onlyAfterFive - onlyList) < 240);
  assert.ok(Math.abs(onlyStamp - onlyList) < 280);
  assert.ok(onlyAfterList > onlyList && onlyAfterList > onlyStamp);
  assert.ok(onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyAnswer > onlyAfterListHop);
  assert.ok(onlyBookOne > onlyAnswer && onlyBookAfterOne >= 0 && onlyBookAfterTwo >= 0 && onlyBookAfterThree >= 0 && onlyBookAfterFour >= 0 && onlyBookAfterFive >= 0);
  assert.ok(Math.abs(onlyBookAfterOne - onlyBookOne) < 80);
  assert.ok(Math.abs(onlyBookAfterTwo - onlyBookOne) < 120);
  assert.ok(Math.abs(onlyBookAfterThree - onlyBookOne) < 160);
  assert.ok(Math.abs(onlyBookAfterFour - onlyBookOne) < 200);
  assert.ok(Math.abs(onlyBookAfterFive - onlyBookOne) < 240);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.equal((onlyOne.match(/data-list-after-book-six=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-list-after-book-six/);
  assert.doesNotMatch(laterCard, /data-list-after-book-five|data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(laterCard, /data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterOne = html.indexOf('data-list-after-book-one=""');
  const afterTwo = html.indexOf('data-list-after-book-two=""');
  const afterThree = html.indexOf('data-list-after-book-three=""');
  const afterFour = html.indexOf('data-list-after-book-four=""');
  const afterFive = html.indexOf('data-list-after-book-five=""');
  const stamp = html.indexOf('data-list-after-book-six=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const bookAfterOne = html.indexOf('data-book-after-list-one=""');
  const bookAfterTwo = html.indexOf('data-book-after-list-two=""');
  const bookAfterThree = html.indexOf('data-book-after-list-three=""');
  const bookAfterFour = html.indexOf('data-book-after-list-four=""');
  const bookAfterFive = html.indexOf('data-book-after-list-five=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterOne >= 0 && afterTwo >= 0 && afterThree >= 0 && afterFour >= 0 && afterFive >= 0 && stamp >= 0);
  assert.ok(Math.abs(afterOne - listHop) < 80);
  assert.ok(Math.abs(afterTwo - listHop) < 120);
  assert.ok(Math.abs(afterThree - listHop) < 160);
  assert.ok(Math.abs(afterFour - listHop) < 200);
  assert.ok(Math.abs(afterFive - listHop) < 240);
  assert.ok(Math.abs(stamp - listHop) < 280);
  assert.ok(afterList > listHop && afterList > stamp);
  assert.ok(afterBook > afterList && afterListHop > afterBook);
  assert.ok(first > afterListHop && answer > first && bookOne > answer);
  assert.ok(bookAfterOne >= 0 && Math.abs(bookAfterOne - bookOne) < 80);
  assert.ok(bookAfterTwo >= 0 && Math.abs(bookAfterTwo - bookOne) < 120);
  assert.ok(bookAfterThree >= 0 && Math.abs(bookAfterThree - bookOne) < 160);
  assert.ok(bookAfterFour >= 0 && Math.abs(bookAfterFour - bookOne) < 200);
  assert.ok(bookAfterFive >= 0 && Math.abs(bookAfterFive - bookOne) < 240);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-list-after-book-six=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
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
  assert.doesNotMatch(html.slice(laterHop), /data-list-after-book-six/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board books #1 after List a venue is re-concentrated again without another Book hop", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-book-after-list-six/);
  assert.doesNotMatch(empty, /data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(empty, /data-list-after-book-six|data-list-after-book-five|data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[0] }),
  );
  const onlyCardFirst = onlyCard.indexOf('data-book-one-first=""');
  const onlyCardAnswer = onlyCard.indexOf("data-weekend-answer");
  const onlyCardBook = onlyCard.indexOf("data-book-number-one");
  const onlyCardAfterOne = onlyCard.indexOf('data-book-after-list-one=""');
  const onlyCardAfterTwo = onlyCard.indexOf('data-book-after-list-two=""');
  const onlyCardAfterThree = onlyCard.indexOf('data-book-after-list-three=""');
  const onlyCardAfterFour = onlyCard.indexOf('data-book-after-list-four=""');
  const onlyCardAfterFive = onlyCard.indexOf('data-book-after-list-five=""');
  const onlyCardStamp = onlyCard.indexOf('data-book-after-list-six=""');
  const onlyCardBid = onlyCard.indexOf('data-bid=""');
  assert.ok(onlyCardFirst >= 0 && onlyCardAnswer > onlyCardFirst);
  assert.ok(onlyCardBook > onlyCardAnswer && onlyCardAfterOne >= 0 && onlyCardAfterTwo >= 0 && onlyCardAfterThree >= 0 && onlyCardAfterFour >= 0 && onlyCardAfterFive >= 0 && onlyCardStamp >= 0);
  assert.ok(Math.abs(onlyCardAfterOne - onlyCardBook) < 80);
  assert.ok(Math.abs(onlyCardAfterTwo - onlyCardBook) < 120);
  assert.ok(Math.abs(onlyCardAfterThree - onlyCardBook) < 160);
  assert.ok(Math.abs(onlyCardAfterFour - onlyCardBook) < 200);
  assert.ok(Math.abs(onlyCardAfterFive - onlyCardBook) < 240);
  assert.ok(Math.abs(onlyCardStamp - onlyCardBook) < 280);
  assert.ok(onlyCardBid > onlyCardBook);
  assert.match(onlyCard, /class="book-one"/);
  assert.match(onlyCard, /href="\/api\/click\/lst_top"/);
  assert.equal((onlyCard.match(/data-book-after-list-six=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/class="book-one"/g) ?? []).length, 1);
  assert.doesNotMatch(onlyCard, /data-book-after-list=""|data-book-after-list-hop/);
  assert.doesNotMatch(onlyCard, /data-later-book|data-book-later|book-later/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyListAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyListAfterTwo = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyListAfterThree = onlyOne.indexOf('data-list-after-book-three=""');
  const onlyListAfterFour = onlyOne.indexOf('data-list-after-book-four=""');
  const onlyListAfterFive = onlyOne.indexOf('data-list-after-book-five=""');
  const onlyListStamp = onlyOne.indexOf('data-list-after-book-six=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyFirst = onlyOne.indexOf('data-book-one-first=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyAfterOne = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyAfterTwo = onlyOne.indexOf('data-book-after-list-two=""');
  const onlyAfterThree = onlyOne.indexOf('data-book-after-list-three=""');
  const onlyAfterFour = onlyOne.indexOf('data-book-after-list-four=""');
  const onlyAfterFive = onlyOne.indexOf('data-book-after-list-five=""');
  const onlyStamp = onlyOne.indexOf('data-book-after-list-six=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyListAfterOne >= 0 && onlyListAfterTwo >= 0 && onlyListAfterThree >= 0 && onlyListAfterFour >= 0 && onlyListAfterFive >= 0 && onlyListStamp >= 0);
  assert.ok(Math.abs(onlyListAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyListAfterTwo - onlyList) < 120);
  assert.ok(Math.abs(onlyListAfterThree - onlyList) < 160);
  assert.ok(Math.abs(onlyListAfterFour - onlyList) < 200);
  assert.ok(Math.abs(onlyListAfterFive - onlyList) < 240);
  assert.ok(Math.abs(onlyListStamp - onlyList) < 280);
  assert.ok(onlyAfterList > onlyList && onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyFirst > onlyAfterListHop);
  assert.ok(onlyAnswer > onlyFirst && onlyBookOne > onlyAnswer);
  assert.ok(onlyAfterOne >= 0 && Math.abs(onlyAfterOne - onlyBookOne) < 80);
  assert.ok(onlyAfterTwo >= 0 && Math.abs(onlyAfterTwo - onlyBookOne) < 120);
  assert.ok(onlyAfterThree >= 0 && Math.abs(onlyAfterThree - onlyBookOne) < 160);
  assert.ok(onlyAfterFour >= 0 && Math.abs(onlyAfterFour - onlyBookOne) < 200);
  assert.ok(onlyAfterFive >= 0 && Math.abs(onlyAfterFive - onlyBookOne) < 240);
  assert.ok(onlyStamp >= 0 && Math.abs(onlyStamp - onlyBookOne) < 280);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.equal((onlyOne.match(/data-book-after-list-six=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-six=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-book-after-list-six/);
  assert.doesNotMatch(laterCard, /data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(laterCard, /data-list-after-book-six|data-list-after-book-five|data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const listAfterOne = html.indexOf('data-list-after-book-one=""');
  const listAfterTwo = html.indexOf('data-list-after-book-two=""');
  const listAfterThree = html.indexOf('data-list-after-book-three=""');
  const listAfterFour = html.indexOf('data-list-after-book-four=""');
  const listAfterFive = html.indexOf('data-list-after-book-five=""');
  const listStamp = html.indexOf('data-list-after-book-six=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const afterOne = html.indexOf('data-book-after-list-one=""');
  const afterTwo = html.indexOf('data-book-after-list-two=""');
  const afterThree = html.indexOf('data-book-after-list-three=""');
  const afterFour = html.indexOf('data-book-after-list-four=""');
  const afterFive = html.indexOf('data-book-after-list-five=""');
  const stamp = html.indexOf('data-book-after-list-six=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && listAfterOne >= 0 && listAfterTwo >= 0 && listAfterThree >= 0 && listAfterFour >= 0 && listAfterFive >= 0 && listStamp >= 0);
  assert.ok(Math.abs(listAfterOne - listHop) < 80);
  assert.ok(Math.abs(listAfterTwo - listHop) < 120);
  assert.ok(Math.abs(listAfterThree - listHop) < 160);
  assert.ok(Math.abs(listAfterFour - listHop) < 200);
  assert.ok(Math.abs(listAfterFive - listHop) < 240);
  assert.ok(Math.abs(listStamp - listHop) < 280);
  assert.ok(afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && first > afterListHop);
  assert.ok(answer > first && bookOne > answer);
  assert.ok(afterOne >= 0 && Math.abs(afterOne - bookOne) < 80);
  assert.ok(afterTwo >= 0 && Math.abs(afterTwo - bookOne) < 120);
  assert.ok(afterThree >= 0 && Math.abs(afterThree - bookOne) < 160);
  assert.ok(afterFour >= 0 && Math.abs(afterFour - bookOne) < 200);
  assert.ok(afterFive >= 0 && Math.abs(afterFive - bookOne) < 240);
  assert.ok(stamp >= 0 && Math.abs(stamp - bookOne) < 280);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-book-after-list-six=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-one-first=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-six=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(html, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /class="list-venue"[^>]*href="#claim"/);
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
  assert.doesNotMatch(html.slice(laterHop), /data-book-after-list-six|data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board lists after Book #1 is re-concentrated again without another List hop", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-list-after-book-seven/);
  assert.doesNotMatch(empty, /data-list-after-book-six|data-list-after-book-five|data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(empty, /data-book-after-list-six|data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyAfterTwo = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyAfterThree = onlyOne.indexOf('data-list-after-book-three=""');
  const onlyAfterFour = onlyOne.indexOf('data-list-after-book-four=""');
  const onlyAfterFive = onlyOne.indexOf('data-list-after-book-five=""');
  const onlyAfterSix = onlyOne.indexOf('data-list-after-book-six=""');
  const onlyStamp = onlyOne.indexOf('data-list-after-book-seven=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyBookAfterOne = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyBookAfterTwo = onlyOne.indexOf('data-book-after-list-two=""');
  const onlyBookAfterThree = onlyOne.indexOf('data-book-after-list-three=""');
  const onlyBookAfterFour = onlyOne.indexOf('data-book-after-list-four=""');
  const onlyBookAfterFive = onlyOne.indexOf('data-book-after-list-five=""');
  const onlyBookAfterSix = onlyOne.indexOf('data-book-after-list-six=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyAfterOne >= 0 && onlyAfterTwo >= 0 && onlyAfterThree >= 0 && onlyAfterFour >= 0 && onlyAfterFive >= 0 && onlyAfterSix >= 0 && onlyStamp >= 0);
  assert.ok(Math.abs(onlyAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyAfterTwo - onlyList) < 120);
  assert.ok(Math.abs(onlyAfterThree - onlyList) < 160);
  assert.ok(Math.abs(onlyAfterFour - onlyList) < 200);
  assert.ok(Math.abs(onlyAfterFive - onlyList) < 240);
  assert.ok(Math.abs(onlyAfterSix - onlyList) < 280);
  assert.ok(Math.abs(onlyStamp - onlyList) < 320);
  assert.ok(onlyAfterList > onlyList && onlyAfterList > onlyStamp);
  assert.ok(onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyAnswer > onlyAfterListHop);
  assert.ok(onlyBookOne > onlyAnswer && onlyBookAfterOne >= 0 && onlyBookAfterTwo >= 0 && onlyBookAfterThree >= 0 && onlyBookAfterFour >= 0 && onlyBookAfterFive >= 0 && onlyBookAfterSix >= 0);
  assert.ok(Math.abs(onlyBookAfterOne - onlyBookOne) < 80);
  assert.ok(Math.abs(onlyBookAfterTwo - onlyBookOne) < 120);
  assert.ok(Math.abs(onlyBookAfterThree - onlyBookOne) < 160);
  assert.ok(Math.abs(onlyBookAfterFour - onlyBookOne) < 200);
  assert.ok(Math.abs(onlyBookAfterFive - onlyBookOne) < 240);
  assert.ok(Math.abs(onlyBookAfterSix - onlyBookOne) < 280);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.equal((onlyOne.match(/data-list-after-book-seven=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-six=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-six=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-list-after-book-seven/);
  assert.doesNotMatch(laterCard, /data-list-after-book-six|data-list-after-book-five|data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(laterCard, /data-book-after-list-six|data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterOne = html.indexOf('data-list-after-book-one=""');
  const afterTwo = html.indexOf('data-list-after-book-two=""');
  const afterThree = html.indexOf('data-list-after-book-three=""');
  const afterFour = html.indexOf('data-list-after-book-four=""');
  const afterFive = html.indexOf('data-list-after-book-five=""');
  const afterSix = html.indexOf('data-list-after-book-six=""');
  const stamp = html.indexOf('data-list-after-book-seven=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const bookAfterOne = html.indexOf('data-book-after-list-one=""');
  const bookAfterTwo = html.indexOf('data-book-after-list-two=""');
  const bookAfterThree = html.indexOf('data-book-after-list-three=""');
  const bookAfterFour = html.indexOf('data-book-after-list-four=""');
  const bookAfterFive = html.indexOf('data-book-after-list-five=""');
  const bookAfterSix = html.indexOf('data-book-after-list-six=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterOne >= 0 && afterTwo >= 0 && afterThree >= 0 && afterFour >= 0 && afterFive >= 0 && afterSix >= 0 && stamp >= 0);
  assert.ok(Math.abs(afterOne - listHop) < 80);
  assert.ok(Math.abs(afterTwo - listHop) < 120);
  assert.ok(Math.abs(afterThree - listHop) < 160);
  assert.ok(Math.abs(afterFour - listHop) < 200);
  assert.ok(Math.abs(afterFive - listHop) < 240);
  assert.ok(Math.abs(afterSix - listHop) < 280);
  assert.ok(Math.abs(stamp - listHop) < 320);
  assert.ok(afterList > listHop && afterList > stamp);
  assert.ok(afterBook > afterList && afterListHop > afterBook);
  assert.ok(first > afterListHop && answer > first && bookOne > answer);
  assert.ok(bookAfterOne >= 0 && Math.abs(bookAfterOne - bookOne) < 80);
  assert.ok(bookAfterTwo >= 0 && Math.abs(bookAfterTwo - bookOne) < 120);
  assert.ok(bookAfterThree >= 0 && Math.abs(bookAfterThree - bookOne) < 160);
  assert.ok(bookAfterFour >= 0 && Math.abs(bookAfterFour - bookOne) < 200);
  assert.ok(bookAfterFive >= 0 && Math.abs(bookAfterFive - bookOne) < 240);
  assert.ok(bookAfterSix >= 0 && Math.abs(bookAfterSix - bookOne) < 280);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-list-after-book-seven=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-six=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-six=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
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
  assert.doesNotMatch(html.slice(laterHop), /data-list-after-book-seven/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board lists after Book #1 is re-concentrated again without a second List hop", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-list-after-book-eight/);
  assert.doesNotMatch(empty, /data-list-after-book-seven|data-list-after-book-six|data-list-after-book-five|data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(empty, /data-book-after-list-seven|data-book-after-list-six|data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyAfterTwo = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyAfterThree = onlyOne.indexOf('data-list-after-book-three=""');
  const onlyAfterFour = onlyOne.indexOf('data-list-after-book-four=""');
  const onlyAfterFive = onlyOne.indexOf('data-list-after-book-five=""');
  const onlyAfterSix = onlyOne.indexOf('data-list-after-book-six=""');
  const onlyAfterSeven = onlyOne.indexOf('data-list-after-book-seven=""');
  const onlyStamp = onlyOne.indexOf('data-list-after-book-eight=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyBookAfterOne = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyBookAfterTwo = onlyOne.indexOf('data-book-after-list-two=""');
  const onlyBookAfterThree = onlyOne.indexOf('data-book-after-list-three=""');
  const onlyBookAfterFour = onlyOne.indexOf('data-book-after-list-four=""');
  const onlyBookAfterFive = onlyOne.indexOf('data-book-after-list-five=""');
  const onlyBookAfterSix = onlyOne.indexOf('data-book-after-list-six=""');
  const onlyBookAfterSeven = onlyOne.indexOf('data-book-after-list-seven=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyAfterOne >= 0 && onlyAfterTwo >= 0 && onlyAfterThree >= 0 && onlyAfterFour >= 0 && onlyAfterFive >= 0 && onlyAfterSix >= 0 && onlyAfterSeven >= 0 && onlyStamp >= 0);
  assert.ok(Math.abs(onlyAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyAfterTwo - onlyList) < 120);
  assert.ok(Math.abs(onlyAfterThree - onlyList) < 160);
  assert.ok(Math.abs(onlyAfterFour - onlyList) < 200);
  assert.ok(Math.abs(onlyAfterFive - onlyList) < 240);
  assert.ok(Math.abs(onlyAfterSix - onlyList) < 280);
  assert.ok(Math.abs(onlyAfterSeven - onlyList) < 320);
  assert.ok(Math.abs(onlyStamp - onlyList) < 360);
  assert.ok(onlyAfterList > onlyList && onlyAfterList > onlyStamp);
  assert.ok(onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyAnswer > onlyAfterListHop);
  assert.ok(onlyBookOne > onlyAnswer && onlyBookAfterOne >= 0 && onlyBookAfterTwo >= 0 && onlyBookAfterThree >= 0 && onlyBookAfterFour >= 0 && onlyBookAfterFive >= 0 && onlyBookAfterSix >= 0 && onlyBookAfterSeven >= 0);
  assert.ok(Math.abs(onlyBookAfterOne - onlyBookOne) < 80);
  assert.ok(Math.abs(onlyBookAfterTwo - onlyBookOne) < 120);
  assert.ok(Math.abs(onlyBookAfterThree - onlyBookOne) < 160);
  assert.ok(Math.abs(onlyBookAfterFour - onlyBookOne) < 200);
  assert.ok(Math.abs(onlyBookAfterFive - onlyBookOne) < 240);
  assert.ok(Math.abs(onlyBookAfterSix - onlyBookOne) < 280);
  assert.ok(Math.abs(onlyBookAfterSeven - onlyBookOne) < 320);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.equal((onlyOne.match(/data-list-after-book-eight=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-seven=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-six=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-seven=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-six=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-list-after-book-eight/);
  assert.doesNotMatch(laterCard, /data-list-after-book-seven|data-list-after-book-six|data-list-after-book-five|data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.doesNotMatch(laterCard, /data-book-after-list-seven|data-book-after-list-six|data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterOne = html.indexOf('data-list-after-book-one=""');
  const afterTwo = html.indexOf('data-list-after-book-two=""');
  const afterThree = html.indexOf('data-list-after-book-three=""');
  const afterFour = html.indexOf('data-list-after-book-four=""');
  const afterFive = html.indexOf('data-list-after-book-five=""');
  const afterSix = html.indexOf('data-list-after-book-six=""');
  const afterSeven = html.indexOf('data-list-after-book-seven=""');
  const stamp = html.indexOf('data-list-after-book-eight=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const bookAfterOne = html.indexOf('data-book-after-list-one=""');
  const bookAfterTwo = html.indexOf('data-book-after-list-two=""');
  const bookAfterThree = html.indexOf('data-book-after-list-three=""');
  const bookAfterFour = html.indexOf('data-book-after-list-four=""');
  const bookAfterFive = html.indexOf('data-book-after-list-five=""');
  const bookAfterSix = html.indexOf('data-book-after-list-six=""');
  const bookAfterSeven = html.indexOf('data-book-after-list-seven=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterOne >= 0 && afterTwo >= 0 && afterThree >= 0 && afterFour >= 0 && afterFive >= 0 && afterSix >= 0 && afterSeven >= 0 && stamp >= 0);
  assert.ok(Math.abs(afterOne - listHop) < 80);
  assert.ok(Math.abs(afterTwo - listHop) < 120);
  assert.ok(Math.abs(afterThree - listHop) < 160);
  assert.ok(Math.abs(afterFour - listHop) < 200);
  assert.ok(Math.abs(afterFive - listHop) < 240);
  assert.ok(Math.abs(afterSix - listHop) < 280);
  assert.ok(Math.abs(afterSeven - listHop) < 320);
  assert.ok(Math.abs(stamp - listHop) < 360);
  assert.ok(afterList > listHop && afterList > stamp);
  assert.ok(afterBook > afterList && afterListHop > afterBook);
  assert.ok(first > afterListHop && answer > first && bookOne > answer);
  assert.ok(bookAfterOne >= 0 && Math.abs(bookAfterOne - bookOne) < 80);
  assert.ok(bookAfterTwo >= 0 && Math.abs(bookAfterTwo - bookOne) < 120);
  assert.ok(bookAfterThree >= 0 && Math.abs(bookAfterThree - bookOne) < 160);
  assert.ok(bookAfterFour >= 0 && Math.abs(bookAfterFour - bookOne) < 200);
  assert.ok(bookAfterFive >= 0 && Math.abs(bookAfterFive - bookOne) < 240);
  assert.ok(bookAfterSix >= 0 && Math.abs(bookAfterSix - bookOne) < 280);
  assert.ok(bookAfterSeven >= 0 && Math.abs(bookAfterSeven - bookOne) < 320);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-list-after-book-eight=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-seven=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-six=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-seven=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-six=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
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
  assert.doesNotMatch(html.slice(laterHop), /data-list-after-book-eight/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC board books #1 after List a venue is re-concentrated again without a second Book hop", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-book-after-list-seven/);
  assert.doesNotMatch(empty, /data-book-after-list-six|data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(empty, /data-list-after-book-seven|data-list-after-book-six|data-list-after-book-five|data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[0] }),
  );
  const onlyCardFirst = onlyCard.indexOf('data-book-one-first=""');
  const onlyCardAnswer = onlyCard.indexOf("data-weekend-answer");
  const onlyCardBook = onlyCard.indexOf("data-book-number-one");
  const onlyCardAfterOne = onlyCard.indexOf('data-book-after-list-one=""');
  const onlyCardAfterTwo = onlyCard.indexOf('data-book-after-list-two=""');
  const onlyCardAfterThree = onlyCard.indexOf('data-book-after-list-three=""');
  const onlyCardAfterFour = onlyCard.indexOf('data-book-after-list-four=""');
  const onlyCardAfterFive = onlyCard.indexOf('data-book-after-list-five=""');
  const onlyCardAfterSix = onlyCard.indexOf('data-book-after-list-six=""');
  const onlyCardStamp = onlyCard.indexOf('data-book-after-list-seven=""');
  const onlyCardBid = onlyCard.indexOf('data-bid=""');
  assert.ok(onlyCardFirst >= 0 && onlyCardAnswer > onlyCardFirst);
  assert.ok(onlyCardBook > onlyCardAnswer && onlyCardAfterOne >= 0 && onlyCardAfterTwo >= 0 && onlyCardAfterThree >= 0 && onlyCardAfterFour >= 0 && onlyCardAfterFive >= 0 && onlyCardAfterSix >= 0 && onlyCardStamp >= 0);
  assert.ok(Math.abs(onlyCardAfterOne - onlyCardBook) < 80);
  assert.ok(Math.abs(onlyCardAfterTwo - onlyCardBook) < 120);
  assert.ok(Math.abs(onlyCardAfterThree - onlyCardBook) < 160);
  assert.ok(Math.abs(onlyCardAfterFour - onlyCardBook) < 200);
  assert.ok(Math.abs(onlyCardAfterFive - onlyCardBook) < 240);
  assert.ok(Math.abs(onlyCardAfterSix - onlyCardBook) < 280);
  assert.ok(Math.abs(onlyCardStamp - onlyCardBook) < 320);
  assert.ok(onlyCardBid > onlyCardBook);
  assert.match(onlyCard, /class="book-one"/);
  assert.match(onlyCard, /href="\/api\/click\/lst_top"/);
  assert.equal((onlyCard.match(/data-book-after-list-seven=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-six=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/class="book-one"/g) ?? []).length, 1);
  assert.doesNotMatch(onlyCard, /data-book-after-list=""|data-book-after-list-hop/);
  assert.doesNotMatch(onlyCard, /data-later-book|data-book-later|book-later/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  const onlyList = onlyOne.indexOf('data-list-venue=""');
  const onlyListAfterOne = onlyOne.indexOf('data-list-after-book-one=""');
  const onlyListAfterTwo = onlyOne.indexOf('data-list-after-book-two=""');
  const onlyListAfterThree = onlyOne.indexOf('data-list-after-book-three=""');
  const onlyListAfterFour = onlyOne.indexOf('data-list-after-book-four=""');
  const onlyListAfterFive = onlyOne.indexOf('data-list-after-book-five=""');
  const onlyListAfterSix = onlyOne.indexOf('data-list-after-book-six=""');
  const onlyListStamp = onlyOne.indexOf('data-list-after-book-seven=""');
  const onlyAfterList = onlyOne.indexOf('data-book-after-list=""');
  const onlyAfterBook = onlyOne.indexOf('data-list-after-book-hop=""');
  const onlyAfterListHop = onlyOne.indexOf('data-book-after-list-hop=""');
  const onlyFirst = onlyOne.indexOf('data-book-one-first=""');
  const onlyAnswer = onlyOne.indexOf("data-weekend-answer");
  const onlyBookOne = onlyOne.indexOf("data-book-number-one");
  const onlyAfterOne = onlyOne.indexOf('data-book-after-list-one=""');
  const onlyAfterTwo = onlyOne.indexOf('data-book-after-list-two=""');
  const onlyAfterThree = onlyOne.indexOf('data-book-after-list-three=""');
  const onlyAfterFour = onlyOne.indexOf('data-book-after-list-four=""');
  const onlyAfterFive = onlyOne.indexOf('data-book-after-list-five=""');
  const onlyAfterSix = onlyOne.indexOf('data-book-after-list-six=""');
  const onlyStamp = onlyOne.indexOf('data-book-after-list-seven=""');
  const onlyBid = onlyOne.indexOf('data-bid=""');
  assert.ok(onlyList >= 0 && onlyListAfterOne >= 0 && onlyListAfterTwo >= 0 && onlyListAfterThree >= 0 && onlyListAfterFour >= 0 && onlyListAfterFive >= 0 && onlyListAfterSix >= 0 && onlyListStamp >= 0);
  assert.ok(Math.abs(onlyListAfterOne - onlyList) < 80);
  assert.ok(Math.abs(onlyListAfterTwo - onlyList) < 120);
  assert.ok(Math.abs(onlyListAfterThree - onlyList) < 160);
  assert.ok(Math.abs(onlyListAfterFour - onlyList) < 200);
  assert.ok(Math.abs(onlyListAfterFive - onlyList) < 240);
  assert.ok(Math.abs(onlyListAfterSix - onlyList) < 280);
  assert.ok(Math.abs(onlyListStamp - onlyList) < 320);
  assert.ok(onlyAfterList > onlyList && onlyAfterBook > onlyAfterList);
  assert.ok(onlyAfterListHop > onlyAfterBook && onlyFirst > onlyAfterListHop);
  assert.ok(onlyAnswer > onlyFirst && onlyBookOne > onlyAnswer);
  assert.ok(onlyAfterOne >= 0 && Math.abs(onlyAfterOne - onlyBookOne) < 80);
  assert.ok(onlyAfterTwo >= 0 && Math.abs(onlyAfterTwo - onlyBookOne) < 120);
  assert.ok(onlyAfterThree >= 0 && Math.abs(onlyAfterThree - onlyBookOne) < 160);
  assert.ok(onlyAfterFour >= 0 && Math.abs(onlyAfterFour - onlyBookOne) < 200);
  assert.ok(onlyAfterFive >= 0 && Math.abs(onlyAfterFive - onlyBookOne) < 240);
  assert.ok(onlyAfterSix >= 0 && Math.abs(onlyAfterSix - onlyBookOne) < 280);
  assert.ok(onlyStamp >= 0 && Math.abs(onlyStamp - onlyBookOne) < 320);
  assert.ok(onlyBid > onlyBookOne);
  assert.match(onlyOne, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(onlyOne, /class="list-venue"[^>]*href="#claim"/);
  assert.equal((onlyOne.match(/data-book-after-list-seven=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-six=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-seven=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-six=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((onlyOne.match(/href="#claim"/g) ?? []).length, 2);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-list-after-book=""/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-book-after-list-seven/);
  assert.doesNotMatch(laterCard, /data-book-after-list-six|data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(laterCard, /data-list-after-book-seven|data-list-after-book-six|data-list-after-book-five|data-list-after-book-four|data-list-after-book-three|data-list-after-book-two|data-list-after-book-one|data-list-venue/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const listAfterOne = html.indexOf('data-list-after-book-one=""');
  const listAfterTwo = html.indexOf('data-list-after-book-two=""');
  const listAfterThree = html.indexOf('data-list-after-book-three=""');
  const listAfterFour = html.indexOf('data-list-after-book-four=""');
  const listAfterFive = html.indexOf('data-list-after-book-five=""');
  const listAfterSix = html.indexOf('data-list-after-book-six=""');
  const listStamp = html.indexOf('data-list-after-book-seven=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const first = html.indexOf('data-book-one-first=""');
  const answer = html.indexOf("data-weekend-answer");
  const bookOne = html.indexOf("data-book-number-one");
  const afterOne = html.indexOf('data-book-after-list-one=""');
  const afterTwo = html.indexOf('data-book-after-list-two=""');
  const afterThree = html.indexOf('data-book-after-list-three=""');
  const afterFour = html.indexOf('data-book-after-list-four=""');
  const afterFive = html.indexOf('data-book-after-list-five=""');
  const afterSix = html.indexOf('data-book-after-list-six=""');
  const stamp = html.indexOf('data-book-after-list-seven=""');
  const laterHop = html.indexOf("data-book-later");
  const lastHref = html.indexOf('href="/api/click/lst_three"');
  const listAfter = html.indexOf('data-list-after-book=""');
  const claim = html.indexOf('id="claim"');
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && listAfterOne >= 0 && listAfterTwo >= 0 && listAfterThree >= 0 && listAfterFour >= 0 && listAfterFive >= 0 && listAfterSix >= 0 && listStamp >= 0);
  assert.ok(Math.abs(listAfterOne - listHop) < 80);
  assert.ok(Math.abs(listAfterTwo - listHop) < 120);
  assert.ok(Math.abs(listAfterThree - listHop) < 160);
  assert.ok(Math.abs(listAfterFour - listHop) < 200);
  assert.ok(Math.abs(listAfterFive - listHop) < 240);
  assert.ok(Math.abs(listAfterSix - listHop) < 280);
  assert.ok(Math.abs(listStamp - listHop) < 320);
  assert.ok(afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && first > afterListHop);
  assert.ok(answer > first && bookOne > answer);
  assert.ok(afterOne >= 0 && Math.abs(afterOne - bookOne) < 80);
  assert.ok(afterTwo >= 0 && Math.abs(afterTwo - bookOne) < 120);
  assert.ok(afterThree >= 0 && Math.abs(afterThree - bookOne) < 160);
  assert.ok(afterFour >= 0 && Math.abs(afterFour - bookOne) < 200);
  assert.ok(afterFive >= 0 && Math.abs(afterFive - bookOne) < 240);
  assert.ok(afterSix >= 0 && Math.abs(afterSix - bookOne) < 280);
  assert.ok(stamp >= 0 && Math.abs(stamp - bookOne) < 320);
  assert.ok(laterHop > bookOne && lastHref > laterHop);
  assert.ok(listAfter > lastHref && claim > listAfter && form > claim);
  assert.equal((html.match(/data-book-after-list-seven=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-six=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-one-first=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-seven=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-six=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-five=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-four=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-three=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-two=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-one=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-after-list-hop=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-list-after-book=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/href="#claim"/g) ?? []).length, 3);
  assert.match(html, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /class="list-venue"[^>]*href="#claim"/);
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
  assert.doesNotMatch(html.slice(laterHop), /data-book-after-list-seven|data-book-after-list-six|data-book-after-list-five|data-book-after-list-four|data-book-after-list-three|data-book-after-list-two|data-book-after-list-one|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied NYC #1 reads the venue prize before price, larger than $bid", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-prize-before-price|data-prize=/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);
  assert.doesNotMatch(empty, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);

  const onlyCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[0] }),
  );
  const prize = onlyCard.indexOf('data-prize=""');
  const venue = onlyCard.indexOf("Sunday Roast");
  const bid = onlyCard.indexOf('data-bid=""');
  const clicks = onlyCard.indexOf("data-clicks");
  const book = onlyCard.indexOf("data-book-number-one");
  assert.ok(prize >= 0 && venue > prize);
  assert.ok(book > venue && bid > book && clicks > bid);
  assert.ok(venue < bid && venue < clicks);
  assert.match(onlyCard, /data-prize-before-price=""/);
  assert.match(onlyCard, /data-weekend-answer=""/);
  assert.match(onlyCard, /class="weekend-answer"/);
  assert.match(onlyCard, /\$12/);
  assert.match(onlyCard, /4 clicks/);
  assert.doesNotMatch(onlyCard, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyCard, /data-list-after-book-nine|data-book-after-list-eight/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-prize-before-price|data-prize=/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-book-later=""/);
  assert.match(laterCard, /class="book-later"/);
  assert.match(laterCard, /Late Bar/);
  assert.match(laterCard, /\$8/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const occupiedPrize = html.indexOf('data-prize-before-price=""');
  const occupiedVenue = html.indexOf('data-prize=""');
  const occupiedName = html.indexOf(">Sunday Roast<", occupiedVenue);
  const occupiedBid = html.indexOf('data-bid=""', occupiedVenue);
  const occupiedClicks = html.indexOf("data-clicks", occupiedVenue);
  const laterHop = html.indexOf("data-book-later");
  const form = html.indexOf("data-bid-form");
  assert.ok(occupiedPrize >= 0 && occupiedVenue > occupiedPrize);
  assert.ok(occupiedName > occupiedVenue);
  assert.ok(occupiedBid > occupiedName && occupiedClicks > occupiedBid);
  assert.ok(laterHop > occupiedClicks && form > laterHop);
  assert.equal((html.match(/data-prize-before-price=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-prize=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.match(html, /data-city="nyc"/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /List a venue this weekend/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
  assert.doesNotMatch(html.slice(laterHop), /data-prize-before-price|data-prize=/);
});

test("empty NYC weekend stays unpublished without occupied chrome", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  const noOne = empty.indexOf("No #1");
  const unpublished = empty.indexOf("This weekend is unpublished");
  const stamp = empty.indexOf('data-empty-unpublished=""');
  const form = empty.indexOf("data-bid-form");
  const checkout = empty.indexOf('action="/api/checkout"');
  const outbid = empty.indexOf(">Outbid<");
  assert.ok(noOne >= 0 && unpublished > noOne);
  assert.ok(stamp >= 0 && stamp < form);
  assert.ok(form > unpublished && checkout >= 0 && outbid > form);
  assert.match(empty, /data-empty-board="true"/);
  assert.match(empty, /data-occupied="false"/);
  assert.match(empty, /class="empty-answer"/);
  assert.match(empty, /Nothing is invented here/);
  assert.match(empty, /Print this weekend/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /data-city="nyc"/);
  assert.doesNotMatch(empty, /data-prize-before-price|data-prize=/);
  assert.doesNotMatch(empty, /data-book-number-one|data-book-one-first|class="book-one"/);
  assert.doesNotMatch(empty, /data-unpaid-off-board/);
  assert.doesNotMatch(empty, /Unpaid checkout never ranks/);
  assert.doesNotMatch(empty, /data-listing-card|data-list-venue|data-later-book/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  assert.match(occupied, /data-occupied="true"/);
  assert.doesNotMatch(occupied, /data-empty-unpublished|data-empty-board/);
  assert.match(occupied, /data-prize-before-price=""/);
  assert.match(occupied, /data-book-number-one=""/);
  assert.match(occupied, /data-unpaid-off-board=""/);
  assert.match(occupied, /Sunday Roast/);
  assert.match(occupied, /Claim #1 for/);
  assert.match(occupied, /action="\/api\/checkout"/);
  assert.doesNotMatch(occupied, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("claim form makes unpaid checkout never ranks certain on empty and occupied NYC", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  const emptyForm = empty.indexOf("data-bid-form");
  const emptyOutbid = empty.indexOf(">Outbid<");
  const emptyCheckout = empty.indexOf('action="/api/checkout"');
  assert.ok(emptyForm >= 0 && emptyOutbid > emptyForm);
  assert.ok(emptyCheckout >= 0 && emptyCheckout < emptyOutbid);
  assert.doesNotMatch(empty, /data-unpaid-off-board/);
  assert.doesNotMatch(empty, /Unpaid checkout never ranks/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /Print this weekend/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);
  assert.doesNotMatch(empty, /data-listing-card/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const occupiedForm = occupied.indexOf("data-bid-form");
  const occupiedRule = occupied.indexOf("data-unpaid-off-board");
  const occupiedCopy = occupied.indexOf("Unpaid checkout never ranks");
  const occupiedOutbid = occupied.indexOf(">Outbid<");
  const laterHop = occupied.indexOf("data-book-later");
  assert.ok(laterHop >= 0 && occupiedForm > laterHop);
  assert.ok(occupiedRule > occupiedForm && occupiedCopy > occupiedRule);
  assert.ok(occupiedOutbid > occupiedCopy);
  assert.equal((occupied.match(/data-unpaid-off-board=""/g) ?? []).length, 1);
  assert.match(occupied, /Unpaid checkout never ranks/);
  assert.match(occupied, /stays off the board/);
  assert.match(occupied, /List a venue this weekend/);
  assert.match(occupied, /Claim #1 for/);
  assert.match(occupied, /action="\/api\/checkout"/);
  assert.match(occupied, /Sunday Roast/);
  assert.doesNotMatch(occupied, /data-empty-board/);
  assert.doesNotMatch(occupied, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
  assert.doesNotMatch(occupied.slice(0, occupiedForm), /data-unpaid-off-board/);
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
