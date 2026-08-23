#!/usr/bin/env bash
# Offline gate for main. Must exit 0 on a clean clone with no secrets.
# Contract checks stay. Once src/ exists this script typechecks and runs
# node:test. Do not require live Polar or any third-party network.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

echo "== contract files =="
for f in README.md SPEC.md BUILD.md CONTRIBUTING.md scripts/test.sh; do
  [[ -f "$f" ]] || fail "missing $f"
  [[ -s "$f" ]] || fail "empty $f"
done

echo "== contributing rules are documented =="
grep -q 'main must always be buildable' CONTRIBUTING.md \
  || grep -q 'main` must always be buildable' CONTRIBUTING.md \
  || fail "CONTRIBUTING.md does not state the main-branch rule"

echo "== SPEC mentions git collaboration =="
grep -q 'Git collaboration' SPEC.md || fail "SPEC.md missing Git collaboration section"

echo "== SPEC product contract =="
grep -q 'weekly weekend window' SPEC.md || fail "SPEC.md missing weekly weekend window"
grep -q 'venue + city + booking URL' SPEC.md || fail "SPEC.md missing listing shape"
grep -q 'No fake reviews' SPEC.md || fail "SPEC.md missing no fake reviews"
grep -q 'Ranking is money not stars' SPEC.md || fail "SPEC.md missing money-not-stars ranking"
grep -Fq 'Minimum **$5**' SPEC.md || fail "SPEC.md missing min $5"
grep -q 'older wins ties' SPEC.md || fail "SPEC.md missing older-wins-ties"
grep -q 'raise pays difference' SPEC.md || fail "SPEC.md missing raise-pays-difference"
grep -q 'NYC' SPEC.md || fail "SPEC.md missing NYC v1 lane"
grep -q 'Polar' SPEC.md || fail "SPEC.md missing Polar"

echo "== BUILD PR sequence through live-smoke =="
grep -qE '^### PR 1:' BUILD.md || fail "BUILD.md missing ### PR 1:"
grep -qE '^### PR .*live-smoke' BUILD.md || fail "BUILD.md missing ### PR N: live-smoke"
if grep -Eq '^\s*(bash )?scripts/live-smoke\.sh' scripts/test.sh; then
  fail "test.sh must not invoke live-smoke.sh"
fi

echo "== CI job ci =="
[[ -f .github/workflows/ci.yml ]] || fail "missing .github/workflows/ci.yml"
grep -qE '^name: ci$' .github/workflows/ci.yml || fail "ci.yml missing workflow name ci"
grep -qE '^  ci:' .github/workflows/ci.yml || fail "ci.yml missing job id ci"
grep -q 'bash scripts/test.sh' .github/workflows/ci.yml || fail "ci.yml must run scripts/test.sh"
if grep -Eqi 'POLAR_LIVE=1|POLAR_ACCESS_TOKEN=' .github/workflows/ci.yml; then
  fail "CI must not set live Polar"
fi
if grep -q 'scripts/live-smoke.sh' .github/workflows/ci.yml; then
  fail "live-smoke.sh must not be called from Actions"
fi

echo "== no committed secrets =="
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git ls-files | grep -E '(^|/)\.env$|(^|/)id_rsa$|\.pem$|credentials\.json$' >/dev/null; then
    fail "secret-like path is tracked"
  fi
fi

echo "== markdown is UTF-8 text =="
file -b --mime-encoding README.md SPEC.md BUILD.md CONTRIBUTING.md | grep -qiE 'utf-8|us-ascii' \
  || fail "docs are not UTF-8/ASCII"

echo "== skeleton files =="
for f in package.json tsconfig.json src/app/healthz/route.ts; do
  [[ -f "$f" ]] || fail "missing $f"
  [[ -s "$f" ]] || fail "empty $f"
done
grep -q '/healthz' src/app/healthz/route.ts || grep -q 'HealthzOk' src/app/healthz/route.ts \
  || fail "src/app/healthz/route.ts missing healthz contract"
grep -q 'ok: true' src/app/healthz/route.ts || fail "healthz route missing { ok: true }"
if grep -RInE 'https?://([^/]*\.)?polar\.sh' src tests \
  | grep -v 'src/billing/polar.ts' >/dev/null 2>&1; then
  fail "only src/billing/polar.ts may mention the Polar HTTP host"
