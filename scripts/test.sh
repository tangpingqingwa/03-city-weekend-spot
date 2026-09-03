#!/usr/bin/env bash
# Offline gate for main. Must exit 0 on a clean clone with no secrets.
# Contract checks stay. Once src/ exists this script typechecks and runs
# node:test. Do not require live Waffo or any third-party network.
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
grep -q 'Waffo' SPEC.md || fail "SPEC.md missing Waffo"

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
# Cover both GitHub Actions mapping syntax (`KEY: value`) and shell syntax
# (`KEY=value`) for every payment, Waffo, legacy Polar, callback, and DB
# selector. CI stays fixture/offline and must not receive provider material.
ci_provider_selector_re="(^|[[:space:]\"'])(PAYMENT_MODE|WAFFO_MODE|WAFFO_LIVE|WAFFO_PRIVATE_KEY|WAFFO_PRIVATE_KEY_FILE|WAFFO_MERCHANT_ID|WAFFO_STORE_ID|WAFFO_PRODUCT_ID|WAFFO_WEBHOOK_PUBLIC_KEY|WAFFO_WEBHOOK_TEST_PUBLIC_KEY|WAFFO_WEBHOOK_PROD_PUBLIC_KEY|WAFFO_API_BASE|WAFFO_PUBLIC_BASE_URL|WAFFO_CHECKOUT_TIMEOUT_MS|PUBLIC_BASE_URL|DATABASE_PATH|POLAR_LIVE|POLAR_ACCESS_TOKEN|POLAR_WEBHOOK_SECRET|POLAR_API_BASE|POLAR_PRODUCT_ID|POLAR_SUCCESS_URL|POLAR_FIXTURE_ONLY)([[:space:]\"']*[:=])"
if grep -Eqi "$ci_provider_selector_re" .github/workflows/ci.yml; then
  fail "CI must not set payment, provider, callback, or database selectors"
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
[[ -f src/instrumentation.ts ]] || fail "missing startup readiness instrumentation"
grep -q 'assertRuntimeReadiness' src/instrumentation.ts \
  || fail "startup readiness instrumentation must call assertRuntimeReadiness"
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
if grep -q 'redirect' src/app/page.tsx; then
  fail "src/app/page.tsx must render the canonical NYC board without a redirect"
fi
grep -q 'getBoardListings' src/app/page.tsx || fail "src/app/page.tsx must load the default NYC board"
grep -q 'data-city=\"nyc\"' src/app/page.tsx || grep -q 'resolveCity(\"nyc\")' src/app/page.tsx \
  || fail "src/app/page.tsx must resolve NYC directly"
grep -q 'canonical' src/app/page.tsx || fail "src/app/page.tsx must declare root canonical metadata"
grep -q 'defaultBoardPath' src/core/cities.ts || fail "cities.ts must expose the default board path"
grep -q 'canonicalBoardPath' src/core/cities.ts || fail "cities.ts must expose canonical city paths"
grep -Fq 'alternates: { canonical: "/" }' src/app/page.tsx \
  || fail "homepage metadata must canonicalize to /"
grep -Fq 'start_url: "/"' src/app/manifest.ts \
  || fail "manifest must start at the canonical root board"
grep -Fq '`${SITE_URL}/`' src/app/sitemap.ts \
  || fail "sitemap must publish the canonical root board"
if grep -Fq '`${SITE_URL}/nyc`' src/app/sitemap.ts; then
  fail "sitemap must not publish the NYC compatibility alias"
fi
grep -q 'slug: "nyc"' src/core/cities.ts || fail "cities.ts must catalog nyc"
grep -q 'America/New_York' src/core/cities.ts || fail "cities.ts must use America/New_York for nyc"
grep -q 'getBoardListings' src/core/cities.ts || fail "cities.ts must expose getBoardListings"
grep -q 'return \[\]' src/core/cities.ts || fail "live board must invent no venues"
if grep -q 'OutbidReferenceFixturePage\|OUTBID_REFERENCE_ROWS\|isOutbidReferenceFixture\|paymentMode' src/app/\[city\]/page.tsx; then
  fail "public city route must not reach the reference fixture"
fi
if grep -qE 'CompactBoardSummary|afterTopThree|data-board-summary|data-todays-ranking|data-latest-activity|summary-ranking|activity-list|summary-strips' src/app/\[city\]/board.tsx; then
  fail "CityBoard must not render duplicated summary mini-panels"
fi
grep -q 'data-identity="city-weekend-poster"' src/app/\[city\]/board.tsx \
  || fail "CityBoard must stamp the City Weekend poster identity"
grep -q 'data-poster-answer' src/app/\[city\]/board.tsx \
  || fail "CityBoard must expose the editorial poster answer"
grep -q 'data-poster-later-list' src/app/\[city\]/board.tsx \
  || fail "CityBoard must expose the later poster list"
grep -q 'r23 City Weekend identity' src/app/board.css \
  || fail "board CSS must own the r23 City Weekend identity"
grep -q 'persistedKind' src/app/\[city\]/bid-form.tsx \
  || fail "presentation categories must not broaden persisted VenueKind"
grep -q 'Claim rank' src/app/\[city\]/bid-form.tsx || fail "bid form must render Claim rank"
grep -q 'Claim #1' src/app/\[city\]/bid-form.tsx || fail "bid form must clone Claim #1"
grep -q 'action="/api/checkout"' src/app/\[city\]/bid-form.tsx \
  || fail "bid form must POST to the Waffo-owned checkout route"
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
grep -q 'data-unpaid-off-board' src/app/\[city\]/bid-form.tsx \
  || fail "claim form must stamp unpaid checkout never ranks"
grep -q 'Checkout must be completed before a venue can join the ranking' src/app/\[city\]/bid-form.tsx \
  || fail "claim form must say checkout completion is required before ranking"
grep -q 'before a venue can join the ranking' src/app/\[city\]/bid-form.tsx \
  || fail "claim form must keep unpaid checkout off the ranking"
