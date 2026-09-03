import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { checkoutErrorCopy, CityBoard, ListingCard } from "../src/app/[city]/board";
import { getCity, type BoardListing } from "../src/core/cities";
import { default as HomePage } from "../src/app/page";

const nycCandidate = getCity("nyc");
if (!nycCandidate) throw new Error("missing NYC fixture");
const nyc: Exclude<typeof nycCandidate, undefined> = nycCandidate;

/** Thursday 2026-08-20 12:00 EDT — new bids open. */
const NYC_BIDS_OPEN = new Date("2026-08-20T16:00:00.000Z");
/** Sunday 2026-08-23 23:59:59.999 EDT — last instant new bids stay open. */
const NYC_BIDS_OPEN_SUNDAY = new Date("2026-08-24T03:59:59.999Z");
/** Thursday 2026-08-20 11:59:59.999 EDT — same ISO week, window_closed. */
const NYC_BIDS_CLOSED_THU_MORNING = new Date("2026-08-20T15:59:59.999Z");
/** Monday 2026-08-24 00:00:00.000 EDT — not a live claim on Monday. */
const NYC_BIDS_CLOSED_MONDAY = new Date("2026-08-24T04:00:00.000Z");

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

function renderBoard(
  listings: readonly BoardListing[] = rankedCards,
  now: Date = NYC_BIDS_OPEN,
): string {
  return renderToStaticMarkup(createElement(CityBoard, { city: nyc, listings, now }));
}

function renderCard(listing: BoardListing): string {
  return renderToStaticMarkup(createElement(ListingCard, { listing }));
}

test("GET / directly renders the canonical NYC board", async () => {
  const html = renderToStaticMarkup(await HomePage());
  assert.match(html, /data-board=""/);
  assert.match(html, /data-city="nyc"/);
  assert.match(html, /data-empty-board="true"/);
  assert.doesNotMatch(html, /NEXT_REDIRECT|redirect/);
});

test("empty NYC window renders the bid form and no cards", () => {
  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  assert.match(html, /data-board=""/);
  assert.match(html, /data-city="nyc"/);
  assert.match(html, /data-bid-form=""/);
  assert.match(html, /Venue name and booking URL/);
  assert.match(html, /name="amountUsd"/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.match(html, /name="city"/);
  assert.match(html, /value="nyc"/);
  assert.match(html, />Claim rank</);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /data-empty-board="true"/);
  assert.match(html, /Rank is money, not stars/);
  assert.doesNotMatch(html, /Checkout is not live/);
  assert.doesNotMatch(html, /data-checkout-stub/);
  assert.doesNotMatch(html, /data-listing-card/);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count/i);
});

test("venue field has a stable programmatic accessible name", () => {
  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  assert.match(html, /<input[^>]*aria-label="Venue name and booking URL"[^>]*name="venue"/);
});

test("unavailable checkout copy is explicit and does not invent a recovery link", () => {
  const html = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_OPEN,
      checkoutError: "waffo_unavailable",
    }),
  );
  assert.match(html, /Checkout is unavailable or still awaiting confirmation/);
  assert.match(html, /No rank is claimed until payment is confirmed/);
  assert.doesNotMatch(html, /data-checkout-recovery|checkout\/complete\?intent=/);
});

