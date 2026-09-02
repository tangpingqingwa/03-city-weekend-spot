import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AboutPage from "../src/app/about/page";
import { POST as postCheckout } from "../src/app/api/checkout/route";
import RulesPage from "../src/app/rules/page";
import {
  CheckoutError,
  parseListingDraft,
  resetCheckoutState,
  setCheckoutNow,
} from "../src/billing/port";
import { getCity, type City } from "../src/core/cities";
import {
  ListingError,
  canonicalBookingUrl,
  createListing,
  isPaidListing,
  parsePitch,
  parsePosterVenue,
} from "../src/core/listing";
import { listingsForCityWindow, getDb } from "../src/db";
import {
  canonicalizeBookingUrl,
  isTrackingQueryKey,
  UrlError,
} from "../src/core/url";
import { currentWindow } from "../src/core/window";

/** Thursday 2026-08-20 12:00 EDT — open NYC weekend window. */
const OPEN_NYC = new Date("2026-08-20T16:00:00.000Z");

const nycCity = getCity("nyc");
if (!nycCity) {
  throw new Error("nyc catalog row is required");
}
const nyc: City = nycCity;

afterEach(() => {
  resetCheckoutState();
});

function windowIdAt(now: Date = OPEN_NYC): string {
  return currentWindow(nyc, now).id;
}

function draft(
  overrides: Partial<{
    city: string;
    windowId: string;
    venueName: string;
    bookingUrl: string;
    kind: "restaurant" | "bar" | "show" | null;
    pitch: string | null;
    bidUsd: number;
    firstPaidAt: string;
  }> = {},
) {
  return {
    city: "nyc",
    windowId: windowIdAt(),
    venueName: "Sunday Roast",
    bookingUrl: "https://book.example.com/roast",
    kind: "restaurant" as const,
    pitch: null,
    bidUsd: 5,
    firstPaidAt: "2026-08-20T16:00:00.000Z",
    ...overrides,
  };
}

async function postJson(payload: Record<string, unknown>): Promise<Response> {
  return postCheckout(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    }),
  );
}

test("poster venue field splits name and booking URL", () => {
  assert.deepEqual(
    parsePosterVenue("Sunday Roast https://book.example.com/roast"),
    {
      venueName: "Sunday Roast",
      bookingUrl: "https://book.example.com/roast",
    },
  );
  assert.deepEqual(parsePosterVenue("https://book.example.com/roast"), {
    venueName: "book.example.com",
    bookingUrl: "https://book.example.com/roast",
  });
  assert.throws(
    () => parsePosterVenue("Sunday Roast"),
    (err: unknown) => {
      assert.ok(err instanceof ListingError);
      assert.equal(err.code, "listing_invalid");
      return true;
    },
  );
});

test("bare booking domains default to HTTPS before storage", () => {
  assert.equal(
    canonicalizeBookingUrl("Book.Example.com/roast"),
    "https://book.example.com/roast",
  );
  assert.equal(
    canonicalizeBookingUrl("//Book.Example.com/roast"),
    "https://book.example.com/roast",
  );
  assert.equal(
    canonicalizeBookingUrl("book.example.com:8443/roast"),
    "https://book.example.com:8443/roast",
  );
  const listing = createListing(draft({ bookingUrl: "book.example.com/roast" }));
  assert.equal(listing.bookingUrl, "https://book.example.com/roast");
  assert.equal(
    parsePosterVenue("Sunday Roast book.example.com/roast").bookingUrl,
    "book.example.com/roast",
  );
  assert.equal(
    parsePosterVenue("Sunday Roast //book.example.com/roast").bookingUrl,
    "//book.example.com/roast",
  );
  assert.equal(
    parsePosterVenue("IPv6 Cafe [2001:4860:4860::8888]/table").bookingUrl,
    "[2001:4860:4860::8888]/table",
  );
});

test("listing requires venue + city + booking URL", () => {
  assert.throws(
    () => createListing(draft({ venueName: "" })),
    (err: unknown) => {
      assert.ok(err instanceof ListingError);
      assert.equal(err.code, "listing_invalid");
      return true;
    },
  );
  assert.throws(
    () => createListing(draft({ bookingUrl: "" })),
    (err: unknown) => {
      assert.ok(err instanceof ListingError);
      assert.equal(err.code, "url_insecure");
      return true;
    },
  );
  const listing = createListing(draft());
  assert.equal(listing.venueName, "Sunday Roast");
  assert.equal(listing.city, "nyc");
  assert.equal(listing.bookingUrl, "https://book.example.com/roast");
  assert.equal(isPaidListing(listing), true);
  assert.equal(
    isPaidListing({ firstPaidAt: "1970-01-01T00:00:00.000Z" }),
    false,
  );
  assert.equal(isPaidListing({ firstPaidAt: "" }), false);
});