fi
if grep -RInE 'from ["'"'"']\.\./.*billing/polar|from ["'"'"']\.\./\.\./.*billing/polar' \
  src/app >/dev/null 2>&1; then
  fail "HTTP / pages must not import billing/polar.ts directly"
fi

echo "== board UI files =="
for f in \
  src/app/page.tsx \
  src/app/\[city\]/page.tsx \
  src/core/cities.ts \
  src/app/board.css
do
  [[ -f "$f" ]] || fail "missing $f"
  [[ -s "$f" ]] || fail "empty $f"
done
grep -q 'redirect' src/app/page.tsx || fail "src/app/page.tsx must redirect / to the default city"
grep -q 'defaultBoardPath' src/app/page.tsx || fail "src/app/page.tsx must use defaultBoardPath"
grep -q 'slug: "nyc"' src/core/cities.ts || fail "cities.ts must catalog nyc"
grep -q 'America/New_York' src/core/cities.ts || fail "cities.ts must use America/New_York for nyc"
grep -q 'getBoardListings' src/core/cities.ts || fail "cities.ts must expose getBoardListings"
grep -q 'return \[\]' src/core/cities.ts || fail "live board must invent no venues"
grep -q 'Outbid' src/app/\[city\]/bid-form.tsx || fail "bid form must render Outbid"
grep -q 'Claim #1' src/app/\[city\]/bid-form.tsx || fail "bid form must clone Claim #1"
grep -q 'action="/api/checkout"' src/app/\[city\]/bid-form.tsx \
  || fail "bid form must POST to Polar checkout"
if grep -q 'Checkout is not live' src/app/\[city\]/bid-form.tsx; then
  fail "poster claim form must not stub checkout"
fi
if grep -q 'data-checkout-stub' src/app/\[city\]/bid-form.tsx; then
  fail "poster claim form must not keep the checkout stub"
fi
grep -q 'parsePosterVenue' src/core/listing.ts \
  || fail "listing.ts must parse the poster venue field"
grep -q 'data-return="paid"' src/app/\[city\]/return/page.tsx \
  || fail "return page must mark paid checkout"
grep -q 'data-return="pending"' src/app/\[city\]/return/page.tsx \
  || fail "return page must mark pending checkout"
grep -q '−' src/app/\[city\]/bid-form.tsx || fail "bid form must clone the minus stepper"
grep -q '+' src/app/\[city\]/bid-form.tsx || fail "bid form must clone the plus stepper"
grep -q 'amount-field' src/app/\[city\]/bid-form.tsx || fail "bid form must keep the dashed amount field"
grep -q 'data-empty-board' src/app/\[city\]/board.tsx || fail "board must have an honest empty state"
grep -q 'unpublished' src/app/\[city\]/board.tsx || fail "empty board must read like an unpublished weekend"
grep -q 'empty-answer' src/app/\[city\]/board.tsx || fail "empty board must print No #1 as the weekend answer"
grep -q 'empty-note' src/app/\[city\]/board.tsx || fail "unpublished must sit under No #1, not above it"
if grep -q 'empty-kicker' src/app/\[city\]/board.tsx; then
  fail "empty board must not keep unpublished as the large kicker"
fi
grep -q 'city-name' src/app/\[city\]/board.tsx || fail "city name must be the masthead"
grep -q 'className="place"' src/app/\[city\]/board.tsx || fail "venue card must read as a place"
grep -q 'data-kind' src/app/\[city\]/board.tsx || fail "place card must show kind"
grep -q 'className="pitch"' src/app/\[city\]/board.tsx || fail "place card must show pitch"
grep -q 'Book' src/app/\[city\]/board.tsx || fail "place card must keep the Book CTA"
grep -q 'data-weekend-answer' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must be the weekend answer"
grep -q 'data-book-number-one' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must expose a primary Book hop"
grep -q 'book-one' src/app/\[city\]/board.tsx \
  || fail "occupied #1 Book must use the primary booking class"
grep -q 'data-book-one-first' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must stamp Book as the first hop"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'book-one-first'; then
  fail "empty board must not stamp Book #1"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'book-one-first'; then
  fail "later ranks must not stamp Book #1 as the first hop"