test("empty board reads like an unpublished weekend poster", () => {
  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  assert.match(html, /class="city-name"/);
  assert.match(html, />New York City</);
  assert.match(html, /One city · one weekend/);
  assert.match(html, /This Friday \/ Saturday/);
  assert.match(html, /class="empty-answer"/);
  assert.match(html, /class="unpublished-weekend"/);
  assert.match(html, /No #1/);
  assert.match(html, /This weekend is still open/);
  assert.match(html, /No venue has purchased the #1 position/);
  assert.match(html, /class="empty-window"/);
  assert.match(html, /Paid placements remain eligible for seven days\./);
  assert.match(html, /class="empty-bid-open"/);
  assert.match(
    html,
    /Claim rank is available any time\./,
  );
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
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  const emptyAnswer = empty.indexOf("data-empty-board");
  const emptyClaim = empty.indexOf("data-bid-form");
  assert.ok(emptyAnswer >= 0 && emptyClaim > emptyAnswer);
  const noOne = empty.indexOf("No #1");
  const unpublished = empty.indexOf("This weekend is still open");
  assert.ok(noOne >= 0 && unpublished > noOne);
  assert.match(empty, /class="empty-answer"/);
  assert.match(empty, /class="empty-note"/);
  assert.match(empty, /class="empty-window"/);
  assert.match(empty, /class="empty-bid-open"/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
  );
  const topCard = occupied.indexOf("data-listing-card");
  const occupiedClaim = occupied.indexOf("data-bid-form");
  assert.ok(occupiedClaim >= 0 && topCard > occupiedClaim);
  assert.match(occupied, /Sunday Roast/);
  assert.match(occupied, /\$12/);
  assert.doesNotMatch(occupied, /data-empty-board/);
});

test("cards show rank, venue, kind, $bid, clicks, and Book — not stars", () => {
const withPitch: BoardListing = {
  ...rankedCards[0],
  pitch: "Friday roast, walk-ins after nine.",
};
const html = renderCard(withPitch);
assert.match(html, /data-rank="1"/);
assert.match(html, /data-weekend-answer=""/);
assert.match(html, /data-book-one-first=""/);
assert.match(html, /data-book-number-one=""/);
assert.match(html, /data-guest-first=""/);
assert.match(html, /Sunday Roast/);
assert.match(html, /Restaurant/);
assert.match(html, /Friday roast, walk-ins after nine/);
assert.match(html, /\$12/);
assert.match(html, /4 clicks/);
assert.match(html, />Book</);
assert.match(html, /href="\/api\/click\/lst_top"/);
assert.doesNotMatch(
  html,
  /data-list-after-book|data-book-after-list|after the list hop|after Book follows List|after List follows Book/,
);
assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});
test("ranked cards keep money order in markup", () => {
  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
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

test("occupied hero exposes one list action and one paid-card booking path", () => {
const empty = renderBoard([]);
assert.doesNotMatch(empty, /data-list-venue|>List a venue<|class="book-one"/);

const occupied = renderBoard();
const details = occupied.match(/<details class="board-details"[\s\S]*?<\/details>/)?.[0] ?? "";
assert.equal((details.match(/data-list-venue=""/g) ?? []).length, 1);
assert.equal((details.match(/>List a venue<\/a>/g) ?? []).length, 1);
assert.match(details, /class="list-venue"[^>]*href="#claim"/);
assert.doesNotMatch(details, /Book|after the list hop|after Book follows List|after List follows Book/);
assert.match(occupied, /class="book-one"[^>]*data-book-number-one=""/);
assert.match(occupied, />Claim rank</);
assert.doesNotMatch(occupied, /data-empty-board/);
});
test("occupied board keeps the paid #1 answer before its single card booking CTA", () => {
const html = renderBoard();
const answer = html.indexOf("data-weekend-answer");
const bookOne = html.indexOf("data-book-number-one");
const later = html.indexOf('data-listing-id="lst_two"');
const claim = html.indexOf("data-bid-form");
assert.ok(claim >= 0 && answer > claim && bookOne > answer && later > bookOne);
assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
assert.equal((html.match(/data-book-number-one=""/g) ?? []).length, 1);
assert.match(html, /class="weekend-answer"/);
assert.match(html, /href="\/api\/click\/lst_top"/);
assert.match(html, /data-rank="1"/);
assert.match(html, /Sunday Roast/);
assert.match(html, /\$12/);
assert.match(html, /Claim #1 for/);

const laterCard = renderCard(rankedCards[1]);
assert.match(laterCard, /class="book-later"/);
assert.match(laterCard, /href="\/api\/click\/lst_two"/);
assert.doesNotMatch(laterCard, /data-weekend-answer|data-book-number-one|class="book-one"/);
});
test("occupied later ranks retain one genuine Book CTA per paid card", () => {
const empty = renderBoard([]);
assert.doesNotMatch(empty, /data-later-book|data-book-later|class="book-later"/);
assert.match(empty, /No #1/);

const laterCard = renderCard(rankedCards[1]);
assert.match(laterCard, /data-rank="2"/);
assert.match(laterCard, /data-later-book=""/);
assert.match(laterCard, /data-book-later=""/);
assert.match(laterCard, /class="book-later"/);
assert.match(laterCard, />Book</);
assert.match(laterCard, /href="\/api\/click\/lst_two"/);
assert.doesNotMatch(laterCard, /data-weekend-answer|data-book-one-first|data-book-number-one|class="book-one"/);

const html = renderBoard();
assert.equal((html.match(/class="book-later"/g) ?? []).length, 2);
assert.equal((html.match(/data-book-number-one=""/g) ?? []).length, 1);
assert.doesNotMatch(html, /data-list-after-book|data-book-after-list/);
});
test("occupied later rank styling stays quieter without hop-specific selectors", () => {
const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
const prizeSize = css.match(/clamp\(([\d.]+)rem, 9vw, 4\.4rem\)/);
const laterName = css.match(
  /\.place\[data-later-rank\] \.rest-name\s*\{([^}]*)\}/s,
);
const laterBook = css.match(
  /\.book-later\[data-later-book-foot\]\s*\{([^}]*)\}/s,
);
assert.ok(prizeSize && laterName && laterBook);
assert.match(laterName[1], /font-size:\s*1\.02rem/);
assert.match(laterBook[1], /display:\s*inline/);
assert.match(laterBook[1], /background:\s*transparent/);
assert.match(laterBook[1], /color:\s*var\(--muted\)/);
assert.doesNotMatch(css, /data-list-after-book|data-book-after-list|list-after-book|book-after-list/);

const html = renderBoard();
assert.match(html, /class="weekend-answer"/);
assert.match(html, /class="rest-name"/);
assert.equal((html.match(/class="book-later"/g) ?? []).length, 2);
});
test("occupied later Book stays quieter than Book #1 after $bid is a later fact", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  const prizeSize = css.match(/clamp\(([\d.]+)rem, 9vw, 4\.4rem\)/);
  const laterFacts = css.match(
    /\[data-occupied="true"\] \.number-one\[data-paid-at\] \.later-facts\[data-later-fact\]\s*\{([^}]*)\}/,
  );
  const laterBook = css.match(
    /\.book-later\[data-later-book-foot\]\s*\{([^}]*)\}/s,
  );
  assert.ok(prizeSize && laterFacts && laterBook);
  const laterBookSize = laterBook[1].match(/font-size:\s*([\d.]+)rem/);
  assert.ok(laterBookSize);
  assert.ok(Number(laterBookSize[1]) < Number(prizeSize[1]));
  assert.match(laterBook[1], /display:\s*inline/);
  assert.match(laterBook[1], /min-width:\s*0/);
  assert.match(laterBook[1], /border:\s*0/);
  assert.match(laterBook[1], /background:\s*transparent/);
  assert.match(laterBook[1], /color:\s*var\(--muted\)/);
  assert.doesNotMatch(laterBook[1], /var\(--accent\)/);
  assert.doesNotMatch(css, /data-list-after-book|data-book-after-list/);

  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  assert.doesNotMatch(empty, /data-later-book|data-book-later|book-later/);
  assert.doesNotMatch(empty, /data-later-quiet|data-later-stack|data-later-rank|class="rest-name"/);
  assert.doesNotMatch(empty, /data-later-fact|later-facts|later-fact/);
  assert.doesNotMatch(empty, /data-prize-before-price|data-prize=/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is still open/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);

  const onlyOne = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [rankedCards[0]], now: NYC_BIDS_OPEN }),
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
  assert.doesNotMatch(laterCard, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
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
  assert.ok(laterHop > laterFoot && last > laterHop && lastHop > last && form < laterHop);
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
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied Book #1 remains the first guest click", () => {
const empty = renderBoard([]);
assert.doesNotMatch(empty, /data-guest-first|data-book-one-first|data-book-number-one|class="book-one"/);

const card = renderCard(rankedCards[0]);
assert.match(card, /data-book-one-first=""/);
assert.match(card, /class="book-one"[^>]*data-book-number-one=""/);
assert.equal((card.match(/data-guest-first=""/g) ?? []).length, 2);
assert.equal((card.match(/data-book-number-one=""/g) ?? []).length, 1);

const html = renderBoard();
assert.equal((html.match(/class="book-one"/g) ?? []).length, 1);
assert.equal((html.match(/class="book-later"/g) ?? []).length, 2);
assert.match(html, /class="book-one"[^>]*data-guest-first=""/);
});
test("occupied hero has exactly one list action", () => {
const html = renderBoard();
const details = html.match(/<details class="board-details"[\s\S]*?<\/details>/)?.[0] ?? "";
assert.equal((details.match(/data-list-venue=""/g) ?? []).length, 1);
assert.equal((details.match(/>List a venue<\/a>/g) ?? []).length, 1);
assert.doesNotMatch(details, /Book/);
});
test("occupied hero has no redundant hop copy", () => {
const html = renderBoard();
assert.doesNotMatch(html, /after the list hop|after Book follows List|after List follows Book/);
assert.doesNotMatch(html, /data-list-after-book|data-book-after-list/);
});
test("occupied #1 keeps one primary card booking CTA", () => {
const card = renderCard(rankedCards[0]);
assert.equal((card.match(/class="book-one"/g) ?? []).length, 1);
assert.equal((card.match(/data-book-number-one=""/g) ?? []).length, 1);
assert.match(card, /aria-label="Book Sunday Roast"/);
});
test("occupied later cards keep their own booking CTA", () => {
const html = renderBoard();
assert.equal((html.match(/class="book-later"/g) ?? []).length, 2);
assert.match(html, /href="\/api\/click\/lst_two"/);
assert.match(html, /href="\/api\/click\/lst_three"/);
assert.doesNotMatch(html, /data-list-after-book|data-book-after-list/);
});
test("empty board exposes no occupied actions", () => {
const html = renderBoard([]);
assert.match(html, /data-empty-board="true"/);
assert.doesNotMatch(html, /data-list-venue|class="book-one"|class="book-later"|data-book-number-one/);
assert.match(html, /Claim #1 for/);
});
test("occupied list action points at the claim form", () => {
const html = renderBoard();
const list = html.match(/<a[^>]*class="list-venue"[^>]*>/)?.[0] ?? "";
assert.match(list, /href="#claim"/);
assert.match(list, /aria-label="List a venue"/);
assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
});
test("occupied action order leads with list then paid answer", () => {
const html = renderBoard();
const list = html.indexOf('data-list-venue=""');
const answer = html.indexOf("data-weekend-answer");
const book = html.indexOf("data-book-number-one");
const claim = html.indexOf("data-bid-form");
assert.ok(claim >= 0 && answer > claim && book > answer && list > book);
});
test("occupied hero has no repeated action labels", () => {
const html = renderBoard();
const details = html.match(/<details class="board-details"[\s\S]*?<\/details>/)?.[0] ?? "";
assert.equal((details.match(/>List a venue<\/a>/g) ?? []).length, 1);
assert.doesNotMatch(details, /Book|after the list hop|after Book follows List|after List follows Book/);
});
test("occupied card has no hop metadata", () => {
const card = renderCard(rankedCards[0]);
assert.doesNotMatch(card, /data-list-after-book|data-book-after-list|after the list hop|after Book follows List|after List follows Book/);
assert.match(card, /data-book-number-one=""/);
assert.match(card, /class="book-one"/);
});
test("occupied later stack has no list duplicate", () => {
const html = renderBoard();
assert.equal((html.match(/data-list-venue=""/g) ?? []).length, 1);
assert.equal((html.match(/class="list-venue"/g) ?? []).length, 1);
assert.match(html, /class="later-stack"/);
});
test("occupied later cards do not inherit hero list markers", () => {
const card = renderCard(rankedCards[1]);
assert.doesNotMatch(card, /data-list-venue|data-list-after-book|class="list-venue"/);
assert.match(card, /class="book-later"/);
assert.match(card, /data-later-book-foot=""/);
});
test("occupied hero action count stays stable", () => {
const html = renderBoard();
const details = html.match(/<details class="board-details"[\s\S]*?<\/details>/)?.[0] ?? "";
assert.equal((details.match(/<a\b/g) ?? []).length, 1);
assert.equal((details.match(/data-list-venue=""/g) ?? []).length, 1);
});
test("occupied #1 CTA remains visibly primary", () => {
const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
assert.match(css, /\.book-one\[data-book-number-one\]\[data-guest-first\]\s*\{[\s\S]*?min-height:\s*4\.35rem/);
assert.doesNotMatch(css, /data-book-after-list|data-list-after-book/);
assert.match(renderCard(rankedCards[0]), /data-book-number-one=""/);
});
test("occupied markup removes all hop prose", () => {
const html = renderBoard();
assert.doesNotMatch(html, /after the list hop|after Book follows List|after List follows Book/);
});
test("occupied markup removes numbered hop stamps", () => {
const html = renderBoard();
assert.doesNotMatch(html, /data-list-after-book|data-book-after-list/);
});
test("empty markup removes all hop stamps", () => {
const html = renderBoard([]);
assert.doesNotMatch(html, /data-list-after-book|data-book-after-list|after the list hop|after Book follows List|after List follows Book/);
});
test("occupied poster keeps list action after the historical window", () => {
const html = renderBoard(rankedCards, NYC_BIDS_CLOSED_MONDAY);
assert.match(html, /data-list-venue|>List a venue<\/a>/);
assert.match(html, /Claims are available any time/);
});
test("occupied poster keeps paid Book facts and open claim form", () => {
const html = renderBoard(rankedCards, NYC_BIDS_CLOSED_MONDAY);
assert.match(html, /data-claim-state="open"/);
assert.match(html, />Claim rank</);
assert.match(html, /data-bid-form/);
assert.match(html, /class="book-one"/);
assert.match(html, /class="book-later"/);
});
test("occupied poster retains truthful rolling eligibility copy", () => {
const html = renderBoard(rankedCards, NYC_BIDS_CLOSED_MONDAY);
assert.match(html, /Claims are available any time/);
assert.match(html, /Paid placements remain eligible for seven days/);
assert.doesNotMatch(html, /after the list hop|after Book follows List|after List follows Book/);
});
test("occupied poster keeps later paid cards after the historical window", () => {
const html = renderBoard(rankedCards, NYC_BIDS_CLOSED_MONDAY);
assert.equal((html.match(/class="book-later"/g) ?? []).length, 2);
assert.match(html, /data-list-venue/);
assert.doesNotMatch(html, /data-list-after-book|data-book-after-list/);
});
test("occupied NYC #1 reads the venue prize before price, larger than $bid", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  assert.doesNotMatch(empty, /data-prize-before-price|data-prize=/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is still open/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);
  assert.doesNotMatch(empty, /data-later-book|data-book-later|book-later/);

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
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
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
  assert.ok(form < occupiedPrize && laterHop > occupiedClicks);
  assert.equal((html.match(/data-prize-before-price=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-prize=""/g) ?? []).length, 1);
  assert.equal((html.match(/data-book-later/g) ?? []).length, 2);
  assert.match(html, /data-city="nyc"/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.match(html, /Claim #1 for/);
  assert.match(html, /List a venue this weekend/);
  assert.doesNotMatch(html, /data-empty-board/);
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
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  assert.doesNotMatch(empty, /data-later-fact/);
  assert.doesNotMatch(empty, /later-facts|later-fact/);
  assert.doesNotMatch(empty, /data-prize-before-price|data-prize=/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is still open/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);
  assert.doesNotMatch(empty, /data-book-number-one|data-book-one-first|class="book-one"|data-guest-first/);

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
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
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
  assert.ok(form < occupiedPrize && laterHop > occupiedFactsEnd);
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
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("empty NYC weekend stays unpublished without occupied chrome", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  const noOne = empty.indexOf("No #1");
  const unpublished = empty.indexOf("This weekend is still open");
  const windowCopy = empty.indexOf(
    "Paid placements remain eligible for seven days.",
  );
  const bidOpen = empty.indexOf(
    "Claim rank is available any time.",
  );
  const stamp = empty.indexOf('data-empty-unpublished=""');
  const form = empty.indexOf("data-bid-form");
  const checkout = empty.indexOf('action="/api/checkout"');
  const outbid = empty.indexOf(">Claim rank<");
  assert.ok(noOne >= 0 && unpublished > noOne);
  assert.ok(windowCopy > unpublished);
  assert.ok(bidOpen > windowCopy);
  assert.ok(stamp >= 0 && stamp < form);
  assert.ok(form > unpublished && checkout >= 0 && outbid > form);
  assert.match(empty, /data-empty-board="true"/);
  assert.match(empty, /data-occupied="false"/);
  assert.match(empty, /class="unpublished-weekend"/);
  assert.match(empty, /class="empty-answer"/);
  assert.match(empty, /class="empty-window"/);
  assert.match(empty, /class="empty-bid-open"/);
  assert.match(empty, /No venue has purchased the #1 position/);
  assert.doesNotMatch(empty, /data-rolling-week/);
  assert.match(empty, /Print this weekend/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /data-city="nyc"/);
  assert.doesNotMatch(empty, /class="fold"|fold-rule|empty-board /);
  assert.doesNotMatch(empty, /data-prize-before-price|data-prize=/);
  assert.doesNotMatch(empty, /data-later-fact|later-facts|later-fact/);
  assert.doesNotMatch(empty, /data-book-number-one|data-book-one-first|class="book-one"/);
  assert.doesNotMatch(empty, /data-unpaid-off-board/);
  assert.doesNotMatch(empty, /Checkout must be completed before a venue can join the ranking/);
  assert.doesNotMatch(empty, /data-listing-card|data-list-venue|data-later-book|data-later-quiet|data-later-stack|data-later-rank|class="rest-name"|data-guest-first/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
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
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  const weekend = empty.indexOf('class="unpublished-weekend"');
  const noOne = empty.indexOf("No #1");
  const unpublished = empty.indexOf("This weekend is still open");
  const form = empty.indexOf("data-bid-form");
  const checkout = empty.indexOf('action="/api/checkout"');
  const outbid = empty.indexOf(">Claim rank<");
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
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
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
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("claim form makes unpaid checkout never ranks certain on empty and occupied NYC", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  const emptyForm = empty.indexOf("data-bid-form");
  const emptyOutbid = empty.indexOf(">Claim rank<");
  const emptyCheckout = empty.indexOf('action="/api/checkout"');
  assert.ok(emptyForm >= 0 && emptyOutbid > emptyForm);
  assert.ok(emptyCheckout >= 0 && emptyCheckout < emptyOutbid);
  assert.doesNotMatch(empty, /data-unpaid-off-board/);
  assert.doesNotMatch(empty, /Checkout must be completed before a venue can join the ranking/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is still open/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /Print this weekend/);
  assert.match(empty, /Claim #1 for/);
  assert.match(empty, /action="\/api\/checkout"/);
  assert.doesNotMatch(empty, /data-listing-card/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
  );
  const occupiedForm = occupied.indexOf("data-bid-form");
  const occupiedRule = occupied.indexOf("data-unpaid-off-board");
  const occupiedCopy = occupied.indexOf("Checkout must be completed before a venue can join the ranking.");
  const occupiedOutbid = occupied.indexOf(">Claim rank<");
  const laterHop = occupied.indexOf("data-book-later");
  assert.ok(laterHop >= 0 && occupiedForm < laterHop);
  assert.ok(occupiedRule > occupiedForm && occupiedCopy > occupiedRule);
  assert.ok(occupiedOutbid > occupiedCopy);
  assert.equal((occupied.match(/data-unpaid-off-board=""/g) ?? []).length, 1);
  assert.match(occupied, /Checkout must be completed before a venue can join the ranking/);
  assert.match(occupied, /join the ranking/);
  assert.match(occupied, /List a venue this weekend/);
  assert.match(occupied, /Claim #1 for/);
  assert.match(occupied, /action="\/api\/checkout"/);
  assert.match(occupied, /Sunday Roast/);
  assert.doesNotMatch(occupied, /data-empty-board/);
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
  assert.doesNotMatch(occupied.slice(0, occupiedForm), /data-unpaid-off-board/);
});

test("empty NYC form leads with venue before one Claim rank submit", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.match(css, /\.poster\[data-occupied="false"\] \.claim \[data-bid-form\]/);
  assert.match(css, /\.poster\[data-occupied="false"\] \.claim \.bid-row/);

  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  const formStart = empty.indexOf('<form');
  const formEnd = empty.indexOf('</form>', formStart);
  assert.ok(formStart >= 0 && formEnd > formStart);
  const form = empty.slice(formStart, formEnd);
  const venue = form.indexOf('name="venue"');
  const outbid = form.indexOf(">Claim rank<");
  assert.ok(venue >= 0 && outbid > venue);
  assert.match(form, /<input[^>]*(?:required[^>]*name="venue"|name="venue"[^>]*required)/);
  assert.equal((form.match(/name="venue"/g) ?? []).length, 1);
  assert.equal((form.match(/type="submit"/g) ?? []).length, 1);
  assert.equal((form.match(/>Claim rank</g) ?? []).length, 1);
  assert.match(empty, /class="claim"/);
  assert.match(empty, /aria-label="Claim #1"/);
  assert.match(empty, /name="amountUsd"/);
  assert.match(empty, /class="amount-stepper"/);
  assert.match(empty, /Venue name and booking URL/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is still open/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /Print this weekend/);
  assert.match(empty, /data-occupied="false"/);
  assert.match(empty, /data-city="nyc"/);
  assert.doesNotMatch(empty, /data-list-venue|List a venue/);
  assert.doesNotMatch(empty, /data-book-number-one|data-book-one-first|class="book-one"|data-guest-first/);
  assert.doesNotMatch(empty, /data-later-book|data-book-later|class="book-later"|place-foot/);
  assert.doesNotMatch(empty, /data-later-stack|data-later-rank|class="rest-name"|Also this weekend/);
  assert.doesNotMatch(empty, /data-later-fact|later-facts|data-prize-before-price|data-prize=/);
  assert.doesNotMatch(empty, /data-unpaid-off-board/);
  assert.doesNotMatch(empty, /class="fold"|fold-rule/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
  );
  const occupiedFormStart = occupied.indexOf('<form');
  const occupiedFormEnd = occupied.indexOf('</form>', occupiedFormStart);
  assert.ok(occupiedFormStart >= 0 && occupiedFormEnd > occupiedFormStart);
  const occupiedForm = occupied.slice(occupiedFormStart, occupiedFormEnd);
  assert.ok(occupiedForm.indexOf('name="venue"') >= 0);
  assert.ok(occupiedForm.indexOf(">Claim rank<") > occupiedForm.indexOf('name="venue"'));
  assert.match(occupiedForm, /<input[^>]*(?:required[^>]*name="venue"|name="venue"[^>]*required)/);
  assert.equal((occupiedForm.match(/type="submit"/g) ?? []).length, 1);
  assert.equal((occupiedForm.match(/>Claim rank</g) ?? []).length, 1);
  assert.match(occupied, /class="bid-row"/);
  assert.match(occupied, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(occupied, /List a venue this weekend/);
  assert.match(occupied, /Claim #1 for/);
  assert.match(occupied, /action="\/api\/checkout"/);
  assert.match(occupied, /data-occupied="true"/);
  assert.match(occupied, /Sunday Roast/);
  assert.doesNotMatch(occupied, /data-empty-board|unpublished-weekend/);
  assert.match(occupied, /data-later-stack=""/);
  assert.match(occupied, /class="rest-name"/);
  assert.doesNotMatch(occupied, /data-later-quiet/);
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied later venues stay quieter than occupied #1 — prize stays first", () => {
const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
assert.match(css, /clamp\(2\.85rem, 9vw, 4\.4rem\)/);
assert.match(css, /\.later-stack\[data-later-stack\] \.place\[data-later-rank\] \.rest-name/);
assert.match(css, /\.book-later\[data-later-book-foot\]/);
assert.doesNotMatch(css, /data-list-after-book|data-book-after-list|list-after-book|book-after-list/);
const html = renderBoard();
assert.match(html, /class="weekend-answer"/);
assert.match(html, /class="rest-name"/);
assert.equal((html.match(/class="book-later"/g) ?? []).length, 2);
});
test("abandoned unpaid checkout stays off occupied /nyc — No #1 until Waffo reports paid", () => {
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

  const unpaid = fixtureListing({
    id: "lst_ghost",
    venueName: "Ghost Bar",
    bidUsd: 99,
    rank: 1,
    firstPaidAt: "1970-01-01T00:00:00.000Z",
  });
  const html = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [unpaid], now: NYC_BIDS_OPEN }),
  );
  const noOne = html.indexOf("No #1");
  const unpublished = html.indexOf("This weekend is still open");
  const claim = html.indexOf("Claim #1 for");
  const outbid = html.indexOf(">Claim rank<");
  const venue = html.indexOf('name="venue"');
  assert.ok(noOne >= 0 && unpublished > noOne && claim > unpublished && outbid > claim);
  assert.ok(venue > claim && outbid > venue);
  assert.match(html, /data-occupied="false"/);
  assert.match(html, /data-empty-unpublished=""/);
  assert.match(html, /class="unpublished-weekend"/);
  assert.match(html, /class="empty-answer"/);
  assert.match(html, /No venue has purchased the #1 position/);
  assert.match(html, /Print this weekend/);
  assert.match(html, /class="bid-row"/);
  assert.match(html, /action="\/api\/checkout"/);
  assert.doesNotMatch(html, /Ghost Bar/);
  assert.doesNotMatch(html, /data-listing-card|data-weekend-answer|data-prize=/);
  assert.doesNotMatch(html, /data-book-number-one|class="book-one"|data-guest-first/);
  assert.doesNotMatch(html, /class="fold"|data-later-stack|class="rest-name"/);
  assert.doesNotMatch(html, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(html, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [rankedCards[0], unpaid, rankedCards[1]],
      now: NYC_BIDS_OPEN,
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
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
});

test("occupied week window is rolling last-7-days — not Monday 00:00 UTC", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  assert.match(empty, /data-empty-board="true"/);
  assert.match(empty, /data-occupied="false"/);
  assert.match(empty, /No #1/);
  assert.match(empty, /This weekend is still open/);
  assert.match(empty, /Rank is money, not stars/);
  assert.doesNotMatch(empty, /data-rolling-week/);
  assert.doesNotMatch(empty, /class="period-meta week-window"/);
  assert.doesNotMatch(empty, /data-prize=/);
  assert.doesNotMatch(empty, /24h lock/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
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
  assert.ok(claimAt < firstClickAt);
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
  assert.match(occupied, />Claim rank</);
  assert.doesNotMatch(occupied, /data-empty-board/);
  assert.doesNotMatch(occupied, /This weekend is still open/);
  assert.doesNotMatch(occupied, /24h lock/);
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
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  const weekend = empty.indexOf('class="unpublished-weekend"');
  const noOne = empty.indexOf("No #1");
  const unpublished = empty.indexOf("This weekend is still open");
  const windowCopy = empty.indexOf(
    "Paid placements remain eligible for seven days.",
  );
  const bidOpen = empty.indexOf(
    "Claim rank is available any time.",
  );
  const form = empty.indexOf("data-bid-form");
  const outbid = empty.indexOf(">Claim rank<");
  assert.ok(weekend >= 0 && noOne > weekend);
  assert.ok(unpublished > noOne && windowCopy > unpublished);
  assert.ok(bidOpen > windowCopy);
  assert.ok(form > bidOpen && outbid > form);
  assert.match(empty, /class="empty-answer"/);
  assert.match(empty, /class="empty-window"/);
  assert.match(empty, /class="empty-bid-open"/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /data-occupied="false"/);
  assert.match(empty, /No venue has purchased the #1 position/);
  assert.match(empty, /Claim #1 for/);
  assert.doesNotMatch(empty, /data-rolling-week/);
  assert.doesNotMatch(empty, /class="period-meta week-window"/);
  assert.doesNotMatch(empty, /data-prize=/);
  assert.doesNotMatch(empty, /data-book-number-one|class="book-one"|data-guest-first/);
  assert.doesNotMatch(empty, /24h lock/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
  );
  assert.match(occupied, /data-occupied="true"/);
  assert.match(occupied, /data-rolling-week=""/);
  assert.match(occupied, /Rolling last 7 days\. Not Monday 00:00 UTC\./);
  assert.match(occupied, /class="book-one"[^>]*data-guest-first=""/);
  assert.doesNotMatch(occupied, /class="empty-window"/);
  assert.doesNotMatch(occupied, /class="empty-bid-open"/);
  assert.doesNotMatch(occupied, /This weekend is still open/);
  assert.doesNotMatch(occupied, /data-empty-unpublished|unpublished-weekend/);
  assert.doesNotMatch(occupied, /24h lock/);
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
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}empty-bid-open/);
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}rolling-week/);
});

test("empty unpublished names when new bids open — Thursday noon–Sunday local", () => {
  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  const weekend = empty.indexOf('class="unpublished-weekend"');
  const noOne = empty.indexOf("No #1");
  const unpublished = empty.indexOf("This weekend is still open");
  const windowCopy = empty.indexOf(
    "Paid placements remain eligible for seven days.",
  );
  const bidOpen = empty.indexOf(
    "Claim rank is available any time.",
  );
  const form = empty.indexOf("data-bid-form");
  const outbid = empty.indexOf(">Claim rank<");
  assert.ok(weekend >= 0 && noOne > weekend);
  assert.ok(unpublished > noOne && windowCopy > unpublished);
  assert.ok(bidOpen > windowCopy);
  assert.ok(form > bidOpen && outbid > form);
  assert.match(empty, /class="empty-answer"/);
  assert.match(empty, /class="empty-window"/);
  assert.match(empty, /class="empty-bid-open"/);
  assert.match(empty, /data-empty-unpublished=""/);
  assert.match(empty, /data-occupied="false"/);
  assert.match(empty, /No venue has purchased the #1 position/);
  assert.match(empty, /Claim #1 for/);
  assert.doesNotMatch(empty, /data-rolling-week/);
  assert.doesNotMatch(empty, /class="period-meta week-window"/);
  assert.doesNotMatch(empty, /data-prize=/);
  assert.doesNotMatch(empty, /data-book-number-one|class="book-one"|data-guest-first/);
  assert.doesNotMatch(empty, /24h lock/);
  assert.doesNotMatch(empty, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(empty, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
  );
  assert.match(occupied, /data-occupied="true"/);
  assert.match(occupied, /data-rolling-week=""/);
  assert.match(occupied, /Rolling last 7 days\. Not Monday 00:00 UTC\./);
  assert.match(occupied, /class="occupied-bid-close"/);
  assert.match(occupied, /Claims are available any time\./);
  assert.match(occupied, /class="book-one"[^>]*data-guest-first=""/);
  assert.doesNotMatch(occupied, /class="empty-window"/);
  assert.doesNotMatch(occupied, /class="empty-bid-open"/);
  assert.doesNotMatch(occupied, /Thursday noon/);
  assert.doesNotMatch(occupied, /Not anytime in the rolling week/);
  assert.doesNotMatch(occupied, /This weekend is still open/);
  assert.doesNotMatch(occupied, /data-empty-unpublished|unpublished-weekend/);
  assert.doesNotMatch(occupied, /24h lock/);
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.match(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-bid-open/,
  );
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
  assert.match(
    css,
    /\.poster\[data-occupied="true"\] \.book-one/,
  );
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}empty-bid-open/);
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}empty-window/);
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}rolling-week/);
});

test("empty board keeps Claim rank available outside the historical display window", () => {
  const closed = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_CLOSED_MONDAY,
    }),
  );
  const weekend = closed.indexOf('class="unpublished-weekend"');
  const noOne = closed.indexOf("No #1");
  const windowCopy = closed.indexOf(
    "Paid placements remain eligible for seven days.",
  );
  const bidOpen = closed.indexOf(
    "Claim rank is available any time.",
  );
  const closedCopy = closed.indexOf(
    "Claim rank is available any time.",
  );
  const reopen = closed.indexOf(
    "completed Waffo payment is confirmed.",
  );
  assert.ok(weekend >= 0 && noOne > weekend);
  const claimState = closed.indexOf('data-claim-state="open"');
  const claimStatus = closed.indexOf("Claim #1 for");
  assert.ok(noOne > weekend && windowCopy > noOne);
  assert.ok(bidOpen > windowCopy);
  assert.ok(closedCopy > windowCopy && claimState > closedCopy);
  assert.ok(claimStatus > claimState);
  assert.ok(reopen > closedCopy);
  assert.match(closed, /class="empty-answer"/);
  assert.match(closed, /class="empty-window"/);
  assert.match(closed, /class="empty-bid-open"/);
  assert.doesNotMatch(closed, /class="empty-window-closed"/);
  assert.match(
    closed,
    /class="empty-bid-open"[^>]*>[\s\S]*?Claim rank is available any time\./,
  );
  assert.match(closed, /data-empty-unpublished=""/);
  assert.match(closed, /data-bid-form=""/);
  assert.match(closed, /data-occupied="false"/);
  assert.match(closed, /No venue has purchased the #1 position/);
  assert.match(closed, /Claim rank is available any time/);
  assert.match(closed, /data-bid-form=""/);
  assert.match(closed, />Claim rank</);
  assert.match(closed, /Claim #1 for/);
  assert.match(closed, /data-claim-state="open"/);
  assert.match(closed, /completed Waffo payment is required before ranking/);
  assert.match(closed, /data-bid-form/);
  assert.doesNotMatch(closed, /data-rolling-week/);
  assert.doesNotMatch(closed, /class="period-meta week-window"/);
  assert.doesNotMatch(closed, /data-prize=/);
  assert.doesNotMatch(closed, /data-book-number-one|class="book-one"|data-guest-first/);
  assert.doesNotMatch(closed, /24h lock/);
  assert.doesNotMatch(closed, /data-window-closed-after|data-claim-after-closed/);
  assert.doesNotMatch(closed, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(closed, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const thursdayMorning = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_CLOSED_THU_MORNING,
    }),
  );
  assert.match(thursdayMorning, /data-bid-form=""/);
  assert.match(
    thursdayMorning,
    /Claim rank is available any time\./,
  );
  assert.match(thursdayMorning, />Claim rank</);
  assert.match(thursdayMorning, /Claim #1 for/);
  assert.match(thursdayMorning, /data-claim-state="open"/);
  assert.match(thursdayMorning, /data-bid-form/);
  assert.doesNotMatch(thursdayMorning, /data-rolling-week/);

  const openSunday = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_OPEN_SUNDAY,
    }),
  );
  assert.match(openSunday, />Claim rank</);
  assert.match(openSunday, /Claim #1 for/);
  assert.match(openSunday, /data-bid-form=""/);
  assert.match(openSunday, /This weekend is still open/);
  assert.match(openSunday, /No #1/);
  assert.doesNotMatch(openSunday, /data-window-closed/);
  assert.doesNotMatch(openSunday, /class="empty-window-closed"/);
  assert.doesNotMatch(openSunday, /New bids are closed/);
  assert.doesNotMatch(openSunday, /New bids reopen/);
  assert.doesNotMatch(openSunday, /data-rolling-week/);

  const occupiedMonday = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_CLOSED_MONDAY,
    }),
  );
  assert.match(occupiedMonday, /data-occupied="true"/);
  assert.match(occupiedMonday, /data-rolling-week=""/);
  assert.match(occupiedMonday, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(occupiedMonday, /Sunday Roast/);
  assert.doesNotMatch(occupiedMonday, /data-window-closed=""/);
  assert.match(occupiedMonday, /class="occupied-bid-close"/);
  assert.match(occupiedMonday, /Claims are available any time/);
  assert.match(occupiedMonday, /Paid placements remain eligible for seven days/);
  assert.match(occupiedMonday, /data-list-venue/);
  assert.match(occupiedMonday, />Claim rank</);
  assert.match(occupiedMonday, /Claim #1 for/);
  assert.match(occupiedMonday, /data-claim-state="open"/);
  assert.match(occupiedMonday, /data-bid-form/);
  assert.doesNotMatch(occupiedMonday, /class="empty-window-closed"/);
  assert.doesNotMatch(occupiedMonday, /This weekend is still open/);
  assert.doesNotMatch(occupiedMonday, /data-empty-unpublished|unpublished-weekend/);
  assert.doesNotMatch(occupiedMonday, /24h lock/);

  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-window-closed/,
  );
  assert.doesNotMatch(
    css,
    /\.claim\[data-claim-state="closed"\] \.claim-closed-row \.outbid/,
  );
  assert.match(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-bid-open/,
  );
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
  assert.match(
    css,
    /\.poster\[data-occupied="true"\] \.book-one/,
  );
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}empty-window-closed/);
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}empty-bid-open/);
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}empty-window/);
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}rolling-week/);
});

