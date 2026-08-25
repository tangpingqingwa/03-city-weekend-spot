import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    firstPaidAt: "2026-08-20T16:00:00.000Z",
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
  assert.match(html, /class="unpublished-weekend"/);
  assert.match(html, /No #1/);
  assert.match(html, /This weekend is unpublished/);
  assert.match(html, /Nothing is invented here/);
  assert.match(html, /class="empty-window"/);
  assert.match(html, /Rolling last 7 days from paid createdAt\. Not Monday 00:00 UTC\./);
  assert.match(html, /data-empty-unpublished=""/);
  assert.match(html, /data-occupied="false"/);
  assert.doesNotMatch(html, /data-rolling-week/);
  assert.doesNotMatch(html, /class="fold"/);
  assert.doesNotMatch(html, /fold-rule/);
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
  assert.match(empty, /class="empty-window"/);
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
  const foot = laterCard.indexOf("place-foot");
  assert.ok(stamp >= 0 && bid > stamp && hop > bid && book > hop);
  assert.ok(foot >= 0 && hop > foot);
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
  assert.equal((html.match(/data-later-book=""/g) ?? []).length, 2);
  assert.equal((html.match(/data-later-book-foot=""/g) ?? []).length, 4);
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

test("occupied later ranks stay quieter than occupied #1 venue", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-later-quiet/);
  assert.doesNotMatch(empty, /data-later-stack|data-later-rank|class="rest-name"/);
  assert.doesNotMatch(empty, /data-later-book|data-book-later|book-later/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  assert.doesNotMatch(onlyOne, /data-later-quiet/);
  assert.doesNotMatch(onlyOne, /data-later-stack|data-later-rank|class="rest-name"/);
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.match(onlyOne, /data-prize-before-price=""/);
  assert.match(onlyOne, /data-prize=""/);
  assert.match(onlyOne, /class="book-one"/);
  assert.match(onlyOne, /Sunday Roast/);
  assert.match(onlyOne, /action="\/api\/checkout"/);
  assert.doesNotMatch(onlyOne, /data-list-after-book-nine|data-book-after-list-eight/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  const stamp = laterCard.indexOf("data-later-book");
  const laterRank = laterCard.indexOf("data-later-rank");
  const restName = laterCard.indexOf('class="rest-name"');
  const hop = laterCard.indexOf("data-book-later");
  const book = laterCard.indexOf(">Book<");
  const bid = laterCard.indexOf("data-bid");
  const foot = laterCard.indexOf("place-foot");
  assert.ok(stamp >= 0 && laterRank >= 0 && restName >= 0);
  assert.ok(Math.abs(laterRank - stamp) < 80);
  assert.ok(restName > laterRank && bid > restName && hop > bid && book > hop);
  assert.ok(foot >= 0 && hop > foot);
  assert.match(laterCard, /data-rank="2"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-later-rank=""/);
  assert.match(laterCard, /class="rest-name"/);
  assert.match(laterCard, /data-book-later=""/);
  assert.match(laterCard, /class="book-later"/);
  assert.match(laterCard, />Book</);
  assert.match(laterCard, /href="\/api\/click\/lst_two"/);
  assert.match(laterCard, /Late Bar/);
  assert.match(laterCard, /\$8/);
  assert.doesNotMatch(laterCard, /class="title"/);
  assert.doesNotMatch(laterCard, /data-later-quiet/);
  assert.doesNotMatch(laterCard, /data-weekend-answer|data-prize-before-price|data-prize=/);
  assert.doesNotMatch(laterCard, /data-book-one-first|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(laterCard, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(laterCard, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const prize = html.indexOf('data-prize=""');
  const bookOne = html.indexOf("data-book-number-one");
  const stack = html.indexOf('data-later-stack=""');
  const later = html.indexOf('data-listing-id="lst_two"');
  const laterRankStamp = html.indexOf("data-later-rank");
  const laterHop = html.indexOf("data-book-later");
  const last = html.indexOf('data-listing-id="lst_three"');
  const lastRank = html.indexOf("data-later-rank", laterRankStamp + 1);
  const form = html.indexOf("data-bid-form");
  assert.ok(prize >= 0 && bookOne > prize);
  assert.ok(stack > bookOne && later > stack && laterRankStamp > later);
  assert.ok(laterHop > laterRankStamp && last > laterHop && lastRank > last && form > lastRank);
  assert.equal((html.match(/data-later-rank=""/g) ?? []).length, 2);
  assert.equal((html.match(/class="rest-name"/g) ?? []).length, 2);
  assert.equal((html.match(/data-later-stack=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-later-book=""/g) ?? []).length, 2);
  assert.equal((html.match(/class="book-later"/g) ?? []).length, 2);
  assert.equal((html.match(/data-prize=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.doesNotMatch(html.slice(0, later), /data-later-rank|class="rest-name"/);
  assert.doesNotMatch(html.slice(later), /data-weekend-answer|data-prize-before-price|data-prize=|class="book-one"/);
  assert.doesNotMatch(html, /data-later-quiet/);
  assert.match(html, /data-occupied="true"/);
  assert.match(html, /Also this weekend/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied later Book stays quieter than Book #1 after $bid is a later fact", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  const prizeSize = css.match(/clamp\(([\d.]+)rem, 9vw, 4\.4rem\)/);
  const laterFacts = css.match(
    /\[data-occupied="true"\] \.number-one\[data-paid-at\] \.later-facts\[data-later-fact\]\s*\{([^}]*)\}/,
  );
  const laterBook = css.match(
    /\[data-occupied="true"\]\s*\.place\[data-later-book\]\s*\.place-foot\[data-later-book-foot\]\s*\.book-later\[data-later-book-foot\]\s*\{([^}]*)\}/,
  );
  const bookOne = css.match(
    /\[data-occupied="true"\] \.book-one\[data-book-after-list-seven\]\s*\{[^}]*min-height:\s*([\d.]+)rem/,
  );
  assert.ok(prizeSize);
  assert.ok(laterFacts);
  assert.ok(laterBook);
  assert.ok(bookOne);
  const laterBookSize = laterBook[1].match(/font-size:\s*([\d.]+)rem/);
  assert.ok(laterBookSize);
  assert.ok(Number(laterBookSize[1]) < Number(prizeSize[1]));
  assert.match(laterBook[1], /display:\s*inline/);
  assert.match(laterBook[1], /min-width:\s*0/);
  assert.match(laterBook[1], /border:\s*0/);
  assert.match(laterBook[1], /background:\s*transparent/);
  assert.match(laterBook[1], /color:\s*var\(--muted\)/);
  assert.doesNotMatch(laterBook[1], /var\(--accent\)/);
  assert.doesNotMatch(laterBook[1], /min-height:\s*[1-9]/);
  assert.ok(Number(laterBookSize[1]) < Number(bookOne[1]));
  assert.doesNotMatch(
    css,
    /\.number-one\[data-prize-before-price\] \.bid\.later-fact\[data-later-fact\]/,
  );

  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(empty, /data-later-quiet|data-later-stack|data-later-rank|class="rest-name"/);
  assert.doesNotMatch(empty, /data-later-fact|later-facts|later-fact/);
  assert.doesNotMatch(empty, /data-prize-before-price|data-prize=/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  assert.doesNotMatch(onlyOne, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyOne, /data-later-quiet|data-later-stack|data-later-rank|class="rest-name"/);
  assert.match(onlyOne, /data-prize=""/);
  assert.match(onlyOne, /data-prize-before-price=""/);
  assert.match(onlyOne, /class="later-facts"/);
  assert.match(onlyOne, /data-later-fact=""/);
  assert.match(onlyOne, /class="book-one"/);
  assert.match(onlyOne, /data-guest-first=""/);
  assert.match(onlyOne, /Sunday Roast/);
  assert.doesNotMatch(onlyOne, /<p class="bid"/);
  assert.doesNotMatch(onlyOne, /data-list-after-book-nine|data-book-after-list-eight/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  const stamp = laterCard.indexOf("data-later-book");
  const laterRank = laterCard.indexOf("data-later-rank");
  const restName = laterCard.indexOf('class="rest-name"');
  const bid = laterCard.indexOf("data-bid");
  const foot = laterCard.indexOf('class="place-foot"');
  const hop = laterCard.indexOf("data-book-later");
  const book = laterCard.indexOf(">Book<");
  const clicks = laterCard.indexOf("data-clicks");
  const footEnd = laterCard.indexOf("</footer>", foot);
  assert.ok(stamp >= 0 && laterRank >= 0 && restName >= 0);
  assert.ok(Math.abs(laterRank - stamp) < 80);
  assert.ok(restName > laterRank && bid > restName && foot > bid && hop > foot && book > hop);
  assert.ok(clicks > hop && clicks < footEnd);
  assert.match(laterCard, /data-rank="2"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-later-rank=""/);
  assert.match(laterCard, /class="rest-name"/);
  assert.match(laterCard, /data-book-later=""/);
  assert.match(laterCard, /class="book-later"/);
  assert.match(laterCard, />Book</);
  assert.match(laterCard, /href="\/api\/click\/lst_two"/);
  assert.match(laterCard, /Late Bar/);
  assert.match(laterCard, /\$8/);
  assert.match(laterCard, /<p class="bid"/);
  assert.doesNotMatch(laterCard, /data-later-fact|later-facts|later-fact/);
  assert.doesNotMatch(laterCard, /data-later-quiet|class="title"/);
  assert.doesNotMatch(laterCard, /data-weekend-answer|data-prize-before-price|data-prize=/);
  assert.doesNotMatch(laterCard, /data-book-one-first|data-book-number-one|class="book-one"|data-guest-first/);
  assert.doesNotMatch(laterCard, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(laterCard, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const prize = html.indexOf('data-prize=""');
  const bookOneStamp = html.indexOf("data-book-number-one");
  const facts = html.indexOf('class="later-facts"');
  const later = html.indexOf('data-listing-id="lst_two"');
  const laterBid = html.indexOf('data-bid=""', later);
  const laterFoot = html.indexOf('class="place-foot"', later);
  const laterHop = html.indexOf("data-book-later");
  const last = html.indexOf('data-listing-id="lst_three"');
  const lastHop = html.indexOf("data-book-later", laterHop + 1);
  const form = html.indexOf("data-bid-form");
  assert.ok(prize >= 0 && bookOneStamp > prize && facts > bookOneStamp);
  assert.ok(later > facts && laterBid > later && laterFoot > laterBid);
  assert.ok(laterHop > laterFoot && last > laterHop && lastHop > last && form > lastHop);
  assert.equal((html.match(/data-later-rank=""/g) ?? []).length, 2);
  assert.equal((html.match(/class="rest-name"/g) ?? []).length, 2);
  assert.equal((html.match(/data-later-stack=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-later-book=""/g) ?? []).length, 2);
  assert.equal((html.match(/class="book-later"/g) ?? []).length, 2);
  assert.equal((html.match(/data-book-later=""/g) ?? []).length, 2);
  assert.equal((html.match(/data-prize=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/class="later-facts"/g) ?? []).length, 1);
  assert.match(html, /data-occupied="true"/);
  assert.match(html, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html, /data-later-quiet/);
  assert.doesNotMatch(html.slice(0, later), /data-later-rank|class="rest-name"|class="book-later"/);
  assert.doesNotMatch(html.slice(later), /data-weekend-answer|data-prize-before-price|data-prize=|class="book-one"|class="later-facts"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied Book #1 stays the first guest click", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-guest-first/);
  assert.doesNotMatch(empty, /data-book-one-first|data-book-number-one|class="book-one"/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);

  const onlyCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[0] }),
  );
  const prize = onlyCard.indexOf('data-prize=""');
  const guestCard = onlyCard.indexOf('data-guest-first=""');
  const book = onlyCard.indexOf("data-book-number-one");
  const guestHop = onlyCard.indexOf('data-guest-first=""', book);
  const bid = onlyCard.indexOf('data-bid=""');
  assert.ok(prize >= 0 && guestCard >= 0 && book >= 0 && guestHop >= 0);
  assert.ok(prize > guestCard && book > prize && guestHop > book && bid > guestHop);
  assert.match(onlyCard, /data-book-one-first=""/);
  assert.match(onlyCard, /class="book-one"/);
  assert.match(onlyCard, /href="\/api\/click\/lst_top"/);
  assert.match(onlyCard, /Sunday Roast/);
  assert.equal((onlyCard.match(/data-guest-first=""/g) ?? []).length, 2);
  assert.equal((onlyCard.match(/data-book-number-one/g) ?? []).length, 1);
  assert.doesNotMatch(onlyCard, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyCard, /data-list-after-book-nine|data-book-after-list-eight/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-guest-first/);
  assert.doesNotMatch(laterCard, /data-book-one-first|data-book-number-one|class="book-one"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-later-rank=""/);
  assert.match(laterCard, /class="rest-name"/);
  assert.doesNotMatch(laterCard, /data-later-quiet|class="title"/);
  assert.match(laterCard, /data-book-later=""/);
  assert.match(laterCard, /class="book-later"/);
  assert.match(laterCard, /href="\/api\/click\/lst_two"/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const listHop = html.indexOf('data-list-venue=""');
  const afterList = html.indexOf('data-book-after-list=""');
  const afterBook = html.indexOf('data-list-after-book-hop=""');
  const afterListHop = html.indexOf('data-book-after-list-hop=""');
  const prizeStamp = html.indexOf('data-prize=""');
  const occupiedGuestCard = html.indexOf('data-guest-first=""');
  const bookOne = html.indexOf("data-book-number-one");
  const occupiedGuestHop = html.indexOf('data-guest-first=""', bookOne);
  const laterHop = html.indexOf("data-book-later");
  const form = html.indexOf("data-bid-form");
  assert.ok(listHop >= 0 && afterList > listHop && afterBook > afterList);
  assert.ok(afterListHop > afterBook && occupiedGuestCard > afterListHop);
  assert.ok(prizeStamp > occupiedGuestCard && bookOne > prizeStamp && occupiedGuestHop > bookOne);
  assert.ok(laterHop > occupiedGuestHop && form > laterHop);
  assert.equal((html.match(/data-guest-first=""/g) ?? []).length, 2);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.equal((html.match(/data-prize=""/g) ?? []).length, 1);
  assert.match(html, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(html, /class="book-one"[^>]*href="\/api\/click\/lst_top"/);
  assert.match(html, /Sunday Roast/);
  assert.match(html, /data-occupied="true"/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html.slice(0, occupiedGuestCard), /data-guest-first/);
  assert.doesNotMatch(html.slice(laterHop), /data-guest-first|data-book-number-one|class="book-one"/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /data-list-after-book-nine|data-book-after-list-eight/);
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

test("occupied NYC #1 $bid sits in a later-fact group after Book, not a muted twin paragraph", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  const prizeSize = css.match(/clamp\(([\d.]+)rem, 9vw, 4\.4rem\)/);
  const laterFacts = css.match(
    /\[data-occupied="true"\] \.number-one\[data-paid-at\] \.later-facts\[data-later-fact\]\s*\{([^}]*)\}/,
  );
  assert.ok(prizeSize);
  assert.ok(laterFacts);
  const groupSize = laterFacts[1].match(/font-size:\s*([\d.]+)rem/);
  assert.ok(groupSize);
  assert.ok(Number(prizeSize[1]) > Number(groupSize[1]));
  assert.match(laterFacts[1], /color:\s*var\(--muted\)/);
  assert.doesNotMatch(laterFacts[1], /color:\s*var\(--accent\)/);
  assert.doesNotMatch(
    css,
    /\.number-one\[data-prize-before-price\] \.bid\.later-fact\[data-later-fact\]/,
  );

  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-later-fact/);
  assert.doesNotMatch(empty, /later-facts|later-fact/);
  assert.doesNotMatch(empty, /data-prize-before-price|data-prize=/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);
  assert.doesNotMatch(empty, /data-book-number-one|data-book-one-first|class="book-one"|data-guest-first/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);

  const onlyCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[0] }),
  );
  const prize = onlyCard.indexOf('data-prize=""');
  const venue = onlyCard.indexOf("Sunday Roast");
  const book = onlyCard.indexOf("data-book-number-one");
  const facts = onlyCard.indexOf('class="later-facts"');
  const laterFactStamp = onlyCard.indexOf('data-later-fact=""');
  const bid = onlyCard.indexOf('data-bid=""');
  const clicks = onlyCard.indexOf("data-clicks");
  const factsEnd = onlyCard.indexOf("</footer>", facts);
  assert.ok(prize >= 0 && venue > prize);
  assert.ok(book > venue && facts > book && laterFactStamp >= facts);
  assert.ok(bid > facts && clicks > bid && clicks < factsEnd);
  assert.ok(factsEnd > clicks);
  assert.match(onlyCard, /data-prize-before-price=""/);
  assert.match(onlyCard, /class="weekend-answer"/);
  assert.match(onlyCard, /class="later-facts"/);
  assert.match(onlyCard, /data-later-fact=""/);
  assert.match(onlyCard, /class="bid"/);
  assert.match(onlyCard, /\$12/);
  assert.match(onlyCard, /4 clicks/);
  assert.match(onlyCard, /class="book-one"/);
  assert.match(onlyCard, /data-guest-first=""/);
  assert.equal((onlyCard.match(/data-later-fact=""/g) ?? []).length, 1);
  assert.equal((onlyCard.match(/class="later-facts"/g) ?? []).length, 1);
  assert.doesNotMatch(onlyCard, /<p class="bid"/);
  assert.doesNotMatch(onlyCard, /class="bid later-fact"/);
  assert.doesNotMatch(onlyCard, /class="clicks later-fact"/);
  assert.doesNotMatch(onlyCard, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(onlyCard, /data-list-after-book-nine|data-book-after-list-eight/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.doesNotMatch(laterCard, /data-later-fact/);
  assert.doesNotMatch(laterCard, /later-facts|later-fact/);
  assert.doesNotMatch(laterCard, /data-prize-before-price|data-prize=/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-later-rank=""/);
  assert.match(laterCard, /class="rest-name"/);
  assert.doesNotMatch(laterCard, /data-later-quiet|class="title"/);
  assert.match(laterCard, /data-book-later=""/);
  assert.match(laterCard, /class="book-later"/);
  assert.match(laterCard, /<p class="bid"/);
  assert.match(laterCard, /Late Bar/);
  assert.match(laterCard, /\$8/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const occupiedPrize = html.indexOf('data-prize=""');
  const occupiedName = html.indexOf(">Sunday Roast<", occupiedPrize);
  const occupiedBook = html.indexOf("data-book-number-one");
  const occupiedFacts = html.indexOf('class="later-facts"');
  const occupiedLaterFact = html.indexOf('data-later-fact=""');
  const occupiedBid = html.indexOf('data-bid=""', occupiedPrize);
  const occupiedClicks = html.indexOf("data-clicks", occupiedPrize);
  const occupiedFactsEnd = html.indexOf("</footer>", occupiedFacts);
  const laterHop = html.indexOf("data-book-later");
  const form = html.indexOf("data-bid-form");
  assert.ok(occupiedPrize >= 0 && occupiedName > occupiedPrize);
  assert.ok(occupiedBook > occupiedName && occupiedFacts > occupiedBook);
  assert.ok(occupiedLaterFact >= occupiedFacts);
  assert.ok(occupiedBid > occupiedFacts && occupiedClicks > occupiedBid);
  assert.ok(occupiedClicks < occupiedFactsEnd);
  assert.ok(laterHop > occupiedFactsEnd && form > laterHop);
  assert.equal((html.match(/data-later-fact=""/g) ?? []).length, 1);
  assert.equal((html.match(/class="later-facts"/g) ?? []).length, 1);
  assert.equal((html.match(/data-prize=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/data-later-rank=""/g) ?? []).length, 2);
  assert.equal((html.match(/class="rest-name"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /data-later-quiet/);
  assert.match(html, /data-occupied="true"/);
  assert.match(html, /data-prize-before-price=""/);
  assert.match(html, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html, /class="bid later-fact"/);
  assert.doesNotMatch(html.slice(0, occupiedPrize), /data-later-fact|later-facts/);
  assert.doesNotMatch(html.slice(laterHop), /data-later-fact|class="later-facts"|data-prize=/);
  assert.doesNotMatch(html, /data-empty-board/);
  assert.doesNotMatch(html, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("empty NYC weekend stays unpublished without occupied chrome", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  const noOne = empty.indexOf("No #1");
  const unpublished = empty.indexOf("This weekend is unpublished");
  const windowCopy = empty.indexOf(
    "Rolling last 7 days from paid createdAt. Not Monday 00:00 UTC.",
  );
  const stamp = empty.indexOf('data-empty-unpublished=""');
  const form = empty.indexOf("data-bid-form");
  const checkout = empty.indexOf('action="/api/checkout"');
  const outbid = empty.indexOf(">Outbid<");
  assert.ok(noOne >= 0 && unpublished > noOne);
  assert.ok(windowCopy > unpublished);
  assert.ok(stamp >= 0 && stamp < form);
  assert.ok(form > unpublished && checkout >= 0 && outbid > form);
  assert.match(empty, /data-empty-board="true"/);
  assert.match(empty, /data-occupied="false"/);
  assert.match(empty, /class="unpublished-weekend"/);
  assert.match(empty, /class="empty-answer"/);
  assert.match(empty, /class="empty-window"/);
  assert.match(empty, /Nothing is invented here/);
  assert.doesNotMatch(empty, /data-rolling-week/);
  assert.match(empty, /Print this weekend/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /data-city="nyc"/);
  assert.doesNotMatch(empty, /class="fold"|fold-rule|empty-board /);
  assert.doesNotMatch(empty, /data-prize-before-price|data-prize=/);
  assert.doesNotMatch(empty, /data-later-fact|later-facts|later-fact/);
  assert.doesNotMatch(empty, /data-book-number-one|data-book-one-first|class="book-one"/);
  assert.doesNotMatch(empty, /data-unpaid-off-board/);
  assert.doesNotMatch(empty, /Unpaid checkout never ranks/);
  assert.doesNotMatch(empty, /data-listing-card|data-list-venue|data-later-book|data-later-quiet|data-later-stack|data-later-rank|class="rest-name"|data-guest-first/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  assert.match(occupied, /data-occupied="true"/);
  assert.doesNotMatch(occupied, /data-empty-unpublished|data-empty-board|unpublished-weekend/);
  assert.match(occupied, /class="fold"/);
  assert.match(occupied, /data-prize-before-price=""/);
  assert.match(occupied, /data-later-fact=""/);
  assert.match(occupied, /class="later-facts"/);
  assert.match(occupied, /data-book-number-one=""/);
  assert.match(occupied, /data-unpaid-off-board=""/);
  assert.match(occupied, /Sunday Roast/);
  assert.match(occupied, /Claim #1 for/);
  assert.match(occupied, /action="\/api\/checkout"/);
  assert.doesNotMatch(occupied, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("empty NYC weekend keeps Book #1 and later Book off unpublished", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.match(css, /unpublished-weekend\[data-empty-unpublished\]/);
  assert.match(css, /\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.book-one/);
  assert.match(css, /\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.book-later/);
  assert.match(css, /\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.later-facts/);
  assert.match(css, /\[data-occupied="true"\] \.book-one/);
  assert.match(css, /\[data-occupied="true"\][\s\S]*\.book-later\[data-later-book-foot\]/);
  assert.match(css, /\[data-occupied="true"\] \.place-foot/);
  assert.match(css, /place-foot\[data-later-book-foot\]/);
  assert.doesNotMatch(css, /^[\s]*\.book-one\s*\{/m);
  assert.doesNotMatch(css, /^[\s]*\.book-later\s*[,{]/m);
  assert.doesNotMatch(css, /^[\s]*\.place-foot\s*\{/m);
  assert.doesNotMatch(css, /^[\s]*\.number-one \.later-facts\[data-later-fact\]\s*\{/m);

  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  const weekend = empty.indexOf('class="unpublished-weekend"');
  const noOne = empty.indexOf("No #1");
  const unpublished = empty.indexOf("This weekend is unpublished");
  const form = empty.indexOf("data-bid-form");
  const checkout = empty.indexOf('action="/api/checkout"');
  const outbid = empty.indexOf(">Outbid<");
  assert.ok(weekend >= 0 && noOne > weekend && unpublished > noOne);
  assert.ok(form > unpublished && checkout >= 0 && outbid > form);
  assert.match(empty, /data-empty-board="true"/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /data-occupied="false"/);
  assert.match(empty, /class="empty-answer"/);
  assert.match(empty, /Print this weekend/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /data-city="nyc"/);
  assert.doesNotMatch(empty, /class="fold"|fold-rule/);
  assert.doesNotMatch(empty, /data-book-number-one|data-book-one-first|class="book-one"|data-guest-first/);
  assert.doesNotMatch(empty, /data-later-book|data-book-later|class="book-later"|place-foot/);
  assert.doesNotMatch(empty, /data-later-stack|data-later-rank|class="rest-name"|Also this weekend/);
  assert.doesNotMatch(empty, /data-later-fact|later-facts|data-prize-before-price|data-prize=/);
  assert.doesNotMatch(empty, /data-list-venue|data-book-after-list|data-list-after-book/);
  assert.doesNotMatch(empty, /data-unpaid-off-board/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  assert.match(occupied, /data-occupied="true"/);
  assert.doesNotMatch(occupied, /unpublished-weekend|data-empty-unpublished|data-empty-board/);
  assert.match(occupied, /class="fold"/);
  assert.match(occupied, /data-guest-first=""/);
  assert.match(occupied, /data-book-number-one=""/);
  assert.match(occupied, /class="book-one"/);
  assert.match(occupied, /class="later-facts"/);
  assert.match(occupied, /class="book-later"/);
  assert.match(occupied, /class="place-foot"/);
  assert.match(occupied, /Sunday Roast/);
  assert.match(occupied, /Late Bar/);
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

test("empty NYC Claim #1 is the first click — venue URL is a later write", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.match(
    css,
    /Empty \/nyc: Claim #1 is the only first click\. Venue URL is a later write after Outbid\./,
  );
  assert.match(
    css,
    /\[data-occupied="false"\] \.claim\.empty-claim-first\[data-empty-claim-first\]/,
  );
  assert.match(
    css,
    /\[data-occupied="false"\][\s\S]*\.venue-identity\[data-later-write\]/,
  );
  assert.match(css, /h2\[data-first-click="claim"\]/);
  assert.match(css, /\.later-write-label/);
  const later = (
    css.split(
      "Empty /nyc: Claim #1 is the only first click. Venue URL is a later write after Outbid.",
      2,
    )[1] ?? ""
  ).split(".stub-note,")[0];
  assert.match(later, /border-top:\s*1px dashed var\(--rule-soft\)/);
  assert.match(later, /color:\s*var\(--muted\)/);
  assert.doesNotMatch(later, /background:\s*var\(--accent\)/);
  assert.doesNotMatch(later, /data-list-after-book-nine|data-book-after-list-eight/);

  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  const unpublished = empty.indexOf("data-empty-unpublished");
  const claim = empty.indexOf('id="claim"');
  const emptyClaim = empty.indexOf('data-empty-claim-first=""');
  const firstClick = empty.indexOf('data-first-click="claim"');
  const claimCopy = empty.indexOf("Claim #1 for");
  const outbid = empty.indexOf(">Outbid<");
  const laterWrite = empty.indexOf('data-later-write=""');
  const laterLabel = empty.indexOf("Then the venue URL");
  const venue = empty.indexOf('name="venue"');
  const checkout = empty.indexOf('action="/api/checkout"');
  assert.ok(unpublished >= 0 && claim > unpublished);
  assert.ok(emptyClaim > claim && firstClick > emptyClaim);
  assert.ok(claimCopy > emptyClaim && outbid > claimCopy);
  assert.ok(outbid > firstClick && laterWrite > outbid);
  assert.ok(laterLabel > laterWrite && venue > laterLabel);
  assert.ok(checkout >= 0 && checkout < outbid);
  assert.match(empty, /class="claim empty-claim-first"/);
  assert.match(empty, /data-empty-claim-first=""/);
  assert.match(empty, /data-first-click="claim"/);
  assert.match(empty, /aria-label="Claim #1"/);
  assert.match(empty, /class="venue-identity"/);
  assert.match(empty, /data-venue-identity=""/);
  assert.match(empty, /data-later-write=""/);
  assert.match(empty, /Then the venue URL/);
  assert.match(empty, /Venue name and https booking URL/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /Print this weekend/);
  assert.match(empty, /data-occupied="false"/);
  assert.match(empty, /data-city="nyc"/);
  assert.equal((empty.match(/data-first-click="claim"/g) ?? []).length, 1);
  assert.equal((empty.match(/data-empty-claim-first=""/g) ?? []).length, 1);
  assert.equal((empty.match(/data-later-write=""/g) ?? []).length, 1);
  assert.doesNotMatch(empty, /class="bid-row"/);
  assert.doesNotMatch(empty, /data-list-venue|List a venue/);
  assert.doesNotMatch(empty, /data-book-number-one|data-book-one-first|class="book-one"|data-guest-first/);
  assert.doesNotMatch(empty, /data-later-book|data-book-later|class="book-later"|place-foot/);
  assert.doesNotMatch(empty, /data-later-stack|data-later-rank|class="rest-name"|Also this weekend/);
  assert.doesNotMatch(empty, /data-later-fact|later-facts|data-prize-before-price|data-prize=/);
  assert.doesNotMatch(empty, /data-unpaid-off-board/);
  assert.doesNotMatch(empty, /class="fold"|fold-rule/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const occupiedVenue = occupied.indexOf('name="venue"');
  const occupiedOutbid = occupied.indexOf(">Outbid<");
  const occupiedBook = occupied.indexOf("data-book-number-one");
  const occupiedForm = occupied.indexOf("data-bid-form");
  assert.ok(occupiedBook >= 0 && occupiedForm > occupiedBook);
  assert.ok(occupiedVenue >= 0 && occupiedOutbid > occupiedVenue);
  assert.match(occupied, /class="bid-row"/);
  assert.match(occupied, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(occupied, /List a venue this weekend/);
  assert.match(occupied, /Claim #1 for/);
  assert.match(occupied, /action="\/api\/checkout"/);
  assert.match(occupied, /data-occupied="true"/);
  assert.match(occupied, /Sunday Roast/);
  assert.doesNotMatch(occupied, /data-empty-claim-first/);
  assert.doesNotMatch(occupied, /empty-claim-first/);
  assert.doesNotMatch(occupied, /data-first-click="claim"/);
  assert.doesNotMatch(occupied, /data-later-write/);
  assert.doesNotMatch(occupied, /data-venue-identity/);
  assert.doesNotMatch(occupied, /Then the venue URL/);
  assert.doesNotMatch(occupied, /data-empty-board|unpublished-weekend/);
  assert.match(occupied, /data-later-stack=""/);
  assert.match(occupied, /class="rest-name"/);
  assert.doesNotMatch(occupied, /data-later-quiet/);
  assert.doesNotMatch(occupied, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied later venues stay quieter than occupied #1 — prize stays first", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  const prizeSize = css.match(/clamp\(([\d.]+)rem, 9vw, 4\.4rem\)/);
  const restName = css.match(
    /\[data-occupied="true"\] \.later-stack\[data-later-stack\] \.place\[data-later-rank\] \.rest-name\s*\{([^}]*)\}/,
  );
  const laterBook = css.match(
    /\[data-occupied="true"\]\s*\.place\[data-later-book\]\s*\.place-foot\[data-later-book-foot\]\s*\.book-later\[data-later-book-foot\]\s*\{([^}]*)\}/,
  );
  assert.ok(prizeSize);
  assert.ok(restName);
  assert.ok(laterBook);
  const restSize = restName[1].match(/font-size:\s*([\d.]+)rem/);
  assert.ok(restSize);
  assert.ok(Number(restSize[1]) < Number(prizeSize[1]));
  assert.notEqual(Number(restSize[1]), 0.78);
  assert.match(restName[1], /font-weight:\s*600/);
  assert.doesNotMatch(restName[1], /var\(--accent\)/);
  assert.doesNotMatch(restName[1], /0\.78rem/);
  assert.match(laterBook[1], /display:\s*inline/);
  assert.match(laterBook[1], /background:\s*transparent/);
  assert.doesNotMatch(css, /data-later-quiet/);
  assert.doesNotMatch(css, /0\.78rem --muted/);
  assert.match(css, /\[data-occupied="true"\] \.later-stack\[data-later-stack\]/);
  assert.doesNotMatch(css, /^[\s]*\.later-stack\s*\{/m);
  assert.doesNotMatch(css, /^[\s]*\.rest-name\s*\{/m);
  assert.doesNotMatch(css, /data-list-after-book-nine|data-book-after-list-eight/);

  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-later-stack|data-later-rank|class="rest-name"|Also this weekend/);
  assert.doesNotMatch(empty, /data-later-quiet|class="title"/);
  assert.match(empty, /data-empty-claim-first=""/);
  assert.match(empty, /data-later-write=""/);
  assert.match(empty, /Then the venue URL/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  assert.doesNotMatch(onlyOne, /data-later-stack|data-later-rank|class="rest-name"|Also this weekend/);
  assert.match(onlyOne, /data-prize=""/);
  assert.match(onlyOne, /class="weekend-answer"/);
  assert.match(onlyOne, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(onlyOne, /Sunday Roast/);
  assert.doesNotMatch(onlyOne, /data-later-write|Then the venue URL|data-empty-claim-first/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  assert.match(laterCard, /data-later-rank=""/);
  assert.match(laterCard, /class="rest-name"/);
  assert.match(laterCard, />Late Bar</);
  assert.match(laterCard, /class="place-foot"/);
  assert.match(laterCard, /class="book-later"/);
  assert.doesNotMatch(laterCard, /class="title"|class="weekend-answer"|data-prize=/);
  assert.doesNotMatch(laterCard, /data-later-quiet|data-guest-first|class="book-one"/);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const prize = html.indexOf('data-prize=""');
  const prizeName = html.indexOf(">Sunday Roast<", prize);
  const bookOne = html.indexOf("data-book-number-one");
  const guestHop = html.indexOf('data-guest-first=""', bookOne);
  const stack = html.indexOf('data-later-stack=""');
  const kicker = html.indexOf("Also this weekend");
  const later = html.indexOf('data-listing-id="lst_two"');
  const rest = html.indexOf('class="rest-name"');
  const laterBookHop = html.indexOf("data-book-later");
  const last = html.indexOf('data-listing-id="lst_three"');
  const lastRest = html.indexOf('class="rest-name"', rest + 1);
  const listAfter = html.indexOf('data-list-after-book=""');
  const form = html.indexOf("data-bid-form");
  assert.ok(prize >= 0 && prizeName > prize && bookOne > prizeName && guestHop > bookOne);
  assert.ok(stack > guestHop && kicker > stack && later > kicker);
  assert.ok(rest > later && laterBookHop > rest && last > laterBookHop);
  assert.ok(lastRest > last && listAfter > lastRest && form > listAfter);
  assert.equal((html.match(/data-prize=""/g) ?? []).length, 1);
  assert.equal((html.match(/class="weekend-answer"/g) ?? []).length, 1);
  assert.equal((html.match(/data-later-stack=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-later-rank=""/g) ?? []).length, 2);
  assert.equal((html.match(/class="rest-name"/g) ?? []).length, 2);
  assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((html.match(/class="book-later"/g) ?? []).length, 2);
  assert.match(html, /These venues are not this weekend/);
  assert.match(html, /Paying less than #1 still lists/);
  assert.match(html, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(html, /class="bid-row"/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.match(html, /data-city="nyc"/);
  assert.doesNotMatch(html, /data-later-quiet/);
  assert.doesNotMatch(html, /data-later-write|Then the venue URL|data-empty-claim-first/);
  assert.doesNotMatch(html.slice(0, stack), /class="rest-name"|data-later-rank/);
  assert.doesNotMatch(html.slice(later), /data-weekend-answer|data-prize=|class="book-one"|class="weekend-answer"/);
  assert.doesNotMatch(html, /data-empty-board|unpublished-weekend/);
  assert.doesNotMatch(html, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("abandoned unpaid checkout stays off occupied /nyc — No #1 until Polar reports paid", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.match(
    css,
    /\[data-occupied="true"\] \.number-one\[data-paid-at\] \.weekend-answer/,
  );
  assert.match(
    css,
    /\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.weekend-answer/,
  );
  assert.match(
    css,
    /\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.number-one/,
  );
  assert.doesNotMatch(css, /^[\s]*\.weekend-answer\s*\{/m);
  assert.doesNotMatch(css, /^[\s]*\.number-one\s*\{/m);
  assert.doesNotMatch(css, /data-list-after-book-nine|data-book-after-list-eight/);

  const unpaid = fixtureListing({
    id: "lst_ghost",
    venueName: "Ghost Bar",
    bidUsd: 99,
    rank: 1,
    firstPaidAt: "1970-01-01T00:00:00.000Z",
  });
  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [unpaid] }),
  );
  const noOne = html.indexOf("No #1");
  const unpublished = html.indexOf("This weekend is unpublished");
  const claim = html.indexOf("Claim #1 for");
  const outbid = html.indexOf(">Outbid<");
  assert.ok(noOne >= 0 && unpublished > noOne && claim > unpublished && outbid > claim);
  assert.match(html, /data-occupied="false"/);
  assert.match(html, /data-empty-unpublished=""/);
  assert.match(html, /class="unpublished-weekend"/);
  assert.match(html, /class="empty-answer"/);
  assert.match(html, /Nothing is invented here/);
  assert.match(html, /Print this weekend/);
  assert.match(html, /data-empty-claim-first=""/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html, /Ghost Bar/);
  assert.doesNotMatch(html, /data-listing-card|data-weekend-answer|data-prize=/);
  assert.doesNotMatch(html, /data-book-number-one|class="book-one"|data-guest-first/);
  assert.doesNotMatch(html, /class="fold"|data-later-stack|class="rest-name"/);
  assert.doesNotMatch(html, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [rankedCards[0], unpaid, rankedCards[1]],
    }),
  );
  assert.match(occupied, /data-occupied="true"/);
  assert.match(occupied, /data-paid-at="2026-08-20T16:00:00.000Z"/);
  assert.match(occupied, /Sunday Roast/);
  assert.match(occupied, /class="weekend-answer"/);
  assert.match(occupied, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(occupied, /Late Bar/);
  assert.match(occupied, /data-later-stack=""/);
  assert.doesNotMatch(occupied, /Ghost Bar/);
  assert.doesNotMatch(occupied, /data-empty-board|unpublished-weekend/);
  assert.doesNotMatch(occupied, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied week window is rolling last-7-days — not Monday 00:00 UTC", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.match(empty, /data-empty-board="true"/);
  assert.match(empty, /data-occupied="false"/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /Rank is money, not stars/);
  assert.match(empty, /data-first-click="claim"/);
  assert.match(empty, /Then the venue URL/);
  assert.doesNotMatch(empty, /data-rolling-week/);
  assert.doesNotMatch(empty, /class="period-meta week-window"/);
  assert.doesNotMatch(empty, /data-prize=/);
  assert.doesNotMatch(empty, /24h lock/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const prizeAt = occupied.indexOf('data-prize=""');
  const firstClickAt = occupied.indexOf('data-guest-first=""');
  const windowAt = occupied.indexOf('data-rolling-week=""');
  const laterAt = occupied.indexOf('data-later-stack=""');
  const claimAt = occupied.indexOf('id="claim"');
  assert.notEqual(prizeAt, -1);
  assert.notEqual(firstClickAt, -1);
  assert.notEqual(windowAt, -1);
  assert.notEqual(laterAt, -1);
  assert.notEqual(claimAt, -1);
  assert.ok(prizeAt < laterAt);
  assert.ok(firstClickAt < claimAt);
  assert.ok(windowAt < claimAt);
  assert.match(occupied, /data-occupied="true"/);
  assert.match(occupied, /data-rolling-week=""/);
  assert.match(occupied, /Rolling last 7 days\. Not Monday 00:00 UTC\./);
  assert.match(occupied, /class="period-meta week-window"/);
  assert.match(occupied, /Sunday Roast/);
  assert.match(occupied, /class="weekend-answer"/);
  assert.match(occupied, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(occupied, /Also this weekend/);
  assert.match(occupied, /Claim #1 for/);
  assert.match(occupied, />Outbid</);
  assert.doesNotMatch(occupied, /data-empty-board/);
  assert.doesNotMatch(occupied, /This weekend is unpublished/);
  assert.doesNotMatch(occupied, /24h lock/);
  assert.doesNotMatch(occupied, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
  assert.equal((occupied.match(/data-guest-first=""/g) ?? []).length, 2);
  assert.equal((occupied.match(/data-prize=""/g) ?? []).length, 1);

  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.match(
    css,
    /\.poster\[data-occupied="true"\] \.period-meta\.week-window\[data-rolling-week\]/,
  );
  assert.match(
    css,
    /\.poster\[data-occupied="false"\] \[data-rolling-week\]/,
  );
  assert.match(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \[data-rolling-week\]/,
  );
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}rolling-week/);
});

test("empty unpublished names rolling last-7-days — not Monday 00:00 UTC", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  const weekend = empty.indexOf('class="unpublished-weekend"');
  const noOne = empty.indexOf("No #1");
  const unpublished = empty.indexOf("This weekend is unpublished");
  const windowCopy = empty.indexOf(
    "Rolling last 7 days from paid createdAt. Not Monday 00:00 UTC.",
  );
  const form = empty.indexOf("data-bid-form");
  const outbid = empty.indexOf(">Outbid<");
  assert.ok(weekend >= 0 && noOne > weekend);
  assert.ok(unpublished > noOne && windowCopy > unpublished);
  assert.ok(form > windowCopy && outbid > form);
  assert.match(empty, /class="empty-answer"/);
  assert.match(empty, /class="empty-window"/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /data-occupied="false"/);
  assert.match(empty, /Nothing is invented here/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /data-first-click="claim"/);
  assert.doesNotMatch(empty, /data-rolling-week/);
  assert.doesNotMatch(empty, /class="period-meta week-window"/);
  assert.doesNotMatch(empty, /data-prize=/);
  assert.doesNotMatch(empty, /data-book-number-one|class="book-one"|data-guest-first/);
  assert.doesNotMatch(empty, /24h lock/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  assert.match(occupied, /data-occupied="true"/);
  assert.match(occupied, /data-rolling-week=""/);
  assert.match(occupied, /Rolling last 7 days\. Not Monday 00:00 UTC\./);
  assert.match(occupied, /class="book-one"[^>]*data-guest-first=""/);
  assert.doesNotMatch(occupied, /class="empty-window"/);
  assert.doesNotMatch(occupied, /This weekend is unpublished/);
  assert.doesNotMatch(occupied, /data-empty-unpublished|unpublished-weekend/);
  assert.doesNotMatch(occupied, /24h lock/);
  assert.doesNotMatch(occupied, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.match(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-window/,
  );
  assert.match(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \[data-rolling-week\]/,
  );
  assert.match(
    css,
    /\.poster\[data-occupied="true"\] \.period-meta\.week-window\[data-rolling-week\]/,
  );
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}empty-window/);
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}rolling-week/);
});

test("occupied later Book stays a foot hop — Book #1 is the only filled hop", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  const laterFoot = css.match(
    /\[data-occupied="true"\] \.place\[data-later-book\] \.place-foot\[data-later-book-foot\]\s*\{([^}]*)\}/,
  );
  const laterBook = css.match(
    /\[data-occupied="true"\]\s*\.place\[data-later-book\]\s*\.place-foot\[data-later-book-foot\]\s*\.book-later\[data-later-book-foot\]\s*\{([^}]*)\}/,
  );
  const bookOne = css.match(
    /\[data-occupied="true"\] \.book-one\[data-book-after-list-seven\]\s*\{([^}]*)\}/,
  );
  assert.ok(laterFoot);
  assert.ok(laterBook);
  assert.ok(bookOne);
  assert.match(css, /Book #1 is the only filled hop/);
  assert.match(laterFoot[1], /border-top:\s*1px dashed var\(--rule-soft\)/);
  assert.match(laterBook[1], /display:\s*inline/);
  assert.match(laterBook[1], /min-width:\s*0/);
  assert.match(laterBook[1], /border:\s*0/);
  assert.match(laterBook[1], /background:\s*transparent/);
  assert.match(laterBook[1], /color:\s*var\(--muted\)/);
  assert.doesNotMatch(laterBook[1], /var\(--accent\)/);
  assert.doesNotMatch(laterBook[1], /background:\s*var\(--ink\)/);
  assert.doesNotMatch(laterBook[1], /min-height:\s*[1-9]/);
  assert.doesNotMatch(laterBook[1], /min-width:\s*10\.5rem/);
  assert.match(bookOne[1], /min-height:\s*9\.05rem/);
  assert.doesNotMatch(css, /^[\s]*\.book-later\s*[,{]/m);
  assert.doesNotMatch(css, /data-later-quiet/);
  assert.doesNotMatch(css, /data-list-after-book-nine|data-book-after-list-eight/);

  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [] }),
  );
  assert.doesNotMatch(empty, /data-later-book-foot|data-later-book|data-book-later|book-later|place-foot/);
  assert.doesNotMatch(empty, /data-book-number-one|class="book-one"|data-guest-first/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is unpublished/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);
  assert.doesNotMatch(empty, /data-list-after-book-nine|data-book-after-list-eight/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]] }),
  );
  assert.doesNotMatch(onlyOne, /data-later-book-foot|data-later-book|data-book-later|book-later|place-foot/);
  assert.match(onlyOne, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(onlyOne, /data-book-number-one=""/);
  assert.match(onlyOne, /data-prize=""/);
  assert.match(onlyOne, /Sunday Roast/);
  assert.equal((onlyOne.match(/class="book-one"/g) ?? []).length, 1);
  assert.doesNotMatch(onlyOne, /data-list-after-book-nine|data-book-after-list-eight/);

  const laterCard = renderToStaticMarkup(
    createElement(ListingCard, { listing: rankedCards[1] }),
  );
  const stamp = laterCard.indexOf("data-later-book");
  const laterRank = laterCard.indexOf("data-later-rank");
  const restName = laterCard.indexOf('class="rest-name"');
  const bid = laterCard.indexOf("data-bid");
  const foot = laterCard.indexOf('class="place-foot"');
  const footStamp = laterCard.indexOf('data-later-book-foot=""');
  const hop = laterCard.indexOf("data-book-later");
  const book = laterCard.indexOf(">Book<");
  const clicks = laterCard.indexOf("data-clicks");
  const footEnd = laterCard.indexOf("</footer>", foot);
  assert.ok(stamp >= 0 && laterRank >= 0 && restName >= 0);
  assert.ok(restName > laterRank && bid > restName && foot > bid);
  assert.ok(footStamp > foot && hop > footStamp && book > hop);
  assert.ok(clicks > hop && clicks < footEnd);
  assert.match(laterCard, /data-rank="2"/);
  assert.match(laterCard, /data-later-book=""/);
  assert.match(laterCard, /data-later-rank=""/);
  assert.match(laterCard, /class="rest-name"/);
  assert.match(laterCard, /class="place-foot"[^>]*data-later-book-foot=""/);
  assert.match(laterCard, /class="book-later"[^>]*data-later-book-foot=""/);
  assert.match(laterCard, /data-book-later=""/);
  assert.match(laterCard, />Book</);
  assert.match(laterCard, /href="\/api\/click\/lst_two"/);
  assert.match(laterCard, /Late Bar/);
  assert.match(laterCard, /\$8/);
  assert.doesNotMatch(laterCard, /class="book-one"|data-book-number-one|data-guest-first|data-book-one-first/);
  assert.doesNotMatch(laterCard, /data-weekend-answer|data-prize-before-price|data-prize=/);
  assert.doesNotMatch(laterCard, /data-later-quiet|class="title"|later-facts/);
  assert.doesNotMatch(laterCard, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(laterCard, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards }),
  );
  const prize = html.indexOf('data-prize=""');
  const bookOneStamp = html.indexOf("data-book-number-one");
  const guestHop = html.indexOf('data-guest-first=""', bookOneStamp);
  const later = html.indexOf('data-listing-id="lst_two"');
  const laterFootStamp = html.indexOf('data-later-book-foot=""', later);
  const laterHop = html.indexOf("data-book-later", later);
  const last = html.indexOf('data-listing-id="lst_three"');
  const lastFoot = html.indexOf('data-later-book-foot=""', last);
  const lastHop = html.indexOf("data-book-later", last);
  const form = html.indexOf("data-bid-form");
  assert.ok(prize >= 0 && bookOneStamp > prize && guestHop > bookOneStamp);
  assert.ok(later > guestHop && laterFootStamp > later && laterHop > laterFootStamp);
  assert.ok(last > laterHop && lastFoot > last && lastHop > lastFoot && form > lastHop);
  assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-number-one/g) ?? []).length, 1);
  assert.equal((html.match(/data-guest-first=""/g) ?? []).length, 2);
  assert.equal((html.match(/class="book-later"/g) ?? []).length, 2);
  assert.equal((html.match(/data-book-later=""/g) ?? []).length, 2);
  assert.equal((html.match(/data-later-book-foot=""/g) ?? []).length, 4);
  assert.equal((html.match(/data-prize=""/g) ?? []).length, 1);
  assert.match(html, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(html, /class="book-later"[^>]*data-later-book-foot=""/);
  assert.match(html, /class="place-foot"[^>]*data-later-book-foot=""/);
  assert.match(html, /data-occupied="true"/);
  assert.match(html, /Sunday Roast/);
  assert.match(html, /Late Bar/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html.slice(0, later), /data-later-book-foot|class="book-later"/);
  assert.doesNotMatch(html.slice(later), /data-weekend-answer|data-prize=|class="book-one"|data-guest-first/);
  assert.doesNotMatch(html, /data-later-quiet/);
  assert.doesNotMatch(html, /data-empty-board|unpublished-weekend/);
  assert.doesNotMatch(html, /data-list-after-book-nine|data-book-after-list-eight/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const unpaid = fixtureListing({
    id: "lst_ghost",
    venueName: "Ghost Bar",
    bidUsd: 99,
    rank: 1,
    firstPaidAt: "1970-01-01T00:00:00.000Z",
  });
  const unpaidHtml = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [unpaid] }),
  );
  assert.match(unpaidHtml, /No #1/);
  assert.match(unpaidHtml, /data-occupied="false"/);
  assert.doesNotMatch(unpaidHtml, /Ghost Bar/);
  assert.doesNotMatch(unpaidHtml, /data-later-book-foot|class="book-later"|class="book-one"/);
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
