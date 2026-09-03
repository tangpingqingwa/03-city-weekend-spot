import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CITIES,
  CITY_SLUG_PATTERN,
  MIN_BID_USD,
  activeCities,
  canonicalBoardPath,
  cityError,
  defaultBoardPath,
  getBoardListings,
  getCity,
  isCitySlug,
  resolveCity,
} from "../src/core/cities";

test("nyc is the only active v1 lane", () => {
  assert.equal(CITIES.length, 1);
  assert.deepEqual(CITIES[0], {
    slug: "nyc",
    name: "New York City",
    timezone: "America/New_York",
    active: true,
  });
  assert.deepEqual(
    activeCities().map((city) => city.slug),
    ["nyc"],
  );
});

test("city slugs match the SPEC pattern", () => {
  assert.equal(isCitySlug("nyc"), true);
  assert.equal(isCitySlug("new-york"), true);
  assert.equal(isCitySlug("NYC"), false);
  assert.equal(isCitySlug("n"), false);
  assert.equal(CITY_SLUG_PATTERN.test("nyc"), true);
});

test("unknown slug is city_unknown; nyc resolves", () => {
  assert.equal(getCity("london"), undefined);
  assert.equal(cityError(undefined), "city_unknown");
  assert.equal(cityError(getCity("nyc")), null);
  assert.equal(
    cityError({
      slug: "london",
      name: "London",
      timezone: "Europe/London",
      active: false,
    }),
    "city_inactive",
  );

  assert.deepEqual(resolveCity("nyc"), {
    ok: true,
    city: CITIES[0],
  });
  assert.deepEqual(resolveCity("london"), {
    ok: false,
    code: "city_unknown",
  });
  assert.deepEqual(resolveCity("not a city"), {
    ok: false,
    code: "city_unknown",
  });
});

test("default board path is the canonical root while NYC remains a compatibility alias", () => {
  assert.equal(defaultBoardPath(), "/");
  assert.equal(canonicalBoardPath("nyc"), "/");
});

test("live board invents no venues", () => {
  assert.deepEqual(getBoardListings("nyc"), []);
  assert.deepEqual(getBoardListings("london"), []);
});

test("minimum first bid is $5", () => {
  assert.equal(MIN_BID_USD, 5);
});