python3 - src/app/\[city\]/bid-form.tsx <<'PY' || fail "bid form must put the venue field before one Claim rank submit"
import re
import sys

src = open(sys.argv[1], encoding="utf-8").read()
form = re.search(r"<form[\s\S]*?</form>", src)
if not form:
    raise SystemExit("bid form markup missing")
body = form.group(0)
venue_at = body.find("{venueField}")
claim_at = body.find("{claimButton}")
if venue_at < 0 or claim_at < 0 or venue_at > claim_at:
    raise SystemExit("venue field must precede Claim rank in the shared bid row")
if body.count("{venueField}") != 1 or body.count("{claimButton}") != 1:
    raise SystemExit("form must render exactly one venue field and one Claim rank submit")
if 'className="bid-row"' not in body:
    raise SystemExit("form must keep the shared bid row")
PY
grep -q 'data-unpaid-off-board' src/app/board.css \
  || fail "poster CSS must make unpaid-off-board certain on the claim form"
grep -q '\.poster\[data-occupied="false"\] \.claim \[data-bid-form\]' src/app/board.css \
  || fail "empty claim CSS must compose the direct bid form"
grep -q '\.poster\[data-occupied="false"\] \.claim \.bid-row' src/app/board.css \
  || fail "empty claim CSS must compose the shared venue and Claim rank row"
grep -q 'data-empty-board' src/app/\[city\]/board.tsx || fail "board must have an honest empty state"
grep -q 'unpublished' src/app/\[city\]/board.tsx || fail "empty board must read like an unpublished weekend"
grep -q 'empty-answer' src/app/\[city\]/board.tsx || fail "empty board must print No #1 as the weekend answer"
grep -q 'empty-note' src/app/\[city\]/board.tsx || fail "unpublished must sit under No #1, not above it"
grep -q 'empty-window' src/app/\[city\]/board.tsx \
  || fail "unpublished must name the rolling last-7-days window"
grep -q 'empty-bid-open' src/app/\[city\]/board.tsx \
  || fail "unpublished must name when new bids open"
grep -q 'data-empty-unpublished' src/app/\[city\]/board.tsx \
  || fail "empty board must stamp unpublished so occupied chrome stays off"
grep -q 'unpublished-weekend' src/app/\[city\]/board.tsx \
  || fail "empty /nyc must use unpublished-weekend, not the occupied listings fold"
if grep -n 'function UnpublishedWeekend' -A 45 src/app/\[city\]/board.tsx | grep -q 'className="fold"'; then
  fail "unpublished weekend must not reuse the occupied listings fold"
fi
if grep -n 'function UnpublishedWeekend' -A 45 src/app/\[city\]/board.tsx | grep -q 'fold-rule'; then
  fail "unpublished weekend must not keep the occupied fold-rule"
fi
if grep -n 'function UnpublishedWeekend' -A 45 src/app/\[city\]/board.tsx | grep -qE 'book-one|book-later|later-facts|place-foot|BookingHop|later-stack|later-stack-lists|later-stack-also|later-stack-closed-kicker|rest-name'; then
  fail "unpublished weekend must not compose Book #1, later Book, later-facts, or later-stack"
fi
if grep -n 'function UnpublishedWeekend' -A 45 src/app/\[city\]/board.tsx | grep -q 'data-rolling-week'; then
  fail "unpublished must not stamp occupied data-rolling-week"
fi
if grep -n 'function UnpublishedWeekend' -A 45 src/app/\[city\]/board.tsx | grep -q 'week-window'; then
  fail "unpublished must not reuse occupied week-window chrome"
fi
if grep -n 'function UnpublishedWeekend' -A 55 src/app/\[city\]/board.tsx | grep -qE 'data-action="claim-rank"|data-bid-form|<button'; then
  fail "unpublished copy must not embed Claim rank controls"
fi
if ! grep -n 'function UnpublishedWeekend' -A 55 src/app/\[city\]/board.tsx | grep -q 'Paid placements remain eligible for seven days'; then
  fail "unpublished must state the seven-day paid-placement eligibility"
fi
if ! grep -n 'function UnpublishedWeekend' -A 55 src/app/\[city\]/board.tsx | grep -q 'Claim rank is available any time'; then
  fail "unpublished must advertise an always-open Claim rank"
fi
if grep -n 'function UnpublishedWeekend' -A 55 src/app/\[city\]/board.tsx | grep -qE 'Monday 00:00 UTC|New bids open Thursday|close Sunday|New bids are closed|empty-window-closed'; then
  fail "unpublished must not advertise the retired Thursday–Sunday gate"
fi
if grep -qE 'data-window-closed|data-claim-state=\"closed\"|empty-window-closed|occupied-window-closed|occupied-closed-checkout-error|empty-unpublished-checkout-error' \
  src/app/\[city\]/board.tsx src/app/board.css; then
  fail "board UI must not render a time-closed state"
fi
if grep -qE 'bidsOpen|assertWindowOpen|isWindowOpen' src/app/\[city\]/board.tsx src/app/\[city\]/bid-form.tsx src/billing/port.ts; then
  fail "runtime board and checkout must not gate claims on the historical window"
fi
grep -q 'occupied-bid-close' src/app/\[city\]/board.tsx \
  || fail "occupied details must retain a quiet rolling eligibility note"
grep -q 'occupied-bid-close' src/app/board.css \
  || fail "poster CSS must style occupied rolling eligibility copy"
if ! grep -n 'className="occupied-bid-close"' -A 5 src/app/\[city\]/board.tsx | grep -q 'Claims are available any time'; then
  fail "occupied details must say claims are available any time"
fi
if grep -n 'function UnpublishedWeekend' -A 55 src/app/\[city\]/board.tsx | grep -q 'occupied-bid-close'; then
  fail "do not restamp empty unpublished with occupied-bid-close"