test("pitch with 4.9 stars is reviews_forbidden", () => {
  assert.throws(
    () => parsePitch("4.9 stars on every table"),
    (err: unknown) => {
      assert.ok(err instanceof ListingError);
      assert.equal(err.code, "reviews_forbidden");
      return true;
    },
  );
  assert.throws(
    () => createListing(draft({ pitch: "4.9 stars, people say come back" })),
    (err: unknown) => {
      assert.ok(err instanceof ListingError);
      assert.equal(err.code, "reviews_forbidden");
      return true;
    },
  );
  assert.throws(
    () => createListing(draft({ venueName: "4.9 stars Bistro" })),
    (err: unknown) => {
      assert.ok(err instanceof ListingError);
      assert.equal(err.code, "reviews_forbidden");
      return true;
    },
  );
});

test("utm_source and tracking keys are stripped from the stored booking URL", () => {
  assert.equal(isTrackingQueryKey("utm_source"), true);
  assert.equal(isTrackingQueryKey("utm_campaign"), true);
  assert.equal(isTrackingQueryKey("fbclid"), true);
  assert.equal(isTrackingQueryKey("ref_src"), true);
  assert.equal(isTrackingQueryKey("keep"), false);

  const stripped = canonicalizeBookingUrl(
    "https://Book.Example/table?utm_source=x&utm_campaign=launch&fbclid=1&gclid=2&gbraid=3&wbraid=4&msclkid=5&ref=ad&ref_src=tw&affiliate=1&aff=2&irclickid=9&mc_cid=a&mc_eid=b&icid=c&keep=yes#frag",
  );
  assert.equal(stripped, "https://book.example/table?keep=yes");
  assert.doesNotMatch(stripped, /utm_/);
  assert.doesNotMatch(stripped, /fbclid/);
  assert.doesNotMatch(stripped, /#/);

  const listing = createListing(
    draft({
      bookingUrl:
        "https://book.example.com/roast?utm_source=board&fbclid=abc#top",
    }),
  );
  assert.equal(listing.bookingUrl, "https://book.example.com/roast");
  assert.equal(
    canonicalBookingUrl("https://book.example.com/roast?utm_source=x"),
    "https://book.example.com/roast",
  );
});

test("telegram invite is url_forbidden", () => {
  for (const bookingUrl of [
    "https://t.me/foo",
    "https://t.me../foo",
    "https://telegram.me/invite",
    "https://wa.me/15555550100",
    "https://chat.whatsapp.com/invite",
    "https://discord.gg/abc",
    "https://discord.com/invite/abc",
  ]) {
    assert.throws(() => canonicalizeBookingUrl(bookingUrl), (err: unknown) => {
      assert.ok(err instanceof UrlError);
      assert.equal(err.code, "url_forbidden");
      return true;
    });
    assert.throws(
      () => canonicalBookingUrl(bookingUrl),
      (err: unknown) => {
        assert.ok(err instanceof ListingError);
        assert.equal(err.code, "url_forbidden");
        return true;
      },
    );
  }
});

test("NSFW booking URL is url_forbidden", () => {
  for (const bookingUrl of [
    "https://pornhub.com/view",
    "https://onlyfans.com/user",
    "https://onlyfans.com.../user",
    "https://sub.onlyfans.com../user",
    "https://example.com/nsfw/table",
    "https://example.com/xxx",
  ]) {
    assert.throws(() => canonicalizeBookingUrl(bookingUrl), (err: unknown) => {
      assert.ok(err instanceof UrlError);
      assert.equal(err.code, "url_forbidden");
      return true;
    });
  }
});

test("http, javascript, data, and localhost are rejected", () => {
  assert.throws(
    () => canonicalizeBookingUrl("http://example.com/insecure"),
    (err: unknown) => {
      assert.ok(err instanceof UrlError);
      assert.equal(err.code, "url_insecure");
      return true;
    },
  );
  for (const bookingUrl of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "https://localhost/table",
    "https://localhost.../table",
    "https://127.0.0.1/table",
    "https://127.0.0.1.../table",
    "https://user:pass@example.com/table",
  ]) {
    assert.throws(() => canonicalizeBookingUrl(bookingUrl), (err: unknown) => {
      assert.ok(err instanceof UrlError);
      assert.ok(err.code === "url_insecure" || err.code === "url_forbidden");
      return true;
    });
  }
});

test("scheme-looking ports do not upgrade explicit schemes and private hosts stay forbidden", () => {
  for (const [bookingUrl, code] of [
    ["javascript:123", "url_forbidden"],
    ["data:123", "url_forbidden"],
    ["ftp:123", "url_insecure"],
    ["unknown:123", "url_insecure"],
  ] as const) {
    assert.throws(() => canonicalizeBookingUrl(bookingUrl), (err: unknown) => {
      assert.ok(err instanceof UrlError);
      assert.equal(err.code, code);
      return true;
    });
  }

  for (const bookingUrl of [
    "localhost:3000/table",
    "10.0.0.8:3000/table",
    "172.16.0.8:3000/table",
    "192.168.0.8:3000/table",
    "169.254.0.8:3000/table",
    "https://[::]/table",
    "https://[::1]/table",
    "[fe80::1]:3000/table",
    "[fec0::1]:3000/table",
    "https://[fc00::8]/table",
    "[fd00::8]:3000/table",
    "https://[ff02::1]/table",
    "[::ffff:192.168.0.8]:3000/table",
  ]) {
    assert.throws(() => canonicalizeBookingUrl(bookingUrl), (err: unknown) => {
      assert.ok(err instanceof UrlError);
      assert.equal(err.code, "url_forbidden");
      return true;
    });
  }
});