fi
grep -q 'data-later-book' src/app/\[city\]/board.tsx \
  || fail "later ranks must stamp Book as a later hop"
grep -q 'data-book-later' src/app/\[city\]/board.tsx \
  || fail "later ranks must expose a Book hop"
grep -q 'book-later' src/app/\[city\]/board.tsx \
  || fail "later-rank Book must use the later booking class"
grep -q 'data-list-venue' src/app/\[city\]/board.tsx \
  || fail "occupied board must mark List a venue"
grep -q 'href="#claim"' src/app/\[city\]/board.tsx \
  || fail "List a venue must hop to the claim form"
grep -q 'List a venue' src/app/\[city\]/board.tsx \
  || fail "occupied masthead must say List a venue"
grep -q 'List a venue this weekend' src/app/\[city\]/bid-form.tsx \
  || fail "occupied claim must say List a venue this weekend"
grep -q 'data-list-after-book-one' src/app/\[city\]/board.tsx \
  || fail "occupied List a venue must stamp after Book #1"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'list-after-book-one'; then
  fail "empty board must not stamp List after Book #1"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'list-after-book-one'; then
  fail "later ranks must not stamp List after Book #1"
fi
if grep -n 'data-list-after-book=""' -B 6 -A 2 src/app/\[city\]/board.tsx | grep -q 'list-after-book-one'; then
  fail "list-after-later-Books must not stamp List after Book #1"
fi
if grep -n 'data-list-after-book-hop=""' -B 6 -A 4 src/app/\[city\]/board.tsx | grep -q 'list-after-book-one'; then
  fail "list-after-book-hop must not stamp List after Book #1"
fi
grep -q 'data-list-after-book-two' src/app/\[city\]/board.tsx \
  || fail "occupied List a venue must stamp after Book #1 is re-concentrated"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'list-after-book-two'; then
  fail "empty board must not stamp List after Book #1 is re-concentrated"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'list-after-book-two'; then
  fail "later ranks must not stamp List after Book #1 is re-concentrated"
fi
if grep -n 'data-list-after-book=""' -B 6 -A 2 src/app/\[city\]/board.tsx | grep -q 'list-after-book-two'; then
  fail "list-after-later-Books must not stamp List after Book #1 is re-concentrated"
fi
if grep -n 'data-list-after-book-hop=""' -B 6 -A 4 src/app/\[city\]/board.tsx | grep -q 'list-after-book-two'; then
  fail "list-after-book-hop must not stamp List after Book #1 is re-concentrated"
fi
if grep -n 'data-book-after-list=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-two'; then
  fail "book-after-list leftover must not stamp List after Book #1 is re-concentrated"
fi
if grep -n 'data-book-after-list-hop=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-two'; then
  fail "book-after-list-hop leftover must not stamp List after Book #1 is re-concentrated"
fi
if grep -n 'data-book-after-list-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-two'; then
  fail "Book after List a venue must not stamp List after Book #1 is re-concentrated"
fi
grep -q 'data-book-after-list-one' src/app/\[city\]/board.tsx \
  || fail "occupied Book #1 must stamp after List a venue"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'book-after-list-one'; then
  fail "empty board must not stamp Book after List a venue"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'book-after-list-one'; then
  fail "later ranks must not stamp Book after List a venue"
fi
if grep -n 'className="book-after-list"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListOne\|book-after-list-one'; then
  fail "book-after-list leftover must not stamp Book after List a venue"
fi
if grep -n 'className="book-after-list-hop"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListOne\|book-after-list-one'; then
  fail "book-after-list-hop leftover must not stamp Book after List a venue"
fi
if grep -n 'data-list-after-book-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListOne\|book-after-list-one'; then
  fail "List after Book #1 must not stamp Book after List a venue"
fi
grep -q 'data-list-after-book' src/app/\[city\]/board.tsx \
  || fail "later ranks must offer a list-after-book hop"
grep -q 'after later Books' src/app/\[city\]/board.tsx \
  || fail "list-after-book hop must sit after later Books"
grep -q 'data-book-after-list' src/app/\[city\]/board.tsx \
  || fail "occupied masthead must expose Book after the list hop"