test("occupied historical window keeps Claim rank open with paid board facts", () => {
const closed = renderBoard(rankedCards, NYC_BIDS_CLOSED_MONDAY);
assert.match(closed, /data-claim-state="open"/);
assert.match(closed, />Claim rank</);
assert.doesNotMatch(closed, /data-claim-disabled|data-window-closed|New bids are closed/);
assert.match(closed, /data-bid-form/);
assert.match(closed, /class="book-one"/);
});
test("occupied historical window keeps the hero list action", () => {
const closed = renderBoard(rankedCards, NYC_BIDS_CLOSED_MONDAY);
assert.match(closed, /data-list-venue|>List a venue<\/a>/);
assert.match(closed, /Claims are available any time/);
});
test("occupied any-time claim state has no obsolete hop copy", () => {
const closed = renderBoard(rankedCards, NYC_BIDS_CLOSED_MONDAY);
assert.doesNotMatch(closed, /after the list hop|after Book follows List|after List follows Book/);
assert.doesNotMatch(closed, /data-list-after-book|data-book-after-list/);
assert.match(closed, /class="book-one"/);
});
test("occupied historical window keeps later stack listable", () => {
const closed = renderBoard(rankedCards, NYC_BIDS_CLOSED_MONDAY);
assert.match(closed, /These venues are not this weekend.*#1/);
assert.match(closed, /Paying less than #1 still lists/);
assert.match(closed, /data-list-venue/);
assert.doesNotMatch(closed, /data-list-after-book|data-book-after-list/);
});
test("occupied historical window uses the current weekend kicker", () => {
const closed = renderBoard(rankedCards, NYC_BIDS_CLOSED_MONDAY);
assert.match(closed, /class="later-stack-kicker later-stack-also">Also this weekend/);
assert.doesNotMatch(closed, /later-stack-closed-kicker|>Already ranked</);
});
test("occupied window_closed compatibility keeps claims open all week", () => {
  const closed = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_CLOSED_MONDAY,
    }),
  );
  const rolling = closed.indexOf("Rolling last 7 days. Not Monday 00:00 UTC.");
  const closedCopy = closed.indexOf(
    "Claims are available any time.",
  );
  const reopen = closed.indexOf(
    "first payment.",
  );
  const bookOne = closed.indexOf('class="book-one"');
  const guestFirst = closed.indexOf('data-guest-first=""');
  const alreadyRanked = closed.indexOf("Also this weekend");
  assert.ok(rolling >= 0 && closedCopy > rolling);
  assert.ok(bookOne < closedCopy && reopen > closedCopy);
  assert.ok(bookOne >= 0 && guestFirst >= 0);
  assert.ok(closedCopy > bookOne);
  assert.ok(alreadyRanked > bookOne);
  assert.match(closed, /data-occupied="true"/);
  assert.match(closed, /data-bid-form=""/);
  assert.match(closed, /data-rolling-week=""/);
  assert.match(closed, /class="period-meta week-window"/);
  assert.match(closed, /class="occupied-bid-close"/);
  assert.match(
    closed,
    /class="occupied-bid-close"[^>]*>[\s\S]*?Claims are available any time\./,
  );
  assert.match(closed, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(closed, /Sunday Roast/);
  assert.match(closed, /class="later-stack-kicker later-stack-also"/);
  assert.match(closed, /Also this weekend/);
  assert.match(closed, /Claims are available any time/);
  assert.match(closed, /data-list-venue/);
  assert.match(closed, /Also this weekend/);
  assert.match(closed, />Claim rank</);
  assert.match(closed, /Claim #1 for/);
  assert.match(closed, /data-claim-state="open"/);
  assert.match(closed, /data-bid-form/);
  assert.match(closed, />List a venue</);
  assert.match(closed, /href="#claim"/);
  assert.doesNotMatch(closed, /class="empty-window-closed"/);
  assert.doesNotMatch(closed, /class="empty-bid-open"/);
  assert.doesNotMatch(closed, /This weekend is still open/);
  assert.doesNotMatch(closed, /No #1/);
  assert.doesNotMatch(closed, /data-empty-unpublished|unpublished-weekend|data-empty-board/);
  assert.doesNotMatch(closed, /24h lock/);
  assert.doesNotMatch(closed, /data-window-closed-after|data-claim-after-closed|data-outbid-after-open/);
  assert.doesNotMatch(closed, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(closed, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const thursdayMorning = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_CLOSED_THU_MORNING,
    }),
  );
  assert.match(thursdayMorning, /data-occupied="true"/);
  assert.match(thursdayMorning, /data-bid-form=""/);
  assert.match(thursdayMorning, /class="occupied-bid-close"/);
  assert.match(
    thursdayMorning,
    /Claims are available any time\./,
  );
  assert.match(thursdayMorning, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(thursdayMorning, /Also this weekend/);
  assert.match(thursdayMorning, />Claim rank</);
  assert.match(thursdayMorning, /Claim #1 for/);
  assert.match(thursdayMorning, /data-claim-state="open"/);
  assert.match(thursdayMorning, />List a venue</);
  assert.match(thursdayMorning, /Also this weekend/);
  assert.doesNotMatch(thursdayMorning, /This weekend is still open/);
  assert.doesNotMatch(thursdayMorning, /class="empty-window-closed"/);

  const openSunday = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_OPEN_SUNDAY,
    }),
  );
  assert.match(openSunday, /data-occupied="true"/);
  assert.match(openSunday, />Claim rank</);
  assert.match(openSunday, /Claim #1 for/);
  assert.match(openSunday, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(openSunday, /Also this weekend/);
  assert.match(openSunday, /class="occupied-bid-close"/);
  assert.match(openSunday, /Claims are available any time\./);
  assert.doesNotMatch(openSunday, /data-window-closed/);
  assert.doesNotMatch(openSunday, /class="occupied-window-closed"/);
  assert.doesNotMatch(openSunday, /New bids are closed/);
  assert.doesNotMatch(openSunday, /reopen/);
  assert.doesNotMatch(openSunday, /Thursday noon/);
  assert.doesNotMatch(openSunday, /Already ranked/);

  const emptyClosed = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_CLOSED_MONDAY,
    }),
  );
  const emptyClosedCopy = emptyClosed.indexOf(
    "Claim rank is available any time.",
  );
  const emptyReopen = emptyClosed.indexOf(
    "completed Waffo payment is confirmed.",
  );
  assert.ok(emptyClosedCopy >= 0);
  assert.ok(emptyReopen > emptyClosedCopy);
  assert.match(emptyClosed, /data-occupied="false"/);
  assert.match(emptyClosed, /class="empty-bid-open"/);
  assert.match(emptyClosed, /This weekend is still open/);
  assert.doesNotMatch(emptyClosed, /class="empty-window-closed"/);
  assert.match(emptyClosed, /No #1/);
  assert.match(
    emptyClosed,
    /class="empty-bid-open"[^>]*>[\s\S]*?Claim rank is available any time\./,
  );
  assert.doesNotMatch(emptyClosed, /class="occupied-window-closed"/);
  assert.doesNotMatch(emptyClosed, /data-rolling-week/);
  assert.doesNotMatch(emptyClosed, /Already ranked/);
  assert.doesNotMatch(emptyClosed, /class="book-one"|data-guest-first/);

  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="true"\] \.occupied-window-closed/,
  );
  assert.match(
    css,
    /\.poster\[data-occupied="true"\] \.period-meta\.week-window\[data-rolling-week\]/,
  );
  assert.match(
    css,
    /\.poster\[data-occupied="true"\] \.book-one/,
  );
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-window-closed/,
  );
  assert.match(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-bid-open/,
  );
  const occupiedClosedCss = (
    css.split(
      "Occupied /nyc: window_closed is on the poster, not only a checkout error. Keep Book #1.",
      2,
    )[1] ?? ""
  ).split("/* Occupied Book #1 / later Book / later-facts cannot attach to unpublished /nyc. */")[0];
  assert.doesNotMatch(occupiedClosedCss, /occupied-window-closed/);
  assert.doesNotMatch(occupiedClosedCss, /background:\s*var\(--accent\)/);
  assert.doesNotMatch(occupiedClosedCss, /\.book-one/);
  assert.doesNotMatch(occupiedClosedCss, /display:\s*none[\s\S]{0,40}week-window|week-window[\s\S]{0,80}display:\s*none/);
  const emptyClosedCss = (
    css.split(
      "Empty unpublished: window_closed is on the poster, not only a checkout error.",
      2,
    )[1] ?? ""
  ).split("/* Occupied /nyc: window_closed is on the poster, not only a checkout error. Keep Book #1. */")[0];
  assert.doesNotMatch(emptyClosedCss, /occupied-window-closed/);
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}occupied-window-closed/);
});