fi
python3 - src/app/\[city\]/board.tsx <<'PY' || fail "occupied board must expose one ordinary list action"
import re
import sys

src = open(sys.argv[1], encoding="utf-8").read()
for phrase in (
    "after the list hop",
    "after Book follows List",
    "after List follows Book",
    "data-list-after-book",
    "data-book-after-list",
):
    if phrase in src:
        raise SystemExit(f"obsolete action ladder marker: {phrase}")
if src.count('data-list-venue') != 1:
    raise SystemExit("occupied board must define exactly one List a venue marker")
if src.count('className="list-venue"') != 1:
    raise SystemExit("occupied board must define exactly one List a venue link")
city_board = src[src.index("export function CityBoard"):]
if not re.search(r"occupied && numberOne", city_board):
    raise SystemExit("occupied board must keep its paid answer branch")
if "bidsOpen" in city_board:
    raise SystemExit("occupied board must not gate List a venue or Claim rank on bidsOpen")
if "<BookingHop" in city_board:
    raise SystemExit("occupied hero must not duplicate the paid-card Book CTA")
if city_board.count("<BidForm") < 2:
    raise SystemExit("both empty and occupied boards must render the Claim rank form")
PY
grep -q 'data-occupied' src/app/\[city\]/board.tsx \
  || fail "board must mark occupied vs empty so occupied chrome cannot leak"
if grep -q 'empty-kicker' src/app/\[city\]/board.tsx; then
  fail "empty board must not keep unpublished as the large kicker"
fi
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -qE 'prize-before-price|data-prize|later-fact|later-facts|book-one-first|data-book-number-one|guest-first|unpaid-off-board|later-stack|rest-name'; then
  fail "empty board must not stamp prize venue, later-fact \$bid, Book #1, unpaid note, or later-stack"
fi
grep -q 'data-occupied="false"' src/app/board.css \
  || fail "poster CSS must keep occupied chrome off empty /nyc"
grep -q 'unpublished-weekend' src/app/board.css \
  || fail "poster CSS must style unpublished /nyc off the occupied fold"
grep -q 'empty-window' src/app/board.css \
  || fail "poster CSS must style unpublished rolling-window copy"
grep -q 'empty-bid-open' src/app/board.css \
  || fail "poster CSS must style unpublished bid-open copy"
python3 - src/app/board.css <<'PY' || fail "occupied Book chrome must not paint on unpublished /nyc"
import re
import sys

css = open(sys.argv[1], encoding="utf-8").read()
if ".unpublished-weekend[data-empty-unpublished]" not in css:
    raise SystemExit("unpublished weekend CSS missing")
if re.search(r"(?m)^\.book-one\s*\{", css):
    raise SystemExit("unscoped .book-one can leak onto empty /nyc")
if re.search(r"(?m)^\.book-later\s*,", css) or re.search(r"(?m)^\.book-later\s*\{", css):
    raise SystemExit("unscoped .book-later can leak onto empty /nyc")
if re.search(r"(?m)^\.place-foot\s*\{", css):
    raise SystemExit("unscoped .place-foot can leak onto empty /nyc")
if re.search(r"(?m)^\.later-stack\s*\{", css):
    raise SystemExit("unscoped .later-stack can leak onto empty /nyc")
if re.search(r"(?m)^\.rest-name\s*\{", css):
    raise SystemExit("unscoped .rest-name can leak onto empty /nyc")
if re.search(r"(?m)^\.number-one \.later-facts\[data-later-fact\]\s*\{", css):
    raise SystemExit("unscoped later-facts can leak onto empty /nyc")
if ".poster[data-occupied=\"true\"] .book-one" not in css:
    raise SystemExit("Book #1 must stay occupied-only")
if ".book-later[data-later-book-foot]" not in css:
    raise SystemExit("later Book must stay occupied-only")
if '.place-foot[data-later-book-foot]' not in css:
    raise SystemExit("later Book foot hop must stay occupied-only")
if ".poster[data-occupied=\"true\"] .place-foot" not in css:
    raise SystemExit("later Book foot must stay occupied-only")
if '.poster[data-occupied="false"] .unpublished-weekend[data-empty-unpublished] .book-one' not in css:
    raise SystemExit("empty CSS must keep Book #1 off unpublished")
if '.poster[data-occupied="false"] .unpublished-weekend[data-empty-unpublished] .book-later' not in css:
    raise SystemExit("empty CSS must keep later Book off unpublished")
if '.poster[data-occupied="false"] .unpublished-weekend[data-empty-unpublished] .later-facts' not in css:
    raise SystemExit("empty CSS must keep later-facts off unpublished")
if re.search(r"(?m)^\.weekend-answer\s*\{", css):
    raise SystemExit("unscoped .weekend-answer can leak unpaid chrome onto empty /nyc")
if re.search(r"(?m)^\.number-one\s*\{", css):
    raise SystemExit("unscoped .number-one can leak unpaid chrome onto empty /nyc")
if '.poster[data-occupied="true"] .number-one[data-paid-at] .weekend-answer' not in css:
    raise SystemExit("occupied #1 prize chrome must stay paid-only")
if '.poster[data-occupied="false"] .unpublished-weekend[data-empty-unpublished] .weekend-answer' not in css:
    raise SystemExit("empty CSS must keep weekend-answer off unpublished")
if '.poster[data-occupied="false"] .unpublished-weekend[data-empty-unpublished] .number-one' not in css:
    raise SystemExit("empty CSS must keep occupied #1 chrome off unpublished")
if '.poster[data-occupied="false"] .unpublished-weekend[data-empty-unpublished] .empty-window' not in css:
    raise SystemExit("empty CSS must name the rolling window on unpublished")
if '.poster[data-occupied="false"] .unpublished-weekend[data-empty-unpublished] .empty-bid-open' not in css:
    raise SystemExit("empty CSS must name bid-open on unpublished")