test("protocol-relative booking URLs reject backslash authority and path tricks", () => {
  for (const bookingUrl of ["//\\evil.com", "//evil.com\\path"]) {
    assert.throws(() => canonicalizeBookingUrl(bookingUrl), (err: unknown) => {
      assert.ok(err instanceof UrlError);
      assert.equal(err.code, "url_forbidden");
      return true;
    });
  }
  assert.throws(
    () => parsePosterVenue("Sunday Roast //\\evil.com"),
    (err: unknown) => {
      assert.ok(err instanceof ListingError);
      assert.equal(err.code, "listing_invalid");
      return true;
    },
  );
});

test("path-only, malformed, and control-containing booking inputs fail closed", () => {
  for (const bookingUrl of [
    "/path",
    "///example.com/path",
    "https:/example.com/path",
    "https:///example.com/path",
    "hTTps:\n//example.com",
    "https://example.com\n.evil.com",
  ]) {
    assert.throws(() => canonicalizeBookingUrl(bookingUrl), (err: unknown) => {
      assert.ok(err instanceof UrlError);
      assert.ok(err.code === "url_insecure" || err.code === "url_forbidden");
      return true;
    });
  }
});

test("private IPv4-compatible IPv6 booking hosts are forbidden", () => {
  for (const bookingUrl of [
    "https://[::192.168.0.8]/table",
    "https://[::127.0.0.1]/table",
  ]) {
    assert.throws(() => canonicalizeBookingUrl(bookingUrl), (err: unknown) => {
      assert.ok(err instanceof UrlError);
      assert.equal(err.code, "url_forbidden");
      return true;
    });
  }
});

test("checkout rejects chat, NSFW, and review-speak without listing", async () => {
  setCheckoutNow(OPEN_NYC);

  const chat = await postJson({
    city: "nyc",
    venueName: "Invite",
    bookingUrl: "https://t.me/foo",
    amountUsd: 5,
  });
  assert.equal(chat.status, 400);
  assert.deepEqual(await chat.json(), { error: "url_forbidden" });

  const nsfw = await postJson({
    city: "nyc",
    venueName: "Adult",
    bookingUrl: "https://pornhub.com/view",
    amountUsd: 5,
  });
  assert.equal(nsfw.status, 400);
  assert.deepEqual(await nsfw.json(), { error: "url_forbidden" });

  const reviews = await postJson({
    city: "nyc",
    venueName: "Sunday Roast",
    bookingUrl: "https://book.example.com/roast",
    amountUsd: 5,
    pitch: "4.9 stars",
  });
  assert.equal(reviews.status, 400);
  assert.deepEqual(await reviews.json(), { error: "reviews_forbidden" });

  assert.throws(
    () =>
      parseListingDraft(
        {
          venueName: "Sunday Roast",
          bookingUrl: "https://t.me/foo",
        },
        windowIdAt(),
        "nyc",
      ),
    (err: unknown) => {
      assert.ok(err instanceof CheckoutError);
      assert.equal(err.code, "url_forbidden");
      return true;
    },
  );

  assert.equal(listingsForCityWindow(getDb(), "nyc", windowIdAt()).length, 0);
});

test("about and rules explain the public product without implementation notes", () => {
  const about = renderToStaticMarkup(createElement(AboutPage));
  const rules = renderToStaticMarkup(createElement(RulesPage));

  assert.match(about, /data-page="about"/);
  assert.match(about, /Rank is money, not stars/);
  assert.match(about, /star ratings, review scores, or invented quotes/i);
  assert.match(about, /City Weekend Spot/);
  assert.match(about, /New York/);
  assert.match(about, /English/);
  assert.match(about, /USD/);
  assert.match(about, /payment is confirmed/i);

  assert.match(rules, /data-page="rules"/);
  assert.match(rules, /starts at.*\$5/is);
  assert.match(rules, /placed first keeps the higher rank/i);
  assert.match(rules, /charged only the difference/i);
  assert.match(rules, /remain eligible for seven days/i);
  assert.match(rules, /star ratings, review scores/i);
  assert.match(rules, /Tracking, referral, and affiliate parameters are removed/i);
  assert.match(rules, /adult content are rejected/i);

  assert.doesNotMatch(about, /4\.8 stars|data-stars|data-rating|★|⭐/);
  assert.doesNotMatch(rules, /4\.8 stars|data-stars|data-rating|★|⭐/);
  assert.doesNotMatch(
    `${about}\n${rules}`,
    /outbid\.lol|clone of|\bv1\b|fixture|API keys|Waffo|catalog row|weekId|createdAt|paidAt|localhost|link-local|BLOCKED-/i,
  );
});