test("occupied window_closed checkout errors stay recoverable while claims remain open", () => {
  assert.equal(
    checkoutErrorCopy("window_closed", { occupied: true, bidsOpen: false }),
    "Claims are available any time. No charge and no rank claimed.",
  );
  assert.equal(
    checkoutErrorCopy("window_closed"),
    "Claims are available any time. No charge and no rank claimed.",
  );
  assert.equal(
    checkoutErrorCopy("window_closed", { occupied: true, bidsOpen: true }),
    "Claims are available any time. No charge and no rank claimed.",
  );

  const closed = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_CLOSED_MONDAY,
      checkoutError: "window_closed",
    }),
  );
  const rolling = closed.indexOf("Rolling last 7 days. Not Monday 00:00 UTC.");
  const posterClosed = closed.indexOf(
    "Claims are available any time. Paid placements remain eligible for seven days",
  );
  const bookOne = closed.indexOf('class="book-one"');
  const alreadyRanked = closed.indexOf("Also this weekend");
  const checkoutError = closed.indexOf('data-checkout-error="true"');
  const checkoutCopy = closed.indexOf(
    "Claims are available any time. No charge and no rank claimed.",
  );
  assert.ok(rolling >= 0 && posterClosed > rolling);
  assert.ok(bookOne < posterClosed);
  assert.ok(alreadyRanked > bookOne);
  assert.ok(checkoutError >= 0 && checkoutError < posterClosed);
  assert.ok(checkoutCopy > checkoutError);
  assert.match(closed, /data-occupied="true"/);
  assert.match(closed, /data-bid-form=""/);
  assert.match(closed, /data-rolling-week=""/);
  assert.match(closed, /class="occupied-bid-close"/);
  assert.match(
    closed,
    /class="occupied-bid-close"[^>]*>[\s\S]*?Claims are available any time\./,
  );
  assert.match(closed, /data-checkout-error="true"/);
  assert.match(closed, /data-checkout-error="true"/);
  assert.match(closed, /class="stub-note"/);
  assert.match(closed, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(closed, /Sunday Roast/);
  assert.match(closed, /class="later-stack-kicker later-stack-also"/);
  assert.match(closed, /Also this weekend/);
  assert.match(closed, /Claims are available any time/);
  assert.match(closed, /data-list-venue/);
  assert.match(closed, /Also this weekend/);
  assert.match(closed, />Claim rank</);
  assert.match(closed, /Claim #1 for/);
  assert.match(closed, /data-claim-state="open"/);
  assert.match(closed, /data-bid-form/);
  assert.match(closed, />List a venue</);
  assert.match(closed, /href="#claim"/);
  assert.doesNotMatch(closed, /class="empty-window-closed"/);
  assert.doesNotMatch(closed, /This weekend is still open/);
  assert.doesNotMatch(closed, /No #1/);
  assert.doesNotMatch(closed, /data-empty-unpublished|unpublished-weekend|data-empty-board/);
  assert.doesNotMatch(closed, /24h lock/);
  assert.doesNotMatch(closed, /data-window-closed-after|data-claim-after-closed|data-outbid-after-open/);
  assert.doesNotMatch(closed, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(closed, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const noQuery = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_CLOSED_MONDAY,
    }),
  );
  assert.match(
    noQuery,
    /class="occupied-bid-close"[^>]*>[\s\S]*?Claims are available any time\./,
  );
  assert.doesNotMatch(noQuery, /data-checkout-error/);
  assert.doesNotMatch(noQuery, /data-occupied-closed-checkout-error/);
  assert.doesNotMatch(noQuery, /This weekend window is closed/);
  assert.match(noQuery, /data-bid-form/);
  assert.match(noQuery, />Claim rank</);
  assert.match(noQuery, /data-claim-state="open"/);

  const thursdayMorning = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_CLOSED_THU_MORNING,
      checkoutError: "window_closed",
    }),
  );
  assert.match(thursdayMorning, /data-occupied="true"/);
  assert.match(thursdayMorning, /data-bid-form=""/);
  assert.match(thursdayMorning, /data-checkout-error="true"/);
  assert.match(
    thursdayMorning,
    /Claims are available any time\. No charge and no rank claimed\./,
  );
  assert.match(thursdayMorning, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(thursdayMorning, /Also this weekend/);
  assert.match(thursdayMorning, />Claim rank</);
  assert.match(thursdayMorning, /data-claim-state="open"/);
  assert.match(thursdayMorning, /data-bid-form/);
  assert.match(thursdayMorning, />List a venue</);

  const openSunday = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_OPEN_SUNDAY,
      checkoutError: "window_closed",
    }),
  );
  assert.match(openSunday, /data-occupied="true"/);
  assert.match(openSunday, />Claim rank</);
  assert.match(openSunday, /Claim #1 for/);
  assert.match(openSunday, /data-bid-form/);
  assert.match(openSunday, /data-checkout-error="true"/);
  assert.match(
    openSunday,
    /Claims are available any time\. No charge and no rank claimed\./,
  );
  assert.doesNotMatch(openSunday, /data-window-closed/);
  assert.doesNotMatch(openSunday, /data-occupied-closed-checkout-error/);
  assert.doesNotMatch(openSunday, /class="occupied-window-closed"/);
  assert.doesNotMatch(openSunday, /New bids reopen/);
  assert.doesNotMatch(openSunday, /Thursday noon/);

  const emptyClosed = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_CLOSED_MONDAY,
      checkoutError: "window_closed",
    }),
  );
  assert.match(emptyClosed, /data-occupied="false"/);
  assert.match(emptyClosed, /class="empty-bid-open"/);
  assert.match(emptyClosed, /No #1/);
  assert.match(
    emptyClosed,
    /class="empty-bid-open"[^>]*>[\s\S]*?Claim rank is available any time\./,
  );
  assert.doesNotMatch(emptyClosed, /class="occupied-window-closed"/);
  assert.doesNotMatch(emptyClosed, /data-occupied-closed-checkout-error/);
  assert.doesNotMatch(emptyClosed, /class="occupied-closed-checkout-error"/);
  assert.match(emptyClosed, /data-bid-form/);
  assert.doesNotMatch(emptyClosed, /Already ranked/);
  assert.doesNotMatch(emptyClosed, /class="book-one"|data-guest-first/);

  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="true"\]\[data-window-closed\] \.occupied-closed-checkout-error\[data-checkout-error\]/,
  );
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="true"\] \.occupied-window-closed/,
  );
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.occupied-closed-checkout-error/,
  );
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-window-closed/,
  );
  const occupiedClosedCss = (
    css.split(
      "Occupied /nyc: window_closed is on the poster, not only a checkout error. Keep Book #1.",
      2,
    )[1] ?? ""
  ).split("/* Occupied Book #1 / later Book / later-facts cannot attach to unpublished /nyc. */")[0];
  assert.doesNotMatch(occupiedClosedCss, /occupied-window-closed/);
  assert.doesNotMatch(occupiedClosedCss, /occupied-closed-checkout-error/);
  assert.doesNotMatch(occupiedClosedCss, /background:\s*var\(--accent\)/);
  assert.doesNotMatch(occupiedClosedCss, /\.book-one/);
  assert.doesNotMatch(
    occupiedClosedCss,
    /occupied-closed-checkout-error[\s\S]{0,120}display:\s*none|display:\s*none[\s\S]{0,80}occupied-closed-checkout-error/,
  );
  const emptyClosedCss = (
    css.split(
      "Empty unpublished: window_closed is on the poster, not only a checkout error.",
      2,
    )[1] ?? ""
  ).split("/* Occupied /nyc: window_closed is on the poster, not only a checkout error. Keep Book #1. */")[0];
  assert.doesNotMatch(emptyClosedCss, /occupied-window-closed/);
  assert.doesNotMatch(emptyClosedCss, /occupied-closed-checkout-error/);
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}occupied-closed-checkout-error/);
});