empty_window = re.search(
    r'\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-window\s*\{([^}]*)\}',
    css,
)
if not empty_window:
    raise SystemExit("empty-window CSS missing")
if "background: var(--accent)" in empty_window.group(1):
    raise SystemExit("do not recolor empty window copy")
empty_bid_open = re.search(
    r'\.poster\[data-occupied="false"\] \.unpublished-weekend\[data-empty-unpublished\] \.empty-bid-open\s*\{([^}]*)\}',
    css,
)
if not empty_bid_open:
    raise SystemExit("empty-bid-open CSS missing")
if "background: var(--accent)" in empty_bid_open.group(1):
    raise SystemExit("do not recolor empty bid-open copy")
if re.search(r"data-list-after-book|data-book-after-list|list-after-book|book-after-list", css):
    raise SystemExit("poster CSS must not carry the removed action ladder")
if '.poster[data-occupied="false"] .unpublished-weekend[data-empty-unpublished] [data-rolling-week]' not in css:
    raise SystemExit("empty CSS must keep occupied rolling-week chrome off unpublished")
if '.poster[data-occupied="true"] .period-meta.week-window[data-rolling-week]' not in css:
    raise SystemExit("occupied rolling-week chrome must stay occupied-only")
if '.poster[data-occupied="true"] .occupied-bid-close' not in css:
    raise SystemExit("occupied CSS must name rolling eligibility details")
if '.poster[data-occupied="false"] .occupied-bid-close' not in css:
    raise SystemExit("empty CSS must keep occupied details off unpublished")
if '.poster[data-occupied="false"] .unpublished-weekend[data-empty-unpublished] .occupied-bid-close' not in css:
    raise SystemExit("empty unpublished CSS must keep occupied details off unpublished")
occupied_bid_close = re.search(
    r'\.poster\[data-occupied="true"\] \.occupied-bid-close\s*\{([^}]*)\}',
    css,
)
if not occupied_bid_close:
    raise SystemExit("occupied-bid-close CSS missing")
if "background: var(--accent)" in occupied_bid_close.group(1):
    raise SystemExit("do not recolor occupied-open bid-close copy")
if "display: none" in occupied_bid_close.group(1):
    raise SystemExit("do not hide occupied-open bid-close copy")
if re.search(r"(?m)^\.occupied-bid-close\s*\{", css):
    raise SystemExit("unscoped .occupied-bid-close can leak onto empty /nyc")
if ".poster[data-occupied=\"true\"] .book-one" not in css:
    raise SystemExit("occupied Book #1 must stay occupied-only")
PY
grep -q 'city-name' src/app/\[city\]/board.tsx || fail "city name must be the masthead"
grep -q 'className="place"' src/app/\[city\]/board.tsx || fail "venue card must read as a place"
grep -q 'data-kind' src/app/\[city\]/board.tsx || fail "place card must show kind"
grep -q 'className="pitch"' src/app/\[city\]/board.tsx || fail "place card must show pitch"
grep -q 'Book' src/app/\[city\]/board.tsx || fail "place card must keep the Book CTA"
grep -q 'data-weekend-answer' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must be the weekend answer"
grep -q 'data-paid-at' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must stamp Waffo paid-at before prize chrome"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'data-paid-at'; then
  fail "empty board must not stamp Waffo paid-at"
fi
grep -q 'isPaidListing' src/core/listing.ts \
  || fail "listing.ts must tell Waffo-paid rows from unpaid placeholders"
grep -q 'isPaidListing' src/core/rank.ts \
  || fail "live board must filter unpaid Waffo checkout before ranking"
grep -q 'filter(isPaidListing)' src/core/rank.ts \
  || fail "getBoardListings must drop unpaid rows before rank"
if grep -n 'function getBoardListings' -A 20 src/core/rank.ts | grep -q 'listingsForCityWindow(db, city, window.id),'; then
  fail "live board must not rank unpaid Waffo checkout"
fi
if grep -n 'function getBoardListings' -A 20 src/core/rank.ts | grep -q 'currentWindow'; then
  fail "live occupied board must not expire at civil Monday midnight via currentWindow"
fi
grep -q 'data-prize-before-price' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must put the venue prize before \$bid"
grep -q 'data-prize=' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must mark the venue as the prize"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'prize-before-price'; then
  fail "empty board must not stamp prize before price"
fi
if grep -n 'data-later-book=""' -A 30 src/app/\[city\]/board.tsx | grep -q 'prize-before-price'; then
  fail "later ranks must not stamp prize before price"
fi
grep -q 'data-later-fact' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must stamp the later-fact money group"
if grep -qE 'className="bid later-fact"|className="clicks later-fact"' src/app/\[city\]/board.tsx; then
  fail "occupied #1 must not mute \$bid on the same node (stamp-only later-fact)"
fi
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -qE 'data-later-fact|later-facts|bid later-fact'; then
  fail "empty board must not stamp later-fact \$bid"
fi
if grep -n 'data-later-book=""' -A 30 src/app/\[city\]/board.tsx | grep -qE 'data-later-fact|later-facts|bid later-fact'; then
  fail "later ranks must not stamp later-fact \$bid"
fi
python3 - src/app/\[city\]/board.tsx <<'PY' || fail "occupied #1 \$bid must change grouping, not a muted twin paragraph"
import re
import sys

src = open(sys.argv[1], encoding="utf-8").read()
match = re.search(
    r"function NumberOnePlace\([\s\S]*?\n(?:export )?function ",
    src,
)
if not match:
    raise SystemExit("NumberOnePlace missing")
body = match.group(0)
if 'className="bid later-fact"' in body or "bid later-fact" in body:
    raise SystemExit("stamp-only later-fact class on $bid")
if re.search(r"<p className=\"bid\"", body):
    raise SystemExit("$bid is still a sibling paragraph after Book")
facts = re.search(
    r"<footer className=\"later-facts\"[^>]*>[\s\S]*?</footer>",
    body,
)
if not facts:
    raise SystemExit("later-facts footer missing")