grep -q 'after the list hop' src/app/\[city\]/board.tsx \
  || fail "Book after list must sit after the list hop"
grep -q 'data-list-after-book-hop' src/app/\[city\]/board.tsx \
  || fail "occupied masthead must list after Book follows List"
grep -q 'after Book follows List' src/app/\[city\]/board.tsx \
  || fail "list-after-book-hop must sit after Book follows List"
grep -q 'data-book-after-list-hop' src/app/\[city\]/board.tsx \
  || fail "occupied masthead must book after List follows Book"
grep -q 'after List follows Book' src/app/\[city\]/board.tsx \
  || fail "book-after-list-hop must sit after List follows Book"
grep -q 'list-venue' src/app/board.css \
  || fail "poster CSS must style the List a venue hop"
grep -q 'data-list-after-book-one' src/app/board.css \
  || fail "poster CSS must concentrate List after Book #1"
grep -q 'data-list-after-book-two' src/app/board.css \
  || fail "poster CSS must concentrate List after Book #1 is re-concentrated"
grep -q 'list-after-book' src/app/board.css \
  || fail "poster CSS must style the list-after-book hop"
grep -q 'book-after-list' src/app/board.css \
  || fail "poster CSS must style the book-after-list hop"
grep -q 'list-after-book-hop' src/app/board.css \
  || fail "poster CSS must style the list-after-book-hop"
grep -q 'book-after-list-hop' src/app/board.css \
  || fail "poster CSS must style the book-after-list-hop"
grep -q 'weekend-answer' src/app/board.css \
  || fail "poster CSS must style the occupied weekend answer"
grep -q '\.book-one' src/app/board.css \
  || fail "poster CSS must style the primary Book hop"
grep -q 'data-book-one-first' src/app/board.css \
  || fail "poster CSS must concentrate Book #1"
grep -q 'data-book-after-list-one' src/app/board.css \
  || fail "poster CSS must concentrate Book #1 after List a venue"
grep -q 'book-later' src/app/board.css \
  || fail "poster CSS must style later-rank Book"
grep -q 'data-later-book' src/app/board.css \
  || fail "poster CSS must style later-rank places"
grep -q 'data-bid' src/app/\[city\]/board.tsx || fail "cards must show the bid amount"
grep -q 'data-clicks' src/app/\[city\]/board.tsx || fail "cards must show public clicks"
grep -q 'listingClickPath' src/app/\[city\]/board.tsx || fail "Book CTA must hop through the public click route"
grep -q 'board.css' src/app/layout.tsx || fail "root layout must load board styles"
grep -q 'masthead' src/app/board.css || fail "poster CSS must style the city masthead"
grep -q '\.place' src/app/board.css || fail "poster CSS must style venue places"
if grep -q 'city-kicker' src/app/\[city\]/board.tsx; then
  fail "city name must be the masthead, not a kicker afterthought"
fi
if grep -RInEi 'leaflet|openstreetmap|google.maps|mapbox' src/app >/dev/null; then
  fail "one city, one weekend — do not add a map"
fi
if grep -RInEi '★|star rating|4\.8 stars|review count|rated 4\.9' src/app src/core >/dev/null; then
  fail "board UI must not render stars or review chrome"
fi
if grep -RInE 'createCheckout|POLAR_LIVE|polar\.sh' \
  src/app/page.tsx src/app/layout.tsx src/app/board.css src/app/\[city\] src/core \
  >/dev/null 2>&1; then
  fail "board UI / core must not import Polar checkout"
fi

echo "== city lanes and weekend window =="
for f in \
  src/core/window.ts \
  src/core/rank.ts \
  src/core/listing.ts \
  src/db.ts \
  tests/window.test.ts \
  tests/rank.test.ts
do
  [[ -f "$f" ]] || fail "missing $f"
  [[ -s "$f" ]] || fail "empty $f"