test("empty window_closed checkout errors stay recoverable while claims remain open", () => {
  assert.equal(
    checkoutErrorCopy("window_closed", { occupied: false, bidsOpen: false }),
    "Claims are available any time. No charge and no rank claimed.",
  );
  assert.equal(
    checkoutErrorCopy("window_closed", { occupied: true, bidsOpen: false }),
    "Claims are available any time. No charge and no rank claimed.",
  );
  assert.equal(
    checkoutErrorCopy("window_closed"),
    "Claims are available any time. No charge and no rank claimed.",
  );
  assert.equal(
    checkoutErrorCopy("window_closed", { occupied: false, bidsOpen: true }),
    "Claims are available any time. No charge and no rank claimed.",
  );

  const closed = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_CLOSED_MONDAY,
      checkoutError: "window_closed",
    }),
  );
  const weekend = closed.indexOf('class="unpublished-weekend"');
  const noOne = closed.indexOf("No #1");
  const windowCopy = closed.indexOf(
    "Paid placements remain eligible for seven days.",
  );
  const posterClosed = closed.indexOf(
    "Claim rank is available any time.",
  );
  const posterReopen = closed.indexOf(
    "completed Waffo payment is confirmed.",
  );
  const checkoutError = closed.indexOf('data-checkout-error="true"');
  const checkoutCopy = closed.indexOf(
    "Claims are available any time. No charge and no rank claimed.",
  );
  const claimState = closed.indexOf('data-claim-state="open"');
  const claimStatus = closed.indexOf("Claim #1 for");
  assert.ok(weekend >= 0 && noOne > weekend);
  assert.ok(windowCopy > noOne && posterClosed > windowCopy);
  assert.ok(claimState > posterClosed && claimStatus > claimState);
  assert.ok(posterReopen > posterClosed);
  assert.ok(checkoutError > posterClosed);
  assert.ok(checkoutCopy > checkoutError);
  assert.match(closed, /data-occupied="false"/);
  assert.match(closed, /data-bid-form=""/);
  assert.match(closed, /data-empty-unpublished=""/);
  assert.match(closed, /class="empty-window"/);
  assert.match(closed, /class="empty-bid-open"/);
  assert.doesNotMatch(closed, /class="empty-window-closed"/);
  assert.match(
    closed,
    /class="empty-bid-open"[^>]*>\s*Claim rank is available any time\.[\s\S]*</,
  );
  assert.match(closed, /data-checkout-error="true"/);
  assert.match(closed, /data-checkout-error="true"/);
  assert.match(closed, /class="stub-note"/);
  assert.match(
    closed,
    /Claims are available any time\. No charge and no rank claimed\./,
  );
  assert.doesNotMatch(closed, /class="occupied-window-closed"/);
  assert.doesNotMatch(closed, /data-occupied-closed-checkout-error/);
  assert.doesNotMatch(closed, /class="occupied-closed-checkout-error"/);
  assert.match(closed, />Claim rank</);
  assert.match(closed, /Claim #1 for/);
  assert.match(closed, /data-claim-state="open"/);
  assert.match(closed, /data-bid-form/);
  assert.doesNotMatch(closed, />List a venue</);
  assert.doesNotMatch(closed, /href="#claim"/);
  assert.doesNotMatch(closed, /Already ranked/);
  assert.doesNotMatch(closed, /class="book-one"|data-guest-first/);
  assert.doesNotMatch(closed, /data-rolling-week/);
  assert.doesNotMatch(closed, /24h lock/);
  assert.doesNotMatch(closed, /data-window-closed-after|data-claim-after-closed|data-outbid-after-open/);
  assert.doesNotMatch(closed, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(closed, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const noQuery = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_CLOSED_MONDAY,
    }),
  );
  assert.match(
    noQuery,
    /class="empty-bid-open"[^>]*>[\s\S]*?Claim rank is available any time\./,
  );
  assert.doesNotMatch(noQuery, /data-checkout-error/);
  assert.doesNotMatch(noQuery, /data-empty-unpublished-checkout-error/);
  assert.doesNotMatch(noQuery, /This weekend window is closed/);
  assert.match(noQuery, /data-bid-form/);
  assert.match(noQuery, />Claim rank</);
  assert.match(noQuery, /data-claim-state="open"/);

  const thursdayMorning = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_CLOSED_THU_MORNING,
      checkoutError: "window_closed",
    }),
  );
  assert.match(thursdayMorning, /data-occupied="false"/);
  assert.match(thursdayMorning, /data-bid-form=""/);
  assert.match(thursdayMorning, /data-checkout-error="true"/);
  assert.match(
    thursdayMorning,
    /class="empty-bid-open"[^>]*>[\s\S]*?Claim rank is available any time\./,
  );
  assert.match(
    thursdayMorning,
    /Claims are available any time\. No charge and no rank claimed\./,
  );
  assert.match(thursdayMorning, />Claim rank</);
  assert.match(thursdayMorning, /data-claim-state="open"/);
  assert.match(thursdayMorning, /data-bid-form/);
  assert.doesNotMatch(thursdayMorning, /class="occupied-window-closed"/);
  assert.doesNotMatch(thursdayMorning, /data-occupied-closed-checkout-error/);
  assert.doesNotMatch(thursdayMorning, /class="book-one"|data-guest-first/);

  const openSunday = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_OPEN_SUNDAY,
      checkoutError: "window_closed",
    }),
  );
  assert.match(openSunday, /data-occupied="false"/);
  assert.match(openSunday, />Claim rank</);
  assert.match(openSunday, /Claim #1 for/);
  assert.match(openSunday, /data-bid-form/);
  assert.match(openSunday, /data-checkout-error="true"/);
  assert.match(
    openSunday,
    /Claims are available any time\. No charge and no rank claimed\./,
  );
  assert.doesNotMatch(openSunday, /data-window-closed/);
  assert.doesNotMatch(openSunday, /data-empty-unpublished-checkout-error/);
  assert.doesNotMatch(openSunday, /class="empty-window-closed"/);
  assert.doesNotMatch(openSunday, /New bids reopen/);

  const occupiedClosed = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_CLOSED_MONDAY,
      checkoutError: "window_closed",
    }),
  );
  assert.match(occupiedClosed, /data-occupied="true"/);
  assert.match(occupiedClosed, /data-checkout-error="true"/);
  assert.match(occupiedClosed, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(occupiedClosed, /Also this weekend/);
  assert.match(
    occupiedClosed,
    /class="occupied-bid-close"[^>]*>[\s\S]*?Claims are available any time\./,
  );
  assert.doesNotMatch(occupiedClosed, /data-empty-unpublished-checkout-error/);
  assert.doesNotMatch(occupiedClosed, /class="empty-unpublished-checkout-error"/);
  assert.doesNotMatch(occupiedClosed, /class="empty-window-closed"/);
  assert.doesNotMatch(occupiedClosed, /This weekend is still open/);
  assert.doesNotMatch(occupiedClosed, /No #1/);
  assert.match(occupiedClosed, /data-bid-form/);
  assert.match(occupiedClosed, />Claim rank</);
  assert.match(occupiedClosed, /Claim #1 for/);
  assert.match(occupiedClosed, /data-claim-state="open"/);

  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="false"\]\[data-window-closed\] \.empty-unpublished-checkout-error\[data-checkout-error\]/,
  );
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-window-closed/,
  );
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="true"\] \.empty-unpublished-checkout-error/,
  );
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="true"\]\[data-window-closed\] \.occupied-closed-checkout-error\[data-checkout-error\]/,
  );
  const emptyCheckoutCss = (
    css.split(
      "Empty unpublished checkout window_closed names when new bids reopen.",
      2,
    )[1] ?? ""
  ).split("/* Occupied /nyc: window_closed is on the poster, not only a checkout error. Keep Book #1. */")[0];
  assert.doesNotMatch(emptyCheckoutCss, /empty-unpublished-checkout-error/);
  assert.doesNotMatch(emptyCheckoutCss, /background:\s*var\(--accent\)/);
  assert.doesNotMatch(emptyCheckoutCss, /\.book-one/);
  assert.doesNotMatch(
    emptyCheckoutCss,
    /empty-unpublished-checkout-error[\s\S]{0,120}display:\s*none|display:\s*none[\s\S]{0,80}empty-unpublished-checkout-error/,
  );
  const emptyClosedCss = (
    css.split(
      "Empty unpublished: window_closed is on the poster, not only a checkout error.",
      2,
    )[1] ?? ""
  ).split("/* Occupied /nyc: window_closed is on the poster, not only a checkout error. Keep Book #1. */")[0];
  assert.doesNotMatch(emptyClosedCss, /empty-window-closed/);
  assert.doesNotMatch(emptyClosedCss, /empty-unpublished-checkout-error/);
  assert.doesNotMatch(emptyClosedCss, /occupied-window-closed/);
  assert.doesNotMatch(emptyClosedCss, /occupied-closed-checkout-error/);
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}empty-unpublished-checkout-error/);
});