group = facts.group(0)
if 'data-later-fact=""' not in group:
    raise SystemExit("later-facts group must carry data-later-fact")
if 'data-bid=""' not in group or 'data-clicks=""' not in group:
    raise SystemExit("$bid and clicks must share the later-facts group")
if "BookingHop" not in body.split("later-facts", 1)[0]:
    raise SystemExit("Book #1 must stay before the later-fact group")
if 'data-prize=""' not in body.split("later-facts", 1)[0]:
    raise SystemExit("venue prize must stay before the later-fact group")
PY
grep -q 'data-book-number-one' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must expose a primary Book hop"
grep -q 'book-one' src/app/\[city\]/board.tsx \
  || fail "occupied #1 Book must use the primary booking class"
grep -q 'data-book-one-first' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must stamp Book as the first hop"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'book-one-first'; then
  fail "empty board must not stamp Book #1"
fi
if grep -n 'data-later-book=""' -A 30 src/app/\[city\]/board.tsx | grep -q 'book-one-first'; then
  fail "later ranks must not stamp Book #1 as the first hop"
fi
grep -q 'data-guest-first' src/app/\[city\]/board.tsx \
  || fail "occupied Book #1 must stay the first guest click"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'guest-first'; then
  fail "empty board must not stamp guest-first Book #1"
fi
if grep -n 'data-later-book=""' -A 30 src/app/\[city\]/board.tsx | grep -q 'guest-first'; then
  fail "later ranks must not stamp guest-first Book #1"
fi
if grep -n 'data-list-venue' -A 20 src/app/\[city\]/board.tsx | grep -q 'guest-first'; then
  fail "List a venue must not steal the first guest click"
fi
if grep -n 'className="book-later"' -A 8 src/app/\[city\]/board.tsx | grep -q 'guestFirst\|guest-first'; then
  fail "later-rank Book must not steal the first guest click"
fi
if grep -n 'function LaterBookFoot' -A 16 src/app/\[city\]/board.tsx | grep -q 'guestFirst\|guest-first\|data-book-number-one\|className="book-one"'; then
  fail "later Book foot hop must not reuse Book #1 fill"
fi
if grep -n 'function BookingHop' -A 50 src/app/\[city\]/board.tsx | grep -qE 'data-book-later|later\?:'; then
  fail "filled BookingHop must not also be the later Book foot hop"
fi
grep -q 'data-later-book' src/app/\[city\]/board.tsx \
  || fail "later ranks must stamp Book as a later hop"
grep -q 'data-book-later' src/app/\[city\]/board.tsx \
  || fail "later ranks must expose a Book hop"
grep -q 'book-later' src/app/\[city\]/board.tsx \
  || fail "later-rank Book must use the later booking class"
grep -q 'function LaterBookFoot' src/app/\[city\]/board.tsx \
  || fail "later Book must be its own foot hop, not a muted BookingHop"
grep -q 'data-later-book-foot' src/app/\[city\]/board.tsx \
  || fail "later ranks must stamp the Book foot hop"
grep -q 'data-later-rank' src/app/\[city\]/board.tsx \
  || fail "later ranks must stamp later-rank cards, not prize titles"
grep -q 'data-later-stack' src/app/\[city\]/board.tsx \
  || fail "later ranks must group under the occupied #1 venue"
grep -q 'rest-name' src/app/\[city\]/board.tsx \
  || fail "later-rank venue names must use rest-name anatomy, not .title"
grep -q 'Also this weekend' src/app/\[city\]/board.tsx \
  || fail "later ranks must name the quieter stack"
if grep -q 'data-later-quiet' src/app/\[city\]/board.tsx src/app/board.css; then
  fail "later ranks must not stamp data-later-quiet on the same venue node"
fi
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -qE 'later-stack|later-rank|rest-name'; then
  fail "empty board must not stamp later-rank stack"
fi
if grep -n 'data-prize-before-price' -A 30 src/app/\[city\]/board.tsx | grep -qE 'later-stack|data-later-rank|rest-name'; then
  fail "occupied #1 prize must not stamp later-rank stack"
fi
if grep -n 'className="title"' src/app/\[city\]/board.tsx | grep -q 'rest-name\|later-rank'; then
  fail "later ranks must not reuse occupied #1 title chrome"
fi
python3 - src/app/\[city\]/board.tsx <<'PY' || fail "later Book must recede into the place-foot, not stay a sibling CTA"
import re
import sys

src = open(sys.argv[1], encoding="utf-8").read()
if "function LaterBookFoot" not in src:
    raise SystemExit("later Book must be its own foot hop, not BookingHop")
hop = re.search(r"function BookingHop\([\s\S]*?\nfunction ", src)
if not hop:
    raise SystemExit("BookingHop missing")
if "data-book-later" in hop.group(0) or "later?" in hop.group(0):
    raise SystemExit("filled BookingHop still mutes into later Book")
match = re.search(
    r"export function ListingCard\([\s\S]*?\nfunction LaterBookFoot",
    src,
)
if not match:
    raise SystemExit("ListingCard missing")
body = match.group(0)
later = body.split("rank === 1", 1)[-1]
if "LaterBookFoot" not in later:
    raise SystemExit("later Book hop missing")
if 'className="place-foot"' not in later and "className=\"place-foot\"" not in later:
    raise SystemExit("later place-foot missing")
if "data-later-book-foot" not in later:
    raise SystemExit("later Book foot hop stamp missing")
foot = later.split("place-foot", 1)[-1]
if "LaterBookFoot" not in foot:
    raise SystemExit("later Book must sit in the place-foot")
if later.split("place-foot", 1)[0].count("LaterBookFoot"):
    raise SystemExit("later Book is still a sibling CTA before the foot")
if "BookingHop" in later:
    raise SystemExit("later Book still reuses the filled BookingHop")
