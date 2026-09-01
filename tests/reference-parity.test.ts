import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adaptReferenceDocument } from "../src/app/outbid-reference-page";
import { renderBoardPage } from "../src/views/outbid-reference-board";
import type { RankedListing } from "../src/views/outbid-reference-core";

const cityPageSource = readFileSync(
  new URL("../src/app/[city]/page.tsx", import.meta.url),
  "utf8",
);
const referenceBoardSource = readFileSync(
  new URL("../src/views/outbid-reference-board.ts", import.meta.url),
  "utf8",
);
const referenceStylesSource = readFileSync(
  new URL("../src/views/outbid-reference-styles.ts", import.meta.url),
  "utf8",
);
const bidFormSource = readFileSync(
  new URL("../src/app/[city]/bid-form.tsx", import.meta.url),
  "utf8",
);

function fixtureListing(
  id: string,
  rank: number,
  productUrl: string,
  bidUsd: number,
): RankedListing {
  return {
    id,
    rank,
    day: "2026-08-29",
    productUrl,
    whyTestThisToday: `Weekend reason for ${productUrl}`,
    bidUsd,
    paidUsd: bidUsd,
    clicks: 0,
    createdAt: `2026-08-2${rank}T10:00:00.000Z`,
    updatedAt: `2026-08-2${rank}T10:00:00.000Z`,
  };
}

test("exact local reference keeps the real NYC venue checkout contract", () => {
  const listings = [
    fixtureListing("brine", 1, "https://see.io", 17_000),
    fixtureListing("north", 2, "https://tutti.so", 16_000),
    fixtureListing("stage", 3, "https://joni.ai", 14_028),
  ];
  const html = adaptReferenceDocument(
    renderBoardPage({
      day: "2026-08-29",
      tz: "UTC",
      listings,
      last24h: listings,
      defaultBidUsd: 17_001,
      now: new Date("2026-08-29T12:00:00.000Z"),
      fixtureMode: true,
    }),
  );

  assert.match(html, /data-reference-fixture=""/);
  assert.match(html, /action="\/nyc\/checkout"/);
  for (const field of ["bookingUrl", "pitch", "venueName", "kind", "bidUsd"]) {
    assert.match(html, new RegExp(`name="${field}"`));
  }
  assert.match(html, /data-required-city-field/);
  assert.match(html, /role="dialog" aria-label="Choose a category and enter venue details"/);
  assert.match(html, /href="\/nyc\/click\/brine"/);
  assert.match(html, /data-target="\/nyc\/click\/brine"/);
  assert.doesNotMatch(html, /href="\/r\//);
  assert.doesNotMatch(html, /data-target="\/r\//);
  assert.doesNotMatch(html, /Polar/i);
});

test("public city route retires the exact reference fixture bypass", () => {
  assert.doesNotMatch(cityPageSource, /paymentMode/);
  assert.doesNotMatch(cityPageSource, /OutbidReferenceFixturePage/);
  assert.doesNotMatch(cityPageSource, /ReferenceRankedListing/);
  assert.doesNotMatch(cityPageSource, /OUTBID_REFERENCE_ROWS|isOutbidReferenceFixture/);
  assert.doesNotMatch(cityPageSource, /Brine Room|North Bar|Stage Three/);
  assert.match(cityPageSource, /const listings = getBoardListings/);
  assert.match(cityPageSource, /<CityBoard/);
  assert.match(bidFormSource, /name="kind"/);
  assert.match(bidFormSource, /const persistedKind/);
  assert.match(bidFormSource, /data-presentation-category/);
  assert.match(bidFormSource, /shortLabel: "Eat"/);
  assert.match(bidFormSource, /shortLabel: "Drink"/);
  assert.match(bidFormSource, /shortLabel: "See"/);
  assert.match(bidFormSource, /shortLabel: "Outside"/);
  assert.match(bidFormSource, /shortLabel: "Late"/);
  assert.match(referenceBoardSource, /outbid-reference-root/);
  assert.match(referenceStylesSource, /outbid-reference-root/);
});
