import assert from "node:assert/strict";
import { test } from "node:test";
import { getCity, type City } from "../src/core/cities";
import {
  assertWindowOpen,
  currentWindow,
  isoWeekFromParts,
  resolveCurrentWindow,
  windowContains,
  windowIdFor,
  zonedLocalInstant,
  zonedParts,
} from "../src/core/window";

const nyc = getCity("nyc");
assert.ok(nyc);

const london: City = {
  slug: "london",
  name: "London",
  timezone: "Europe/London",
  active: true,
};

/** Thursday 2026-08-20 12:00 EDT (America/New_York, UTC−4). */
const NYC_THU_NOON = "2026-08-20T16:00:00.000Z";
/** Sunday 2026-08-23 23:59:59.999 EDT. */
const NYC_SUN_END = "2026-08-24T03:59:59.999Z";
/** Monday 2026-08-24 00:00:00.000 EDT — next ISO week. */
const NYC_MON_MIDNIGHT = "2026-08-24T04:00:00.000Z";

test("NYC Thursday 12:00 is included in the weekly weekend window", () => {
  const now = new Date(NYC_THU_NOON);
  const window = currentWindow(nyc, now);
  assert.equal(window.city, "nyc");
  assert.equal(window.timezone, "America/New_York");
  assert.equal(window.isoWeek, "2026-W34");
  assert.equal(window.id, "nyc:2026-W34");
  assert.equal(window.startsAt.toISOString(), NYC_THU_NOON);
  assert.equal(windowContains(window, now), true);

  const local = zonedParts(now, nyc.timezone);
  assert.equal(local.weekday, 4);
  assert.equal(local.hour, 12);
  assert.equal(local.minute, 0);
});

test("NYC Sunday 23:59:59 is included; Monday 00:00 is a new window", () => {
  const sunday = new Date(NYC_SUN_END);
  const monday = new Date(NYC_MON_MIDNIGHT);

  const open = currentWindow(nyc, sunday);
  assert.equal(open.id, "nyc:2026-W34");
  assert.equal(open.endsAt.toISOString(), NYC_SUN_END);
  assert.equal(windowContains(open, sunday), true);
  assert.equal(windowContains(open, monday), false);

  const next = currentWindow(nyc, monday);
  assert.equal(next.id, "nyc:2026-W35");
  assert.equal(next.isoWeek, "2026-W35");
  assert.notEqual(next.id, open.id);
  assert.equal(windowContains(next, monday), false);
  assert.ok(monday.getTime() < next.startsAt.getTime());
});

test("window id is {city}:{iso_week} in that city’s timezone", () => {
  assert.equal(windowIdFor("nyc", "2026-W34"), "nyc:2026-W34");
  const thuNoonLondon = zonedLocalInstant(london.timezone, 2026, 8, 20, 12, 0, 0, 0);
  const londonWindow = currentWindow(london, thuNoonLondon);
  assert.equal(londonWindow.id, "london:2026-W34");
  assert.equal(londonWindow.city, "london");
  assert.equal(londonWindow.timezone, "Europe/London");
  assert.notEqual(londonWindow.id, currentWindow(nyc, new Date(NYC_THU_NOON)).id);
});

test("ISO week is Thursday-anchored", () => {
  // Monday 2024-12-30 belongs to 2025-W01 because its Thursday is 2025-01-02.
  assert.equal(
    isoWeekFromParts({ year: 2024, month: 12, day: 30, weekday: 1 }),
    "2025-W01",
  );
  assert.equal(
    isoWeekFromParts({ year: 2026, month: 1, day: 1, weekday: 4 }),
    "2026-W01",
  );
  assert.equal(
    isoWeekFromParts({ year: 2026, month: 8, day: 20, weekday: 4 }),
    "2026-W34",
  );
});

test("unknown city is 404 city_unknown; NYC resolves", () => {
  assert.deepEqual(resolveCurrentWindow("london", new Date(NYC_THU_NOON)), {
    ok: false,
    code: "city_unknown",
    http: 404,
  });
  assert.deepEqual(resolveCurrentWindow("not-a-city"), {
    ok: false,
    code: "city_unknown",
    http: 404,
  });

  const resolved = resolveCurrentWindow("nyc", new Date(NYC_THU_NOON));
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.city.slug, "nyc");
    assert.equal(resolved.window.id, "nyc:2026-W34");
  }
});

test("Monday 00:00 NYC is window_closed for the new week", () => {
  const closed = assertWindowOpen("nyc", new Date(NYC_MON_MIDNIGHT));
  assert.deepEqual(closed, { ok: false, code: "window_closed", http: 400 });

  const open = assertWindowOpen("nyc", new Date(NYC_THU_NOON));
  assert.equal(open.ok, true);
});

test("Thursday 11:59 NYC is the same ISO week but window_closed", () => {
  const before = new Date("2026-08-20T15:59:59.999Z");
  const window = currentWindow(nyc, before);
  assert.equal(window.id, "nyc:2026-W34");
  assert.equal(windowContains(window, before), false);
  assert.deepEqual(assertWindowOpen("nyc", before), {
    ok: false,
    code: "window_closed",
    http: 400,
  });
});