if 'className="bid later-fact"' in later or "later-facts" in later:
    raise SystemExit("later ranks must not reuse occupied later-facts grouping")
if "data-guest-first" in later or "guestFirst" in later:
    raise SystemExit("later Book must not steal guest-first")
if "data-prize=" in later or "prize-before-price" in later:
    raise SystemExit("later ranks must not stamp the venue prize")
if 'className="title"' in later:
    raise SystemExit("later ranks must not reuse occupied .title prize chrome")
if 'className="rest-name"' not in later:
    raise SystemExit("later venue names must use rest-name anatomy")
if "data-later-rank" not in later:
    raise SystemExit("later cards must stamp data-later-rank")
if "data-later-quiet" in later:
    raise SystemExit("do not stamp-mute later venues with data-later-quiet")
PY
echo "== occupied action hierarchy =="
grep -q 'data-list-venue' src/app/\[city\]/board.tsx \
  || fail "occupied board must mark the single List a venue action"
grep -q 'href="#claim"' src/app/\[city\]/board.tsx \
  || fail "List a venue must point at the claim form"
grep -q 'List a venue' src/app/\[city\]/board.tsx \
  || fail "occupied masthead must say List a venue"
grep -q 'List a venue this weekend' src/app/\[city\]/bid-form.tsx \
  || fail "claim must say List a venue this weekend"
if grep -qE 'after the list hop|after Book follows List|after List follows Book|data-list-after-book|data-book-after-list|list-after-book|book-after-list' src/app/\[city\]/board.tsx src/app/board.css; then
  fail "removed action ladder must not remain in board source or CSS"
fi
if [[ "$(grep -o 'data-list-venue' src/app/\[city\]/board.tsx | wc -l | tr -d ' ')" != "1" ]]; then
  fail "occupied board must expose exactly one List a venue marker"
fi
if [[ "$(grep -o 'className=\"list-venue\"' src/app/\[city\]/board.tsx | wc -l | tr -d ' ')" != "1" ]]; then
  fail "occupied board must expose exactly one List a venue link"
fi
grep -q 'weekend-answer' src/app/board.css \
  || fail "poster CSS must style the occupied weekend answer"
grep -q 'data-prize-before-price' src/app/board.css \
  || fail "poster CSS must enlarge occupied #1 venue over \$bid"
grep -Fq 'clamp(2.85rem, 9vw, 4.4rem)' src/app/board.css \
  || fail "poster CSS must make the occupied venue larger than \$bid"
if ! grep -n 'data-prize-before-price' -A 6 src/app/board.css | grep -q '0.92rem'; then
  fail "poster CSS must keep occupied \$bid quieter than the venue"
fi
grep -q 'later-facts' src/app/board.css \
  || fail "poster CSS must keep occupied #1 \$bid a later fact"
grep -qF '.later-facts[data-later-fact]' src/app/board.css \
  || fail "poster CSS must style the occupied later-fact money group"
if grep -qF '.bid.later-fact[data-later-fact]' src/app/board.css; then
  fail "poster CSS must not mute occupied #1 \$bid on the same node"
fi
grep -q '\.book-one' src/app/board.css \
  || fail "poster CSS must style the primary Book hop"
grep -q 'data-book-one-first' src/app/board.css \
  || fail "poster CSS must concentrate Book #1"
grep -q 'data-guest-first' src/app/board.css \
  || fail "poster CSS must keep occupied Book #1 the first guest click"
if ! grep -n 'book-one\[data-book-number-one\]\[data-guest-first\]' -A 16 src/app/board.css | grep -q '4.35rem'; then
  fail "poster CSS must keep guest-first Book #1 visibly primary"
fi
grep -q 'book-later' src/app/board.css \
  || fail "poster CSS must style later-rank Book"
grep -q 'data-later-book-foot' src/app/board.css \
  || fail "poster CSS must compose later Book as a foot hop"
grep -q 'only filled hop' src/app/board.css \
  || fail "poster CSS must keep Book #1 the only filled hop"
grep -q 'data-later-book' src/app/board.css \
  || fail "poster CSS must style later-rank places"
grep -q 'later-stack' src/app/board.css \
  || fail "poster CSS must group later ranks under occupied #1"
grep -q 'rest-name' src/app/board.css \
  || fail "poster CSS must keep later-rank venue quieter than occupied #1"
if grep -q 'data-later-quiet' src/app/board.css; then
  fail "poster CSS must not mute later venues via data-later-quiet"
fi
if grep -n 'rest-name' -A 12 src/app/board.css | grep -qE '0\.78rem|var\(--muted\)'; then
  fail "later rest-name must not be a 0.78rem --muted mute of the same venue node"
fi
python3 - src/app/board.css <<'PY' || fail "poster CSS must keep later Book an inline foot hop"
import sys

lines = open(sys.argv[1], encoding="utf-8").read().splitlines()
for index, line in enumerate(lines):
    if "place-foot[data-later-book-foot]" not in line:
        continue
    if any("display: inline" in candidate for candidate in lines[index : index + 37]):
        break
else:
    raise SystemExit(1)
PY
python3 - src/app/board.css <<'PY' || fail "later-rank venue and Book must stay quieter than occupied #1"
import re
import sys

css = open(sys.argv[1], encoding="utf-8").read()
prize = re.search(r"clamp\(([\d.]+)rem, 9vw, 4\.4rem\)", css)
later_name = re.search(r"\.place\[data-later-rank\] \.rest-name\s*\{([^}]*)\}", css, re.S)
later_book = re.search(r"\.book-later\[data-later-book-foot\]\s*\{([^}]*)\}", css, re.S)
later_facts = re.search(r"\.number-one\[data-paid-at\] \.later-facts\[data-later-fact\]\s*\{([^}]*)\}", css, re.S)
if not (prize and later_name and later_book and later_facts):
    raise SystemExit("occupied/later anatomy CSS missing")
