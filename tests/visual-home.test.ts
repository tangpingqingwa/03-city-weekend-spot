import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CityPage from "../src/app/[city]/page";
import { CityBoard } from "../src/app/[city]/board";
import { getCity, type BoardListing } from "../src/core/cities";
import { periodFromKey, periodHref } from "../src/app/period-tabs-state";

const resolvedCity = getCity("nyc");
if (!resolvedCity) throw new Error("missing NYC fixture");
const city: Exclude<typeof resolvedCity, undefined> = resolvedCity;

const listings: BoardListing[] = [
  {
    id: "visual_top",
    city: "nyc",
    kind: "restaurant",
    venueName: "Sunday Roast",
    bookingUrl: "https://book.example.com/visual-top",
    pitch: "Friday roast, walk-ins after nine.",
    bidUsd: 12,
    clicks: 4,
    rank: 1,
    firstPaidAt: "2026-08-20T16:00:00.000Z",
  },
  {
    id: "visual_two",
    city: "nyc",
    kind: "bar",
    venueName: "Late Bar",
    bookingUrl: "https://book.example.com/visual-two",
    pitch: null,
    bidUsd: 8,
    clicks: 1,
    rank: 2,
    firstPaidAt: "2026-08-20T16:01:00.000Z",
  },
  {
    id: "visual_three",
    city: "nyc",
    kind: "show",
    venueName: "Cellar Show",
    bookingUrl: "https://book.example.com/visual-three",
    pitch: null,
    bidUsd: 5,
    clicks: 0,
    rank: 3,
    firstPaidAt: "2026-08-20T16:02:00.000Z",
  },
];

function renderBoard(boardListings: readonly BoardListing[] = listings): string {
  return renderToStaticMarkup(
    createElement(CityBoard, {
      city,
      listings: boardListings,
      now: new Date("2026-08-20T16:00:00.000Z"),
    }),
  );
}