test("empty board stays claimable when window_closed is requested", () => {
  const closed = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_CLOSED_MONDAY,
    }),
  );
  const weekend = closed.indexOf('class="unpublished-weekend"');
  const noOne = closed.indexOf("No #1");
  const windowCopy = closed.indexOf(
    "Paid placements remain eligible for seven days.",
  );
  const closedCopy = closed.indexOf(
    "Claim rank is available any time.",
  );
  const reopen = closed.indexOf(
    "completed Waffo payment is confirmed.",
  );
  const claimState = closed.indexOf('data-claim-state="open"');
  const claimStatus = closed.indexOf("Claim #1 for");
  assert.ok(weekend >= 0 && noOne > weekend);
  assert.ok(windowCopy > noOne && closedCopy > windowCopy);
  assert.ok(claimState > closedCopy && claimStatus > claimState);
  assert.ok(reopen > closedCopy);
  assert.match(closed, /class="empty-answer"/);
  assert.match(closed, /class="empty-window"/);
  assert.match(closed, /class="empty-bid-open"/);
  assert.doesNotMatch(closed, /class="empty-window-closed"/);
  assert.match(
    closed,
    /class="empty-bid-open"[^>]*>[\s\S]*?Claim rank is available any time\./,
  );
  assert.match(closed, /data-empty-unpublished=""/);
  assert.match(closed, /data-bid-form=""/);
  assert.match(closed, /data-occupied="false"/);
  assert.match(closed, /No venue has purchased the #1 position/);
  assert.match(closed, />Claim rank</);
  assert.match(closed, /Claim #1 for/);
  assert.match(closed, /data-claim-state="open"/);
  assert.match(closed, /data-bid-form/);
  assert.doesNotMatch(closed, /data-checkout-error/);
  assert.doesNotMatch(closed, /data-empty-unpublished-checkout-error/);
  assert.doesNotMatch(closed, /This weekend window is closed/);
  assert.doesNotMatch(closed, /class="occupied-window-closed"/);
  assert.doesNotMatch(closed, /data-rolling-week/);
  assert.doesNotMatch(closed, /class="period-meta week-window"/);
  assert.doesNotMatch(closed, /data-prize=/);
  assert.doesNotMatch(closed, /data-book-number-one|class="book-one"|data-guest-first/);
  assert.doesNotMatch(closed, /Already ranked/);
  assert.doesNotMatch(closed, /24h lock/);
  assert.doesNotMatch(closed, /data-window-closed-after|data-claim-after-closed|data-outbid-after-open/);
  assert.doesNotMatch(closed, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(closed, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);

  const thursdayMorning = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_CLOSED_THU_MORNING,
    }),
  );
  assert.match(thursdayMorning, /data-occupied="false"/);
  assert.match(thursdayMorning, /data-bid-form=""/);
  assert.match(thursdayMorning, /class="empty-bid-open"/);
  assert.match(
    thursdayMorning,
    /class="empty-bid-open"[^>]*>[\s\S]*?Claim rank is available any time\./,
  );
  assert.match(thursdayMorning, />Claim rank</);
  assert.match(thursdayMorning, /Claim #1 for/);
  assert.match(thursdayMorning, /data-claim-state="open"/);
  assert.match(thursdayMorning, /data-bid-form/);
  assert.doesNotMatch(thursdayMorning, /data-empty-unpublished-checkout-error/);
  assert.doesNotMatch(thursdayMorning, /class="occupied-window-closed"/);
  assert.doesNotMatch(thursdayMorning, /data-rolling-week/);
  assert.doesNotMatch(thursdayMorning, /class="book-one"|data-guest-first/);

  const openSunday = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_OPEN_SUNDAY,
    }),
  );
  assert.match(openSunday, />Claim rank</);
  assert.match(openSunday, /Claim #1 for/);
  assert.match(openSunday, /data-bid-form=""/);
  assert.match(openSunday, /This weekend is still open/);
  assert.match(openSunday, /No #1/);
  assert.match(
    openSunday,
    /Claim rank is available any time\./,
  );
  assert.doesNotMatch(openSunday, /data-window-closed/);
  assert.doesNotMatch(openSunday, /class="empty-window-closed"/);
  assert.doesNotMatch(openSunday, /New bids are closed/);
  assert.doesNotMatch(openSunday, /New bids reopen/);
  assert.doesNotMatch(openSunday, /data-rolling-week/);

  const occupiedClosed = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_CLOSED_MONDAY,
    }),
  );
  assert.match(occupiedClosed, /data-occupied="true"/);
  assert.match(occupiedClosed, /data-rolling-week=""/);
  assert.match(occupiedClosed, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(occupiedClosed, /Also this weekend/);
  assert.match(
    occupiedClosed,
    /class="occupied-bid-close"[^>]*>[\s\S]*?Claims are available any time\./,
  );
  assert.doesNotMatch(occupiedClosed, /class="empty-window-closed"/);
  assert.doesNotMatch(occupiedClosed, /This weekend is still open/);
  assert.doesNotMatch(occupiedClosed, /No #1/);
  assert.doesNotMatch(occupiedClosed, /data-empty-unpublished|unpublished-weekend/);
  assert.match(occupiedClosed, />Claim rank</);
  assert.match(occupiedClosed, /data-claim-state="open"/);
  assert.match(occupiedClosed, /data-bid-form/);

  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-window-closed/,
  );
  assert.match(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-bid-open/,
  );
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="true"\] \.occupied-window-closed/,
  );
  const emptyClosedCss = (
    css.split(
      "Empty unpublished: window_closed is on the poster, not only a checkout error.",
      2,
    )[1] ?? ""
  ).split("/* Occupied /nyc: window_closed is on the poster, not only a checkout error. Keep Book #1. */")[0];
  assert.doesNotMatch(emptyClosedCss, /empty-window-closed/);
  assert.doesNotMatch(emptyClosedCss, /occupied-window-closed/);
  assert.doesNotMatch(emptyClosedCss, /background:\s*var\(--accent\)/);
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}empty-window-closed/);
});