done
grep -q 'currentWindow' src/core/window.ts || fail "window.ts must export currentWindow"
grep -q 'America/New_York' src/core/cities.ts || fail "NYC timezone must stay catalog data"
grep -q 'export function rankListings' src/core/rank.ts || fail "rank.ts must export rankListings"
grep -q 'firstPaidAt' src/core/rank.ts || fail "rank.ts must tie-break on firstPaidAt"
grep -q 'query.city' src/core/rank.ts || fail "rank.ts ranking must take city"
grep -q 'venueName' src/core/listing.ts || fail "listing.ts must require venueName"
grep -q 'bookingUrl' src/core/listing.ts || fail "listing.ts must require bookingUrl"
grep -q 'venueKey' src/core/listing.ts || fail "listing.ts must define venueKey"
grep -q 'CREATE TABLE' src/db.ts || fail "db.ts must declare cities/windows/listings schema"
if grep -RInE 'createCheckout|POLAR_LIVE=1' src/core src/db.ts tests/window.test.ts tests/rank.test.ts >/dev/null 2>&1; then
  fail "city/window/rank must not wire Polar checkout"
fi

echo "== Polar checkout and fixture =="
for f in \
  src/billing/port.ts \
  src/billing/fixture.ts \
  src/billing/polar.ts \
  src/app/api/checkout/route.ts \
  src/app/api/polar/webhook/route.ts \
  tests/checkout.test.ts
do
  [[ -f "$f" ]] || fail "missing $f"
  [[ -s "$f" ]] || fail "empty $f"
done
grep -q 'createCheckout' src/billing/port.ts \
  || fail "port.ts must define createCheckout"
grep -q 'handleWebhook' src/billing/port.ts \
  || fail "port.ts must define handleWebhook"
grep -q 'export type PaymentPort' src/billing/port.ts \
  || fail "port.ts must export PaymentPort"
grep -q 'POLAR_FIXTURE_ONLY' src/billing/port.ts \
  || fail "port.ts must honor POLAR_FIXTURE_ONLY"
grep -q 'polarLiveEnabled' src/billing/port.ts \
  || fail "live Polar client is not env-gated"
grep -q 'export class FixturePayment' src/billing/fixture.ts \
  || fail "fixture.ts must export FixturePayment"
grep -q 'export class PolarPayment' src/billing/polar.ts \
  || fail "polar.ts must export PolarPayment"
grep -q 'POLAR_LIVE=1' src/billing/polar.ts \
  || fail "polar.ts must stay env-gated"
grep -q 'applyPaidEvent' src/billing/port.ts \
  || fail "port.ts must apply paid events only"
grep -q 'export function quoteBid' src/core/listing.ts \
  || fail "listing.ts must quote create vs raise"
grep -q 'bid_not_higher' src/core/listing.ts \
  || fail "listing.ts must reject a non-increasing raise"
grep -q 'venueKey' src/core/listing.ts \
  || fail "listing.ts must key raises on venueKey"
grep -q 'findListingByVenueKey' src/db.ts \
  || fail "db.ts must look up the same venue key in this window"
grep -q 'quoteCheckout' src/app/api/checkout/route.ts \
  || fail "checkout must charge the raise difference"
grep -q 'quote.kind' src/app/api/checkout/route.ts \
  || fail "checkout raise path must pass create or raise"
grep -q 'bid_not_higher' tests/checkout.test.ts \
  || fail "checkout tests must cover bid_not_higher"
grep -q 'pays \$7' tests/checkout.test.ts \
  || fail "checkout tests must cover SPEC acceptance 5"
if grep -nE 'fetch\(|polar\.sh|api\.polar' src/billing/fixture.ts src/billing/port.ts >/dev/null; then
  fail "fixture/port must not call Polar over the network"
fi

echo "== rules, about, and URL hygiene =="
for f in \
  src/app/about/page.tsx \
  src/app/rules/page.tsx \
  src/core/url.ts \
  tests/listing.test.ts
do
  [[ -f "$f" ]] || fail "missing $f"
  [[ -s "$f" ]] || fail "empty $f"
done
grep -q 'href="/about"' src/app/layout.tsx || fail "nav must link to /about"
grep -q 'href="/rules"' src/app/layout.tsx || fail "nav must link to /rules"
grep -q 'Rank is money, not stars' src/app/about/page.tsx \
  || fail "about must state rank is money, not stars"
grep -q 'no fake reviews' src/app/about/page.tsx \
  || fail "about must forbid fake reviews"