if "font-size: 1.02rem" not in later_name.group(1):
    raise SystemExit("later venue name must recede by anatomy")
if "display: inline" not in later_book.group(1):
    raise SystemExit("later Book must remain an inline foot CTA")
if "background: transparent" not in later_book.group(1) or "border: 0" not in later_book.group(1):
    raise SystemExit("later Book must remain unfilled")
book_size = re.search(r"font-size:\s*([\d.]+)rem", later_book.group(1))
if not book_size or float(book_size.group(1)) >= float(prize.group(1)):
    raise SystemExit("later Book must remain quieter than the #1 prize")
if "data-list-after-book" in css or "data-book-after-list" in css:
    raise SystemExit("removed action ladder CSS must not return")
PY
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
if grep -RInEi '★|⭐|data-stars=|star-rating|4\.8 stars|review count|rated 4\.9' \
  src/app/\[city\] src/app/page.tsx src/app/layout.tsx src/app/board.css >/dev/null; then
  fail "board UI must not render stars or review chrome"
fi
if grep -RInE 'createCheckout|POLAR_LIVE|polar\.sh' \
  src/app/page.tsx src/app/layout.tsx src/app/board.css src/app/\[city\] src/core \
  >/dev/null 2>&1; then
  fail "board UI / core must not import a payment checkout"
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
grep -q 'ROLLING_WEEK_MS' src/core/window.ts \
  || fail "window.ts must export the rolling last-7-days window"
grep -q 'export function rollingWeekStart' src/core/window.ts \
  || fail "window.ts must export rollingWeekStart"
grep -q 'export function bidInRollingWeek' src/core/window.ts \
  || fail "window.ts must export bidInRollingWeek"
grep -q 'America/New_York' src/core/cities.ts || fail "NYC timezone must stay catalog data"
grep -q 'export function rankListings' src/core/rank.ts || fail "rank.ts must export rankListings"
grep -q 'firstPaidAt' src/core/rank.ts || fail "rank.ts must tie-break on firstPaidAt"
grep -q 'query.city' src/core/rank.ts || fail "rank.ts ranking must take city"
grep -q 'listingsForCityRollingWeek' src/core/rank.ts \
  || fail "live board must load Waffo-paid listings in the rolling last 7 days"
grep -q 'bidInRollingWeek(listing.firstPaidAt' src/core/rank.ts \
  || fail "live paid rows must filter firstPaidAt, not Monday midnight delete"
grep -q 'venueName' src/core/listing.ts || fail "listing.ts must require venueName"
grep -q 'bookingUrl' src/core/listing.ts || fail "listing.ts must require bookingUrl"
grep -q 'venueKey' src/core/listing.ts || fail "listing.ts must define venueKey"
grep -q 'CREATE TABLE' src/db.ts || fail "db.ts must declare cities/windows/listings schema"
if grep -RInE 'POLAR_LIVE=1' src/core src/db.ts tests/window.test.ts tests/rank.test.ts >/dev/null 2>&1; then
  fail "city/window/rank must not wire a payment provider"
fi

echo "== Waffo checkout and fixture =="
for f in \
  src/billing/port.ts \
  src/billing/fixture.ts \
  src/billing/waffo.ts \
  src/billing/waffo-session.ts \
  src/billing/polar.ts \
  src/app/api/checkout/route.ts \
  src/app/api/waffo/webhook/route.ts \
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
grep -q 'PAYMENT_MODE' src/billing/port.ts \
  || fail "port.ts must require an explicit payment mode"
grep -q 'waffo-test' src/billing/port.ts \
  || fail "port.ts must expose waffo-test mode"
grep -q 'waffo-prod' src/billing/port.ts \
  || fail "port.ts must expose waffo-prod mode"
grep -q 'export class FixturePayment' src/billing/fixture.ts \
  || fail "fixture.ts must export FixturePayment"
grep -q 'export class PolarPayment' src/billing/polar.ts \
  || fail "polar.ts must export PolarPayment"
grep -q 'inert' src/billing/polar.ts \
  || fail "polar compatibility adapter must be inert"
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
  fail "fixture/port must not call a provider over the network"
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
grep -q 'star ratings, review scores, or invented quotes' src/app/about/page.tsx \
  || fail "about must forbid review and rating claims"
grep -q 'City Weekend Spot' src/app/about/page.tsx \
  || fail "about must name the City Weekend Spot vertical"
grep -q 'public board' src/app/about/page.tsx || fail "about must describe the public board"
grep -q 'New York' src/app/about/page.tsx || fail "about must name the NYC lane"
grep -q 'English' src/app/about/page.tsx \
  || fail "about must state the board language"
grep -Fq 'A new venue starts at <strong>$5</strong> or more' src/app/rules/page.tsx \
  || fail "rules must state the $5 minimum"
grep -q 'venue placed first keeps the higher rank' src/app/rules/page.tsx \
  || fail "rules must state older-first tie order"
grep -q 'charged only the difference between' src/app/rules/page.tsx \
  || fail "rules must state raise-difference charging"
grep -q 'reviews never influence position' src/app/rules/page.tsx \
  || fail "rules must forbid review-based ranking"
grep -q 'review claims' src/app/rules/page.tsx \
  || fail "rules must document review-claim rejection"