test("homepage visual shell exposes context, rail, and disabled-ready controls", () => {
  const html = renderBoard();
  const context = html.indexOf('data-slot="stats-pill"');
  const claim = html.indexOf('data-slot="claim-hero"');
  const heading = html.indexOf('data-slot="claim-heading"');
  const form = html.indexOf('data-slot="claim-form"');
  const rail = html.indexOf('data-slot="category-rail"');
  const cards = html.indexOf('data-slot="top-three"');
  assert.ok(context >= 0 && claim > context && heading > claim && form > heading);
  assert.ok(rail > form && cards > rail);
  assert.equal((html.match(/data-slot="paid-card"/g) ?? []).length, 3);
  assert.match(html, /data-slot="claim-heading"/);
  assert.match(
    html,
    /<input[^>]*(?:name="amountUsd"[^>]*form="claim-controls-nyc"|form="claim-controls-nyc"[^>]*name="amountUsd")/,
  );
  assert.match(html, /data-slot="url-input"/);
  assert.match(html, /data-slot="category-control"/);
  assert.match(html, /data-slot="claim-button"/);
  assert.match(html, /data-context-pill=""/);
  assert.match(html, /href="\/rules"/);
  assert.match(html, /data-category-rail=""/);
  assert.match(html, /data-selected-category="all"/);
  assert.match(html, /<input type="hidden"[^>]*name="kind"[^>]*value=""/);
  assert.match(html, /class="category-select"[^>]*aria-expanded="false"/);
  assert.match(html, /class="category-more"[^>]*aria-expanded="false"/);
  assert.match(html, /class="outbid"[^>]*disabled=""/);
  assert.match(html, />Claim rank</);
  assert.match(html, /data-claim-ready="false"/);
  assert.match(html, /Rank is the bid/);
  assert.doesNotMatch(html, /listing-avatar|[\u2315\u263e\u25ce\u2304\u25a6\u2302\u25cc\u2726\u203a]/);
  assert.equal((html.match(/data-top-rank=""/g) ?? []).length, 3);
  assert.doesNotMatch(html, /data-board-summary|data-todays-ranking|data-latest-activity/);
  assert.doesNotMatch(html, /Today&#x27;s top ranking|Today&apos;s top ranking|Latest activity/);
  assert.doesNotMatch(html, /data-category-menu=""/);
});

test("empty visual shell keeps the honest unpublished and paid-only contract", () => {
  const html = renderBoard([]);
  assert.match(html, /data-empty-board="true"/);
  assert.match(html, /data-empty-unpublished=""/);
  assert.match(html, /No #1/);
  assert.match(html, /data-bid-form=""/);
  assert.doesNotMatch(html, /data-listing-card/);
  assert.doesNotMatch(html, /data-top-rank/);
});

test("occupied mobile claim heading can grow around 44px bid controls", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.match(
    css,
    /\.city-weekend-sheet \.poster\[data-identity="city-weekend-poster"\]\[data-slot="home-shell"\]\[data-occupied="true"\] \.claim h2\[data-slot="claim-heading"\] \{[\s\S]*?height: auto;[\s\S]*?min-height: 2\.75rem;[\s\S]*?line-height: 1\.1;[\s\S]*?\}/,
  );
});

test("period route state renders and keyboard navigation preserves the real board", async () => {
  const rollingPage = await CityPage({
    params: Promise.resolve({ city: "nyc" }),
    searchParams: Promise.resolve({ period: "rolling" }),
  });
  const rollingHtml = renderToStaticMarkup(rollingPage);
  assert.match(rollingHtml, /data-period="rolling"/);

  const weekendHtml = renderToStaticMarkup(
    createElement(CityBoard, { city, listings, period: "weekend" }),
  );
  assert.match(weekendHtml, /data-period="weekend"/);
  const rollingOccupiedHtml = renderToStaticMarkup(
    createElement(CityBoard, {
      city,
      listings,
      period: "rolling",
      now: new Date("2026-08-20T16:00:00.000Z"),
    }),
  );
  assert.match(
    rollingOccupiedHtml,
    /<main[^>]*data-period="rolling"[^>]*data-slot="home-shell"/,
  );
  assert.doesNotMatch(
    rollingOccupiedHtml,
    /<main[^>]*data-period="weekend"[^>]*data-slot="home-shell"/,
  );
  assert.equal(periodHref("/nyc", "error=listing_invalid", "rolling"), "/nyc?error=listing_invalid&period=rolling");
  assert.equal(periodHref("/nyc", "period=rolling&error=", "weekend"), "/nyc?error=");
  assert.equal(periodFromKey("weekend", "ArrowRight"), "rolling");
  assert.equal(periodFromKey("rolling", "ArrowLeft"), "weekend");
  assert.equal(periodFromKey("weekend", "End"), "rolling");
  assert.equal(periodFromKey("rolling", "Home"), "weekend");
  assert.equal(periodFromKey("weekend", "Enter"), null);

  const tabsSource = readFileSync(join(process.cwd(), "src", "app", "period-tabs.tsx"), "utf8");
  const layoutSource = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
  assert.match(tabsSource, /useRouter/);
  assert.match(tabsSource, /useSearchParams/);
  assert.match(tabsSource, /data-period-option=/);
  assert.doesNotMatch(tabsSource, /data-period=/);
  assert.match(layoutSource, /data-period-option=/);
  assert.doesNotMatch(layoutSource, /data-period=/);
  assert.match(tabsSource, /aria-selected=\{active\}/);
  assert.match(tabsSource, /onKeyDown=\{/);
  assert.match(tabsSource, /router\.replace\(/);
});

test("occupied card anatomy rules hit the real venue, pitch, bid, and click markers", () => {
  const html = renderBoard();
  assert.match(
    html,
    /<ol[^>]*data-slot="top-three"[\s\S]*?<li[^>]*data-rank="1"[^>]*data-slot="paid-card"[\s\S]*?<li[^>]*data-rank="2"[^>]*data-slot="paid-card"[\s\S]*?<li[^>]*data-rank="3"[^>]*data-slot="paid-card"/,
  );
  assert.equal((html.match(/data-listing-card=""/g) ?? []).length, 3);
  assert.equal((html.match(/data-card-summary=""/g) ?? []).length, 3);
  assert.equal((html.match(/data-kind=""/g) ?? []).length, 3);
  assert.equal((html.match(/data-bid=""/g) ?? []).length, 3);
  assert.equal((html.match(/data-clicks=""/g) ?? []).length, 3);
  assert.equal((html.match(/data-paid-at-fact=""/g) ?? []).length, 3);
  assert.equal((html.match(/data-book-later=""/g) ?? []).length, 2);
  assert.equal((html.match(/data-later-rank=""/g) ?? []).length, 2);
  assert.equal((html.match(/data-later-book-foot=""/g) ?? []).length, 4);
  assert.match(
    html,
    /<time class="paid-at" data-paid-at-fact="" dateTime="2026-08-20T16:00:00.000Z">Paid Aug 20, 12:00 PM<\/time>/,
  );
  assert.equal((html.match(/href="\/api\/click\/visual_(?:top|two|three)"/g) ?? []).length, 3);
  assert.equal((html.match(/>Book<\/a>/g) ?? []).length, 3);
  assert.equal((html.match(/class="rank"/g) ?? []).length, 3);
  assert.match(html, /class="number-one"[\s\S]*class="weekend-answer"[\s\S]*data-later-fact=""/);
  assert.match(html, /class="number-one"[\s\S]*class="pitch"/);
  assert.match(html, /class="place"[\s\S]*class="rest-name"[\s\S]*class="kind"[\s\S]*class="bid"[\s\S]*data-later-book-foot=""/);
});

test("header search starts closed and is wired to current paid listing links", () => {
  const source = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  assert.match(source, /className="brand-period-group"[\s\S]*data-slot="brand-period"/);
  assert.match(
    css,
    /\.city-weekend-sheet \.brand-period-group\s*\{[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;/,
  );
  assert.match(
    css,
    /\.city-weekend-sheet \.period-pill\s*\{[\s\S]*align-self:\s*center;[\s\S]*margin-top:\s*0;/,
  );
  assert.match(
    css,
    /@media \(max-width: 40rem\)[\s\S]*\.city-weekend-sheet \.period-pill\s*\{[\s\S]*position:\s*static;[\s\S]*justify-self:\s*center;[\s\S]*transform:\s*none;/,
  );
  assert.match(source, /role="search"[\s\S]*data-site-search/);
  assert.match(
    source,
    /className="search-button"[\s\S]*aria-controls="site-search-popover"[\s\S]*aria-expanded="false"/,
  );
  assert.match(
    source,
    /id="site-search-popover"[\s\S]*role="dialog"[\s\S]*hidden/,
  );
  assert.match(source, /data-search-input/);
  assert.match(source, /aria-controls="site-search-results"/);
  assert.match(source, /role="status"[\s\S]*aria-live="polite"/);
  assert.match(source, /data-search-close/);
  assert.match(source, /data-listing-card/);
  assert.match(source, /data-booking-url/);
  assert.match(source, /No paid venues match this search/);
  assert.match(source, /event\.key !== "Escape"/);
  assert.doesNotMatch(source, /href="\/search/);
});

test("Next capture config hides only the local development indicator", () => {
  const source = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  assert.match(source, /devIndicators:\s*false/);
});

test("homepage visual CSS preserves the City Weekend poster identity", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "board.css"), "utf8");
  const boardSource = readFileSync(join(process.cwd(), "src", "app", "[city]", "board.tsx"), "utf8");
  assert.match(css, /r23 City Weekend identity/);
  assert.match(css, /--paper:\s*#f3ead6/);
  assert.match(css, /--poster-stage:\s*#2a241c/);
  assert.match(css, /\.city-weekend-sheet\s*\{[\s\S]*max-width:\s*52rem/);
  assert.match(css, /\.city-weekend-sheet \.poster\[data-identity="city-weekend-poster"\][\s\S]*max-width:\s*var\(--max\)/);
  assert.match(css, /border-bottom:\s*4px double var\(--rule\)/);
  assert.match(css, /\.city-weekend-sheet[\s\S]*\.claim[\s\S]*border-bottom:\s*1px dashed var\(--rule-soft\)/);
  assert.match(css, /\.city-weekend-sheet[\s\S]*\.amount-field[\s\S]*text-decoration: none/);
  assert.match(css, /\.city-weekend-sheet[\s\S]*\.step[\s\S]*border-radius:\s*0/);
  assert.match(css, /\.city-weekend-sheet[\s\S]*\.outbid[\s\S]*text-transform:\s*uppercase/);
  assert.match(css, /grid-template-columns:\s*4\.25rem minmax\(0, 1fr\)/);
  assert.match(css, /min-height:\s*14\.75rem/);
  assert.match(css, /border-top:\s*1px dashed var\(--rule-soft\)/);
  assert.match(css, /@media \(max-width: 40rem\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /min-height:\s*15rem/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.search-popover\[hidden\][\s\S]*display:\s*none/);
  assert.doesNotMatch(css, /r23\.1 readable ledger/);
  assert.doesNotMatch(
    css,
    /\.city-weekend-sheet[\s\S]*\.summary-ranking[\s\S]*grid-template-columns:\s*repeat\(3/,
  );
  assert.doesNotMatch(
    boardSource,
    /CompactBoardSummary|afterTopThree|data-board-summary|data-todays-ranking|data-latest-activity|summary-ranking|activity-list|summary-strips/,
  );
});