grep -q 'city-weekend-spot' src/app/about/page.tsx \
  || fail "about must name the city-weekend-spot vertical"
grep -q 'outbid.lol' src/app/about/page.tsx || fail "about must name outbid.lol"
grep -q 'NYC' src/app/about/page.tsx || fail "about must name NYC v1"
grep -q 'global English' src/app/about/page.tsx \
  || fail "about must state global English"
grep -Fq 'min $5' src/app/rules/page.tsx || fail "rules must state min \$5"
grep -q 'older wins ties' src/app/rules/page.tsx \
  || fail "rules must state older wins ties"
grep -q 'raise pays difference' src/app/rules/page.tsx \
  || fail "rules must state raise pays difference"
grep -q 'no fake reviews' src/app/rules/page.tsx \
  || fail "rules must forbid fake reviews"
grep -q 'reviews_forbidden' src/app/rules/page.tsx \
  || fail "rules must name reviews_forbidden"
grep -q 'NSFW' src/app/rules/page.tsx || fail "rules must document NSFW rejects"
grep -q 'utm_' src/core/url.ts || fail "url.ts must strip utm_ tracking keys"
grep -q 'url_forbidden' src/core/url.ts || fail "url.ts must reject forbidden URLs"
grep -q 't.me' src/core/url.ts || fail "url.ts must reject telegram invites"
grep -q 'export function canonicalizeBookingUrl' src/core/url.ts \
  || fail "url.ts must export canonicalizeBookingUrl"
grep -q 'canonicalBookingUrl' src/core/listing.ts \
  || fail "listing.ts must store the stripped booking URL"
grep -q 'url_forbidden' src/core/listing.ts \
  || fail "listing.ts must reject forbidden booking URLs"
grep -q 'reviews_forbidden' src/core/listing.ts \
  || fail "listing.ts must reject review-speak"
grep -q 'utm_source' tests/listing.test.ts \
  || fail "listing tests must cover tracking strip"
grep -q 't.me' tests/listing.test.ts || fail "listing tests must reject telegram"
grep -q 'reviews_forbidden' tests/listing.test.ts \
  || fail "listing tests must reject review-speak"
grep -q '4.9 stars' tests/listing.test.ts \
  || fail "listing tests must cover 4.9 stars"
if grep -RInE '4\.8 stars' src/app/about/page.tsx src/app/rules/page.tsx >/dev/null; then
  fail "about/rules must not invent review scores"
fi
if grep -RInEi '★|star rating|4\.8 stars' src/app/about src/app/rules >/dev/null; then
  fail "about/rules must not render stars"
fi

echo "== public click counts =="
for f in \
  src/app/api/click/\[id\]/route.ts \
  tests/click.test.ts
do
  [[ -f "$f" ]] || fail "missing $f"
  [[ -s "$f" ]] || fail "empty $f"
done
grep -q 'export async function GET' src/app/api/click/\[id\]/route.ts \
  || fail "click route must export GET"
grep -q '302' src/app/api/click/\[id\]/route.ts \
  || fail "click route must 302 to the booking URL"
grep -q 'incrementListingClicks' src/app/api/click/\[id\]/route.ts \
  || fail "click route must increment the public counter"
grep -q 'listing_not_found' src/app/api/click/\[id\]/route.ts \
  || fail "unknown click id must 404"
grep -q 'canonicalizeBookingUrl' src/app/api/click/\[id\]/route.ts \
  || fail "click hop must use the cleaned booking URL"
if grep -nE 'billing/polar|POLAR_LIVE=1|polar\.sh' src/app/api/click/\[id\]/route.ts >/dev/null; then
  fail "click route must not import live Polar"
fi
grep -q '302s to the stripped booking URL' tests/click.test.ts \
  || fail "click tests must cover 302 + increment"
grep -q 'unknown listing click' tests/click.test.ts \
  || fail "click tests must cover unknown id 404"
grep -q 'data-clicks' tests/click.test.ts \
  || fail "click tests must assert clicks are visible on the card"
grep -q 'SPEC acceptance 9' tests/click.test.ts \
  || fail "click tests must cover SPEC acceptance 9"
grep -q 'utm_source' tests/click.test.ts \
  || fail "click tests must 302 to the stripped booking URL"