grep -q 'adult content are rejected' src/app/rules/page.tsx \
  || fail "rules must document adult-content rejects"
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
if grep -RInEi '★|⭐|data-stars=|data-rating=|4\.8 stars|rated 4\.9' src/app/about src/app/rules >/dev/null; then
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
  fail "click route must not import a live payment adapter"
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

  # Legacy provider variables are ignored; PAYMENT_MODE is authoritative.
  unset POLAR_LIVE POLAR_ACCESS_TOKEN POLAR_WEBHOOK_SECRET POLAR_API_BASE POLAR_PRODUCT_ID
  unset WAFFO_LIVE WAFFO_MERCHANT_ID WAFFO_STORE_ID WAFFO_PRODUCT_ID WAFFO_PRIVATE_KEY WAFFO_PRIVATE_KEY_FILE WAFFO_WEBHOOK_PUBLIC_KEY
  unset WAFFO_MODE
  export PAYMENT_MODE=fixture
  # Keep the offline gate hermetic; production uses the file-backed default.
  export DATABASE_PATH=:memory:
  [[ "${POLAR_LIVE:-}" != "1" ]] || fail "legacy live provider flag must stay unset in test.sh"

  echo "== tsc --noEmit =="
  npx tsc --noEmit

  echo "== next build =="
  npm run build

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
  grep -q 'empty NYC weekend stays unpublished without occupied chrome' "$test_log" \
    || fail "empty unpublished occupied-chrome test did not run"
  grep -q 'empty NYC weekend keeps Book #1 and later Book off unpublished' "$test_log" \
    || fail "empty unpublished Book leak test did not run"
  grep -q 'empty NYC form leads with venue before one Claim rank submit' "$test_log" \
    || fail "empty direct venue-to-Claim rank form test did not run"
  grep -q 'kind, \$bid, clicks, and Book' "$test_log" \
    || fail "place-card test did not run"
  grep -q 'occupied board keeps the paid #1 answer' "$test_log" \
    || fail "occupied #1 booking test did not run"
  grep -q 'occupied hero exposes one list action' "$test_log" \
    || fail "occupied hero action test did not run"
  grep -q 'occupied board keeps the paid #1 answer' "$test_log" \
    || fail "occupied paid #1 action test did not run"
  grep -q 'occupied later ranks retain one genuine Book CTA' "$test_log" \
    || fail "occupied later Book CTA test did not run"
  grep -q 'occupied later rank styling stays quieter' "$test_log" \
    || fail "occupied later-rank styling test did not run"
  grep -q 'occupied later Book stays quieter than Book #1' "$test_log" \
    || fail "occupied later-Book styling test did not run"
  grep -q 'occupied Book #1 remains the first guest click' "$test_log" \
    || fail "occupied Book #1 first-click test did not run"
  grep -q 'occupied hero has exactly one list action' "$test_log" \
    || fail "occupied single-list regression did not run"
  grep -q 'occupied hero has no redundant hop copy' "$test_log" \
    || fail "occupied no-hop-copy regression did not run"
  grep -q 'occupied later cards keep their own booking CTA' "$test_log" \
    || fail "occupied later-card CTA regression did not run"
  grep -q 'empty board exposes no occupied actions' "$test_log" \
    || fail "empty action-state regression did not run"
  grep -q 'occupied markup removes numbered hop stamps' "$test_log" \
    || fail "removed hop-marker regression did not run"
  grep -q 'occupied later Book remains an unfilled foot CTA' "$test_log" \
    || fail "later Book foot CTA regression did not run"
  grep -q 'prize before price' "$test_log" \
    || fail "occupied prize-before-price test did not run"
  grep -q 'occupied NYC #1 \$bid sits in a later-fact group' "$test_log" \
    || fail "occupied later-fact \$bid group test did not run"
  grep -q 'unpaid checkout never ranks certain' "$test_log" \
    || fail "claim-form unpaid-off-board test did not run"
  grep -q 'abandoned unpaid checkout stays off occupied /nyc' "$test_log" \
    || fail "unpaid stays off the poster leftover test did not run"
  grep -q 'No #1 until Waffo reports paid' "$test_log" \
    || fail "unpaid No #1 until Waffo paid leftover test did not run"
  grep -q 'unpaid Waffo checkout stays off the live board until paid' "$test_log" \
    || fail "live-board unpaid Waffo filter test did not run"
  grep -q 'open Waffo checkout stays off the poster until a paid event' "$test_log" \
    || fail "open Waffo checkout unpaid-off-poster test did not run"
  grep -q 'occupied week window is rolling last-7-days' "$test_log" \
    || fail "occupied rolling last-7-days leftover test did not run"
  grep -q 'empty unpublished names rolling last-7-days' "$test_log" \
    || fail "empty unpublished rolling last-7-days leftover test did not run"
  grep -q 'empty unpublished names when new bids open' "$test_log" \
    || fail "empty unpublished bid-open leftover test did not run"
  grep -q 'empty board keeps Claim rank available outside the historical display window' "$test_log" \
    || fail "empty always-open Claim rank test did not run"
  grep -q 'occupied historical window keeps Claim rank open' "$test_log" \
    || fail "occupied always-open Claim rank test did not run"
  grep -q 'occupied window_closed compatibility keeps claims open all week' "$test_log" \
    || fail "window helper compatibility test did not run"
  grep -q 'occupied window_closed checkout errors stay recoverable' "$test_log" \
    || fail "checkout window compatibility test did not run"
  grep -q 'empty board stays claimable when window_closed is requested' "$test_log" \
    || fail "empty checkout window compatibility test did not run"
  grep -q 'occupied board names rolling eligibility while claims stay open' "$test_log" \
    || fail "occupied rolling eligibility copy test did not run"
  grep -Fq 'rolling last-7-days window is 7 * 24h' "$test_log" \
    || fail "window tests must cover rolling last-7-days window"
  grep -q 'Monday 00:00 UTC does not drop a bid still inside the rolling week' "$test_log" \
    || fail "window tests must keep a Sunday pay across Monday midnight"
  grep -q 'live board keeps a Sunday pay across Monday 00:00 UTC' "$test_log" \
    || fail "rank tests must keep Sunday pay on the live board across Monday"
  grep -q 'only the rolling last 7 days is ranked on the live board' "$test_log" \
    || fail "rank tests must cover the rolling last-7-days live board"
  grep -q 'poster form POST' "$test_log" \
    || fail "poster Waffo checkout form test did not run"
  grep -q 'never trusts query alone' "$test_log" \
    || fail "checkout return page test did not run"
fi

echo "OK: buildable and testable"