test("occupied board names rolling eligibility while claims stay open", () => {
  const occupied = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: rankedCards, now: NYC_BIDS_OPEN }),
  );
  const rolling = occupied.indexOf("Rolling last 7 days. Not Monday 00:00 UTC.");
  const bidClose = occupied.indexOf("Claims are available any time.");
  const bidCloseClass = occupied.indexOf('class="occupied-bid-close"');
  const bookOne = occupied.indexOf('class="book-one"');
  const guestFirst = occupied.indexOf('data-guest-first=""');
  const outbid = occupied.indexOf(">Claim rank<");
  const claim = occupied.indexOf("Claim #1 for");
  assert.ok(rolling >= 0 && bidCloseClass > rolling);
  assert.ok(bidClose > bidCloseClass);
  assert.ok(bookOne < bidClose && guestFirst >= 0);
  assert.ok(outbid < bookOne && claim > 0 && claim < bookOne);
  assert.match(occupied, /data-occupied="true"/);
  assert.match(occupied, /data-rolling-week=""/);
  assert.match(occupied, /class="period-meta week-window"/);
  assert.match(
    occupied,
    /class="occupied-bid-close"[^>]*>[\s\S]*?Claims are available any time\./,
  );
  assert.match(occupied, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(occupied, /Sunday Roast/);
  assert.match(occupied, />Claim rank</);
  assert.match(occupied, /Claim #1 for/);
  assert.match(occupied, /data-bid-form=""/);
  assert.match(occupied, /Also this weekend/);
  assert.doesNotMatch(occupied, /data-window-closed/);
  assert.doesNotMatch(occupied, /class="occupied-window-closed"/);
  assert.doesNotMatch(occupied, /New bids are closed/);
  assert.doesNotMatch(occupied, /reopen/);
  assert.doesNotMatch(occupied, /Thursday noon/);
  assert.doesNotMatch(occupied, /Not anytime in the rolling week/);
  assert.doesNotMatch(occupied, /class="empty-bid-open"/);
  assert.doesNotMatch(occupied, /class="empty-window-closed"/);
  assert.doesNotMatch(occupied, /This weekend is still open/);
  assert.doesNotMatch(occupied, /No #1/);
  assert.doesNotMatch(occupied, /data-empty-unpublished|unpublished-weekend|data-empty-board/);
  assert.doesNotMatch(occupied, /Already ranked/);
  assert.doesNotMatch(occupied, /24h lock/);
  assert.doesNotMatch(occupied, /data-window-closed-after|data-claim-after-closed|data-outbid-after-open/);
  assert.doesNotMatch(occupied, /map|leaflet|google\.maps|OpenStreetMap/i);
  assert.doesNotMatch(occupied, /★|4\.8|star-rating|data-stars|review count|rated 4\.9/i);
  assert.equal((occupied.match(/class="book-one"/g) ?? []).length, 1);
  assert.equal((occupied.match(/data-guest-first=""/g) ?? []).length, 2);

  const openSunday = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_OPEN_SUNDAY,
    }),
  );
  assert.match(openSunday, /data-occupied="true"/);
  assert.match(openSunday, /class="occupied-bid-close"/);
  assert.match(openSunday, /Claims are available any time\./);
  assert.match(openSunday, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(openSunday, />Claim rank</);
  assert.match(openSunday, /Claim #1 for/);
  assert.doesNotMatch(openSunday, /data-window-closed/);
  assert.doesNotMatch(openSunday, /class="occupied-window-closed"/);
  assert.doesNotMatch(openSunday, /Thursday noon/);
  assert.doesNotMatch(openSunday, /New bids are closed/);
  assert.doesNotMatch(openSunday, /reopen/);

  const closed = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_CLOSED_MONDAY,
    }),
  );
  const closedRolling = closed.indexOf("Rolling last 7 days. Not Monday 00:00 UTC.");
  const closedCopy = closed.indexOf(
    "Claims are available any time.",
  );
  const reopen = closed.indexOf(
    "first payment.",
  );
  const closedBook = closed.indexOf('class="book-one"');
  const alreadyRanked = closed.indexOf("Also this weekend");
  assert.ok(closedRolling >= 0 && closedCopy > closedRolling);
  assert.ok(closedBook < closedCopy && reopen > closedCopy);
  assert.ok(alreadyRanked > closedBook);
  assert.match(closed, /data-occupied="true"/);
  assert.match(closed, /data-bid-form=""/);
  assert.match(
    closed,
    /class="occupied-bid-close"[^>]*>[\s\S]*?Claims are available any time\./,
  );
  assert.match(closed, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(closed, /Also this weekend/);
  assert.match(closed, /class="occupied-bid-close"/);
  assert.doesNotMatch(closed, /New bids close Sunday/);
  assert.match(closed, />Claim rank</);
  assert.match(closed, /Claim #1 for/);
  assert.match(closed, /data-claim-state="open"/);
  assert.match(closed, /data-bid-form/);
  assert.match(closed, /Also this weekend/);
  assert.doesNotMatch(closed, /This weekend is still open/);

  const thursdayMorning = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: rankedCards,
      now: NYC_BIDS_CLOSED_THU_MORNING,
    }),
  );
  assert.match(thursdayMorning, /data-occupied="true"/);
  assert.match(thursdayMorning, /data-bid-form=""/);
  assert.match(
    thursdayMorning,
    /Claims are available any time\./,
  );
  assert.match(thursdayMorning, /class="book-one"[^>]*data-guest-first=""/);
  assert.match(thursdayMorning, /class="occupied-bid-close"/);
  assert.doesNotMatch(thursdayMorning, /New bids close Sunday/);
  assert.match(thursdayMorning, />Claim rank</);
  assert.match(thursdayMorning, /Claim #1 for/);
  assert.match(thursdayMorning, /data-claim-state="open"/);

  const empty = renderToStaticMarkup(
    createElement(CityBoard, { city: nyc, listings: [], now: NYC_BIDS_OPEN }),
  );
  const emptyBidOpen = empty.indexOf(
    "Claim rank is available any time.",
  );
  assert.ok(emptyBidOpen >= 0);
  assert.match(empty, /data-occupied="false"/);
  assert.match(empty, /class="empty-bid-open"/);
  assert.match(empty, /This weekend is still open/);
  assert.match(empty, /No #1/);
  assert.match(empty, />Claim rank</);
  assert.match(empty, /Claim #1 for/);
  assert.doesNotMatch(empty, /class="occupied-bid-close"/);
  assert.doesNotMatch(empty, /New bids close Sunday/);
  assert.doesNotMatch(empty, /data-rolling-week/);
  assert.doesNotMatch(empty, /class="book-one"|data-guest-first/);

  const emptyClosed = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_CLOSED_MONDAY,
    }),
  );
  assert.match(
    emptyClosed,
    /class="empty-bid-open"[^>]*>[\s\S]*?Claim rank is available any time\./,
  );
  assert.doesNotMatch(emptyClosed, /class="occupied-bid-close"/);
  assert.doesNotMatch(emptyClosed, /class="occupied-window-closed"/);
  assert.doesNotMatch(emptyClosed, /New bids close Sunday/);
  assert.doesNotMatch(emptyClosed, /Already ranked/);
  assert.doesNotMatch(emptyClosed, /class="book-one"|data-guest-first/);

  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.match(css, /\.poster\[data-occupied="true"\] \.occupied-bid-close/);
  assert.match(
    css,
    /\.poster\[data-occupied="true"\] \.period-meta\.week-window\[data-rolling-week\]/,
  );
  assert.match(css, /\.poster\[data-occupied="true"\] \.book-one/);
  assert.match(css, /\.poster\[data-occupied="false"\] \.occupied-bid-close/);
  assert.match(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.occupied-bid-close/,
  );
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="true"\]\[data-window-closed\] \.occupied-bid-close/,
  );
  assert.doesNotMatch(
    css,
    /\.poster\[data-occupied="true"\] \.occupied-window-closed/,
  );
  assert.match(
    css,
    /\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-bid-open/,
  );
  const occupiedOpenCss = css.match(
    /\.poster\[data-occupied="true"\] \.occupied-bid-close\s*\{[^}]*\}/,
  )?.[0] ?? "";
  assert.ok(occupiedOpenCss);
  assert.match(occupiedOpenCss, /occupied-bid-close/);
  assert.doesNotMatch(occupiedOpenCss, /background:\s*var\(--accent\)/);
  assert.doesNotMatch(occupiedOpenCss, /\.book-one/);
  assert.doesNotMatch(occupiedOpenCss, /display:\s*none/);
  const occupiedClosedCss = (
    css.split(
      "Occupied /nyc: window_closed is on the poster, not only a checkout error. Keep Book #1.",
      2,
    )[1] ?? ""
  ).split("/* Occupied Book #1 / later Book / later-facts cannot attach to unpublished /nyc. */")[0];
  assert.doesNotMatch(occupiedClosedCss, /occupied-window-closed/);
  assert.doesNotMatch(occupiedClosedCss, /occupied-bid-close/);
  assert.doesNotMatch(occupiedClosedCss, /background:\s*var\(--accent\)/);
  assert.doesNotMatch(occupiedClosedCss, /\.book-one/);
  const emptyBidOpenCss = (
    css.split(
      "Empty unpublished boards advertise the always-open claim action.",
      2,
    )[1] ?? ""
  ).split("/* Occupied Book #1 / later Book / later-facts cannot attach to unpublished /nyc. */")[0];
  assert.match(emptyBidOpenCss, /empty-bid-open/);
  assert.doesNotMatch(emptyBidOpenCss, /occupied-bid-close/);
  assert.doesNotMatch(css, /background:\s*var\(--accent\)[\s\S]{0,80}occupied-bid-close/);
});