if grep -Eq '^\s*(bash )?scripts/live-smoke\.sh' scripts/test.sh; then
  fail "test.sh must not invoke live-smoke.sh"
fi

if [[ -f package.json ]]; then
  echo "== install =="
  if [[ ! -d node_modules ]]; then
    if [[ -f package-lock.json ]]; then
      npm ci
    else
      npm install
    fi
  fi

  unset POLAR_LIVE POLAR_ACCESS_TOKEN POLAR_WEBHOOK_SECRET POLAR_API_BASE POLAR_PRODUCT_ID
  export POLAR_FIXTURE_ONLY=1
  [[ "${POLAR_LIVE:-}" != "1" ]] || fail "POLAR_LIVE must stay unset in test.sh"

  echo "== tsc --noEmit =="
  npx tsc --noEmit

  echo "== unit tests =="
  test_log="$(mktemp)"
  trap 'rm -f "$test_log"' EXIT
  set +e
  npx tsx --test --test-concurrency=1 --test-reporter spec 'tests/**/*.test.ts' | tee "$test_log"
  test_status=${PIPESTATUS[0]}
  set -e
  [[ $test_status -eq 0 ]] || fail "unit tests failed"
  grep -Eq 'tests[[:space:]]+[1-9][0-9]*' "$test_log" \
    || fail "test runner reported 0 tests"
  grep -q 'fixture create' "$test_log" \
    || fail "checkout fixture test did not run"
  grep -q 'abandoned checkout' "$test_log" \
    || fail "abandoned checkout test did not run"
  grep -q 'raises' "$test_log" \
    || fail "raise-bid test did not run"
  grep -q 'bid_not_higher' "$test_log" \
    || fail "bid_not_higher test did not run"
  grep -q 'utm_source' "$test_log" \
    || fail "URL hygiene tracking-strip test did not run"
  grep -q 'reviews_forbidden' "$test_log" \
    || fail "reviews_forbidden test did not run"
  grep -q 'url_forbidden' "$test_log" \
    || fail "url_forbidden test did not run"
  grep -q 'stripped booking URL' "$test_log" \
    || fail "click 302 increment test did not run"
  grep -q 'unknown listing click' "$test_log" \
    || fail "unknown click id test did not run"
  grep -q 'SPEC acceptance 9' "$test_log" \
    || fail "SPEC acceptance 9 click test did not run"
  grep -q 'unpublished weekend poster' "$test_log" \
    || fail "weekend poster empty-state test did not run"
  grep -q 'kind, \$bid, clicks, and Book' "$test_log" \
    || fail "place-card test did not run"
  grep -q 'books the paid #1 as the weekend answer' "$test_log" \
    || fail "occupied #1 booking test did not run"
  grep -q 'List a venue hop to the claim form' "$test_log" \
    || fail "occupied List a venue hop test did not run"
  grep -q 'later ranks stamp Book as the certain hop' "$test_log" \
    || fail "occupied later-rank Book test did not run"
  grep -q 'lists after later-rank Book' "$test_log" \
    || fail "occupied list-after-book test did not run"
  grep -q 'books after the list hop' "$test_log" \
    || fail "occupied book-after-list test did not run"
  grep -q 'lists after Book follows the list hop' "$test_log" \
    || fail "occupied list-after-book-hop test did not run"
  grep -q 'books after List follows Book' "$test_log" \
    || fail "occupied book-after-list-hop test did not run"
  grep -q 'books #1 as the first hop without another Book' "$test_log" \
    || fail "occupied Book #1 first-hop test did not run"
  grep -q 'lists after Book #1 without another Book' "$test_log" \
    || fail "occupied List after Book #1 test did not run"
  grep -q 'books #1 after List a venue without another Book' "$test_log" \
    || fail "occupied Book #1 after List a venue test did not run"
  grep -q 'lists after Book #1 is re-concentrated without another Book' "$test_log" \
    || fail "occupied List after Book #1 re-concentrate test did not run"
  grep -q 'poster form POST' "$test_log" \
    || fail "poster Polar checkout form test did not run"
  grep -q 'never trusts query alone' "$test_log" \
    || fail "checkout return page test did not run"
fi

echo "OK: buildable and testable"