test("occupied later Book remains an unfilled foot CTA", () => {
const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
const laterBook = css.match(/\.book-later\[data-later-book-foot\]\s*\{([^}]*)\}/s);
assert.ok(laterBook);
assert.match(laterBook[1], /display:\s*inline/);
assert.match(laterBook[1], /min-width:\s*0/);
assert.match(laterBook[1], /border:\s*0/);
assert.match(laterBook[1], /background:\s*transparent/);
assert.doesNotMatch(laterBook[1], /var\(--accent\)/);
assert.doesNotMatch(css, /data-list-after-book|data-book-after-list|list-after-book|book-after-list/);
const card = renderCard(rankedCards[1]);
assert.match(card, /class="book-later"/);
assert.match(card, /data-later-book-foot=""/);
});
test("failed checkout returns an honest error on the poster, not a stub", () => {
  const html = renderToStaticMarkup(
    createElement(CityBoard, {
      city: nyc,
      listings: [],
      now: NYC_BIDS_OPEN,
      checkoutError: "listing_invalid",
    }),
  );
  assert.match(html, /data-checkout-error="true"/);
  assert.match(html, /Need a venue name and a booking URL/);
  assert.doesNotMatch(html, /Checkout is not live/);
  assert.doesNotMatch(html, /data-listing-card/);
});
