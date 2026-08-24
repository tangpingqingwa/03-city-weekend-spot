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
grep -q 'data-unpaid-off-board' src/app/\[city\]/bid-form.tsx \
  || fail "claim form must stamp unpaid checkout never ranks"
grep -q 'Unpaid checkout never ranks' src/app/\[city\]/bid-form.tsx \
  || fail "claim form must say unpaid checkout never ranks"
grep -q 'stays off the board' src/app/\[city\]/bid-form.tsx \
  || fail "claim form must say unpaid stays off the board"
if grep -qE 'data-list-after-book-nine|data-book-after-list-eight' src/app/\[city\]/bid-form.tsx; then
  fail "unpaid-off-board must not add another numbered hop stamp"
fi
grep -q 'data-unpaid-off-board' src/app/board.css \
  || fail "poster CSS must make unpaid-off-board certain on the claim form"
grep -q 'data-empty-board' src/app/\[city\]/board.tsx || fail "board must have an honest empty state"
grep -q 'unpublished' src/app/\[city\]/board.tsx || fail "empty board must read like an unpublished weekend"
grep -q 'empty-answer' src/app/\[city\]/board.tsx || fail "empty board must print No #1 as the weekend answer"
grep -q 'empty-note' src/app/\[city\]/board.tsx || fail "unpublished must sit under No #1, not above it"
grep -q 'data-empty-unpublished' src/app/\[city\]/board.tsx \
  || fail "empty board must stamp unpublished so occupied chrome stays off"
grep -q 'data-occupied' src/app/\[city\]/board.tsx \
  || fail "board must mark occupied vs empty so occupied chrome cannot leak"
if grep -q 'empty-kicker' src/app/\[city\]/board.tsx; then
  fail "empty board must not keep unpublished as the large kicker"
fi
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -qE 'prize-before-price|data-prize|later-fact|later-facts|book-one-first|data-book-number-one|guest-first|unpaid-off-board'; then
  fail "empty board must not stamp prize venue, later-fact \$bid, Book #1, or unpaid note"
fi
if grep -qE 'data-list-after-book-nine|data-book-after-list-eight' src/app/\[city\]/board.tsx src/app/\[city\]/bid-form.tsx src/app/board.css; then
  fail "empty unpublished must not stamp *-after-*-N"
fi
grep -q 'data-empty-unpublished' src/app/board.css \
  || fail "poster CSS must keep occupied chrome off the unpublished weekend"
grep -q 'data-occupied="false"' src/app/board.css \
  || fail "poster CSS must keep occupied chrome off empty /nyc"
grep -q 'city-name' src/app/\[city\]/board.tsx || fail "city name must be the masthead"
grep -q 'className="place"' src/app/\[city\]/board.tsx || fail "venue card must read as a place"
grep -q 'data-kind' src/app/\[city\]/board.tsx || fail "place card must show kind"
grep -q 'className="pitch"' src/app/\[city\]/board.tsx || fail "place card must show pitch"
grep -q 'Book' src/app/\[city\]/board.tsx || fail "place card must keep the Book CTA"
grep -q 'data-weekend-answer' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must be the weekend answer"
grep -q 'data-prize-before-price' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must put the venue prize before \$bid"
grep -q 'data-prize=' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must mark the venue as the prize"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'prize-before-price'; then
  fail "empty board must not stamp prize before price"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'prize-before-price'; then
  fail "later ranks must not stamp prize before price"
fi
if grep -qE 'data-list-after-book-nine|data-book-after-list-eight' src/app/\[city\]/board.tsx; then
  fail "prize before price must not add another numbered hop stamp"
fi
grep -q 'className="later-facts"' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must group \$bid as a later-fact, not a leftover paragraph"
grep -q 'data-later-fact' src/app/\[city\]/board.tsx \
  || fail "occupied #1 must stamp the later-fact money group"
if grep -qE 'className="bid later-fact"|className="clicks later-fact"' src/app/\[city\]/board.tsx; then
  fail "occupied #1 must not mute \$bid on the same node (stamp-only later-fact)"
fi
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -qE 'data-later-fact|later-facts|bid later-fact'; then
  fail "empty board must not stamp later-fact \$bid"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -qE 'data-later-fact|later-facts|bid later-fact'; then
  fail "later ranks must not stamp later-fact \$bid"
fi
if grep -qE 'data-list-after-book-nine|data-book-after-list-eight' src/app/\[city\]/board.tsx; then
  fail "later-fact \$bid must not add another numbered hop stamp"
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
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'book-one-first'; then
  fail "later ranks must not stamp Book #1 as the first hop"
fi
grep -q 'data-guest-first' src/app/\[city\]/board.tsx \
  || fail "occupied Book #1 must stay the first guest click"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'guest-first'; then
  fail "empty board must not stamp guest-first Book #1"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'guest-first'; then
  fail "later ranks must not stamp guest-first Book #1"
fi
if grep -n 'data-list-venue' -A 20 src/app/\[city\]/board.tsx | grep -q 'guest-first'; then
  fail "List a venue must not steal the first guest click"
fi
if grep -n 'className="book-after-list"' -A 8 src/app/\[city\]/board.tsx | grep -q 'guest-first'; then
  fail "masthead Book after list must not steal the first guest click"
fi
if grep -n 'className="book-later"' -A 4 src/app/\[city\]/board.tsx | grep -q 'guestFirst\|guest-first'; then
  fail "later-rank Book must not steal the first guest click"
fi
if grep -qE 'data-list-after-book-nine|data-book-after-list-eight' src/app/\[city\]/board.tsx; then
  fail "guest-first Book #1 must not stamp *-after-*-N"
fi
grep -q 'data-later-book' src/app/\[city\]/board.tsx \
  || fail "later ranks must stamp Book as a later hop"
grep -q 'data-book-later' src/app/\[city\]/board.tsx \
  || fail "later ranks must expose a Book hop"
grep -q 'book-later' src/app/\[city\]/board.tsx \
  || fail "later-rank Book must use the later booking class"
grep -q 'data-later-quiet' src/app/\[city\]/board.tsx \
  || fail "later ranks must stay quieter than occupied #1 venue"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'later-quiet'; then
  fail "empty board must not stamp later-rank quiet"
fi
if grep -n 'data-prize-before-price' -A 30 src/app/\[city\]/board.tsx | grep -q 'later-quiet'; then
  fail "occupied #1 prize must not stamp later-rank quiet"
fi
if grep -qE 'data-list-after-book-nine|data-book-after-list-eight' src/app/\[city\]/board.tsx src/app/board.css; then
  fail "later-rank quiet must not stamp *-after-*-N"
fi
python3 - src/app/\[city\]/board.tsx <<'PY' || fail "later Book must recede into the place-foot, not stay a sibling CTA"
import re
import sys

src = open(sys.argv[1], encoding="utf-8").read()
match = re.search(
    r"export function ListingCard\([\s\S]*?\nexport function ",
    src,
)
if not match:
    raise SystemExit("ListingCard missing")
body = match.group(0)
later = body.split("rank === 1", 1)[-1]
if "className=\"book-later\"" not in later:
    raise SystemExit("later Book hop missing")
if "className=\"place-foot\"" not in later:
    raise SystemExit("later place-foot missing")
if "BookingHop" not in later.split("place-foot", 1)[-1]:
    raise SystemExit("later Book must sit in the place-foot")
if later.split("place-foot", 1)[0].count("BookingHop"):
    raise SystemExit("later Book is still a sibling CTA before the foot")
if 'className="bid later-fact"' in later or "later-facts" in later:
    raise SystemExit("later ranks must not reuse occupied later-facts grouping")
if "data-guest-first" in later or "guestFirst" in later:
    raise SystemExit("later Book must not steal guest-first")
if "data-prize" in later or "prize-before-price" in later:
    raise SystemExit("later ranks must not stamp the venue prize")
PY
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
grep -q 'data-list-after-book-three' src/app/\[city\]/board.tsx \
  || fail "occupied List a venue must stamp after Book #1 is re-concentrated again"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'list-after-book-three'; then
  fail "empty board must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'list-after-book-three'; then
  fail "later ranks must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-list-after-book=""' -B 6 -A 2 src/app/\[city\]/board.tsx | grep -q 'list-after-book-three'; then
  fail "list-after-later-Books must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-list-after-book-hop=""' -B 6 -A 4 src/app/\[city\]/board.tsx | grep -q 'list-after-book-three'; then
  fail "list-after-book-hop must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-three'; then
  fail "book-after-list leftover must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-hop=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-three'; then
  fail "book-after-list-hop leftover must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-three'; then
  fail "Book after List a venue must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-two' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-three'; then
  fail "Book after List a venue is re-concentrated must not stamp List after Book #1 is re-concentrated again"
fi
grep -q 'data-list-after-book-four' src/app/\[city\]/board.tsx \
  || fail "occupied List a venue must stamp after the louder Book #1"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'list-after-book-four'; then
  fail "empty board must not stamp List after the louder Book #1"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'list-after-book-four'; then
  fail "later ranks must not stamp List after the louder Book #1"
fi
if grep -n 'data-list-after-book=""' -B 6 -A 2 src/app/\[city\]/board.tsx | grep -q 'list-after-book-four'; then
  fail "list-after-later-Books must not stamp List after the louder Book #1"
fi
if grep -n 'data-list-after-book-hop=""' -B 6 -A 4 src/app/\[city\]/board.tsx | grep -q 'list-after-book-four'; then
  fail "list-after-book-hop must not stamp List after the louder Book #1"
fi
if grep -n 'data-book-after-list=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-four'; then
  fail "book-after-list leftover must not stamp List after the louder Book #1"
fi
if grep -n 'data-book-after-list-hop=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-four'; then
  fail "book-after-list-hop leftover must not stamp List after the louder Book #1"
fi
if grep -n 'data-book-after-list-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-four'; then
  fail "Book after List a venue must not stamp List after the louder Book #1"
fi
if grep -n 'data-book-after-list-two' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-four'; then
  fail "Book after List a venue is re-concentrated must not stamp List after the louder Book #1"
fi
if grep -n 'data-book-after-list-three' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-four'; then
  fail "Book after List a venue is re-concentrated again must not stamp List after the louder Book #1"
fi
grep -q 'data-list-after-book-five' src/app/\[city\]/board.tsx \
  || fail "occupied List a venue must stamp after the louder Book #1 is re-concentrated again"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'list-after-book-five'; then
  fail "empty board must not stamp List after the louder Book #1 is re-concentrated again"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'list-after-book-five'; then
  fail "later ranks must not stamp List after the louder Book #1 is re-concentrated again"
fi
if grep -n 'data-list-after-book=""' -B 6 -A 2 src/app/\[city\]/board.tsx | grep -q 'list-after-book-five'; then
  fail "list-after-later-Books must not stamp List after the louder Book #1 is re-concentrated again"
fi
if grep -n 'data-list-after-book-hop=""' -B 6 -A 4 src/app/\[city\]/board.tsx | grep -q 'list-after-book-five'; then
  fail "list-after-book-hop must not stamp List after the louder Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-five'; then
  fail "book-after-list leftover must not stamp List after the louder Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-hop=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-five'; then
  fail "book-after-list-hop leftover must not stamp List after the louder Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-five'; then
  fail "Book after List a venue must not stamp List after the louder Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-two' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-five'; then
  fail "Book after List a venue is re-concentrated must not stamp List after the louder Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-three' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-five'; then
  fail "Book after List a venue is re-concentrated again must not stamp List after the louder Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-four' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-five'; then
  fail "Book after the louder List a venue must not stamp List after the louder Book #1 is re-concentrated again"
fi
grep -q 'data-list-after-book-six' src/app/\[city\]/board.tsx \
  || fail "occupied List a venue must stamp after Book #1 is re-concentrated again without another List"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'list-after-book-six'; then
  fail "empty board must not stamp List after Book #1 is re-concentrated again without another List"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'list-after-book-six'; then
  fail "later ranks must not stamp List after Book #1 is re-concentrated again without another List"
fi
if grep -n 'data-list-after-book=""' -B 6 -A 2 src/app/\[city\]/board.tsx | grep -q 'list-after-book-six'; then
  fail "list-after-later-Books must not stamp List after Book #1 is re-concentrated again without another List"
fi
if grep -n 'data-list-after-book-hop=""' -B 6 -A 4 src/app/\[city\]/board.tsx | grep -q 'list-after-book-six'; then
  fail "list-after-book-hop must not stamp List after Book #1 is re-concentrated again without another List"
fi
if grep -n 'data-book-after-list=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-six'; then
  fail "book-after-list leftover must not stamp List after Book #1 is re-concentrated again without another List"
fi
if grep -n 'data-book-after-list-hop=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-six'; then
  fail "book-after-list-hop leftover must not stamp List after Book #1 is re-concentrated again without another List"
fi
if grep -n 'data-book-after-list-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-six'; then
  fail "Book after List a venue must not stamp List after Book #1 is re-concentrated again without another List"
fi
if grep -n 'data-book-after-list-two' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-six'; then
  fail "Book after List a venue is re-concentrated must not stamp List after Book #1 is re-concentrated again without another List"
fi
if grep -n 'data-book-after-list-three' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-six'; then
  fail "Book after List a venue is re-concentrated again must not stamp List after Book #1 is re-concentrated again without another List"
fi
if grep -n 'data-book-after-list-four' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-six'; then
  fail "Book after the louder List a venue must not stamp List after Book #1 is re-concentrated again without another List"
fi
if grep -n 'data-book-after-list-five' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-six'; then
  fail "Book after the louder List a venue is re-concentrated again must not stamp List after Book #1 is re-concentrated again without another List"
fi
grep -q 'data-list-after-book-seven' src/app/\[city\]/board.tsx \
  || fail "occupied List a venue must stamp after Book #1 is re-concentrated again"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'list-after-book-seven'; then
  fail "empty board must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'list-after-book-seven'; then
  fail "later ranks must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-list-after-book=""' -B 6 -A 2 src/app/\[city\]/board.tsx | grep -q 'list-after-book-seven'; then
  fail "list-after-later-Books must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-list-after-book-hop=""' -B 6 -A 4 src/app/\[city\]/board.tsx | grep -q 'list-after-book-seven'; then
  fail "list-after-book-hop must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-seven'; then
  fail "book-after-list leftover must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-hop=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-seven'; then
  fail "book-after-list-hop leftover must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-seven'; then
  fail "Book after List a venue must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-two' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-seven'; then
  fail "Book after List a venue is re-concentrated must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-three' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-seven'; then
  fail "Book after List a venue is re-concentrated again must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-four' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-seven'; then
  fail "Book after the louder List a venue must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-five' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-seven'; then
  fail "Book after the louder List a venue is re-concentrated again must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-six' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-seven'; then
  fail "Book after List a venue is re-concentrated again without another Book hop must not stamp List after Book #1 is re-concentrated again"
fi
grep -q 'data-list-after-book-eight' src/app/\[city\]/board.tsx \
  || fail "occupied List a venue must stamp after Book #1 is re-concentrated again"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "empty board must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "later ranks must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-list-after-book=""' -B 6 -A 2 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "list-after-later-Books must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-list-after-book-hop=""' -B 6 -A 4 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "list-after-book-hop must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "book-after-list leftover must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-hop=""' -B 6 -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "book-after-list-hop leftover must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "Book after List a venue must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-two' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "Book after List a venue is re-concentrated must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-three' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "Book after List a venue is re-concentrated again must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-four' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "Book after the louder List a venue must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-five' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "Book after the louder List a venue is re-concentrated again must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-six' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "Book after List a venue is re-concentrated again without another Book hop must not stamp List after Book #1 is re-concentrated again"
fi
if grep -n 'data-book-after-list-seven' -A 8 src/app/\[city\]/board.tsx | grep -q 'list-after-book-eight'; then
  fail "Book after List a venue is re-concentrated again without a second Book hop must not stamp List after Book #1 is re-concentrated again"
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
grep -q 'data-book-after-list-two' src/app/\[city\]/board.tsx \
  || fail "occupied Book #1 must stamp after List a venue is re-concentrated"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'book-after-list-two'; then
  fail "empty board must not stamp Book after List a venue is re-concentrated"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'book-after-list-two'; then
  fail "later ranks must not stamp Book after List a venue is re-concentrated"
fi
if grep -n 'className="book-after-list"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListTwo\|book-after-list-two'; then
  fail "book-after-list leftover must not stamp Book after List a venue is re-concentrated"
fi
if grep -n 'className="book-after-list-hop"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListTwo\|book-after-list-two'; then
  fail "book-after-list-hop leftover must not stamp Book after List a venue is re-concentrated"
fi
if grep -n 'data-list-after-book-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListTwo\|book-after-list-two'; then
  fail "List after Book #1 must not stamp Book after List a venue is re-concentrated"
fi
if grep -n 'data-list-after-book-two' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListTwo\|book-after-list-two'; then
  fail "List after Book #1 is re-concentrated must not stamp Book after List a venue is re-concentrated"
fi
grep -q 'data-book-after-list-three' src/app/\[city\]/board.tsx \
  || fail "occupied Book #1 must stamp after List a venue is re-concentrated again"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'book-after-list-three'; then
  fail "empty board must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'book-after-list-three'; then
  fail "later ranks must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'className="book-after-list"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListThree\|book-after-list-three'; then
  fail "book-after-list leftover must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'className="book-after-list-hop"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListThree\|book-after-list-three'; then
  fail "book-after-list-hop leftover must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListThree\|book-after-list-three'; then
  fail "List after Book #1 must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-two' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListThree\|book-after-list-three'; then
  fail "List after Book #1 is re-concentrated must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-three' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListThree\|book-after-list-three'; then
  fail "List after Book #1 is re-concentrated again must not stamp Book after List a venue is re-concentrated again"
fi
grep -q 'data-book-after-list-four' src/app/\[city\]/board.tsx \
  || fail "occupied Book #1 must stamp after the louder List a venue"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'book-after-list-four'; then
  fail "empty board must not stamp Book after the louder List a venue"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'book-after-list-four'; then
  fail "later ranks must not stamp Book after the louder List a venue"
fi
if grep -n 'className="book-after-list"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListFour\|book-after-list-four'; then
  fail "book-after-list leftover must not stamp Book after the louder List a venue"
fi
if grep -n 'className="book-after-list-hop"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListFour\|book-after-list-four'; then
  fail "book-after-list-hop leftover must not stamp Book after the louder List a venue"
fi
if grep -n 'data-list-after-book-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListFour\|book-after-list-four'; then
  fail "List after Book #1 must not stamp Book after the louder List a venue"
fi
if grep -n 'data-list-after-book-two' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListFour\|book-after-list-four'; then
  fail "List after Book #1 is re-concentrated must not stamp Book after the louder List a venue"
fi
if grep -n 'data-list-after-book-three' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListFour\|book-after-list-four'; then
  fail "List after Book #1 is re-concentrated again must not stamp Book after the louder List a venue"
fi
if grep -n 'data-list-after-book-four' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListFour\|book-after-list-four'; then
  fail "List after the louder Book #1 must not stamp Book after the louder List a venue"
fi
grep -q 'data-book-after-list-five' src/app/\[city\]/board.tsx \
  || fail "occupied Book #1 must stamp after the louder List a venue is re-concentrated again"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'book-after-list-five'; then
  fail "empty board must not stamp Book after the louder List a venue is re-concentrated again"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'book-after-list-five'; then
  fail "later ranks must not stamp Book after the louder List a venue is re-concentrated again"
fi
if grep -n 'className="book-after-list"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListFive\|book-after-list-five'; then
  fail "book-after-list leftover must not stamp Book after the louder List a venue is re-concentrated again"
fi
if grep -n 'className="book-after-list-hop"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListFive\|book-after-list-five'; then
  fail "book-after-list-hop leftover must not stamp Book after the louder List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListFive\|book-after-list-five'; then
  fail "List after Book #1 must not stamp Book after the louder List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-two' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListFive\|book-after-list-five'; then
  fail "List after Book #1 is re-concentrated must not stamp Book after the louder List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-three' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListFive\|book-after-list-five'; then
  fail "List after Book #1 is re-concentrated again must not stamp Book after the louder List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-four' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListFive\|book-after-list-five'; then
  fail "List after the louder Book #1 must not stamp Book after the louder List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-five' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListFive\|book-after-list-five'; then
  fail "List after the louder Book #1 is re-concentrated again must not stamp Book after the louder List a venue is re-concentrated again"
fi
grep -q 'data-book-after-list-six' src/app/\[city\]/board.tsx \
  || fail "occupied Book #1 must stamp after List a venue is re-concentrated again"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'book-after-list-six'; then
  fail "empty board must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'book-after-list-six'; then
  fail "later ranks must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'className="book-after-list"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListSix\|book-after-list-six'; then
  fail "book-after-list leftover must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'className="book-after-list-hop"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListSix\|book-after-list-six'; then
  fail "book-after-list-hop leftover must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSix\|book-after-list-six'; then
  fail "List after Book #1 must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-two' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSix\|book-after-list-six'; then
  fail "List after Book #1 is re-concentrated must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-three' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSix\|book-after-list-six'; then
  fail "List after Book #1 is re-concentrated again must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-four' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSix\|book-after-list-six'; then
  fail "List after the louder Book #1 must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-five' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSix\|book-after-list-six'; then
  fail "List after the louder Book #1 is re-concentrated again must not stamp Book after List a venue is re-concentrated again"
fi
if grep -n 'data-list-after-book-six' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSix\|book-after-list-six'; then
  fail "List after Book #1 is re-concentrated again without another List must not stamp Book after List a venue is re-concentrated again"
fi
grep -q 'data-book-after-list-seven' src/app/\[city\]/board.tsx \
  || fail "occupied Book #1 must stamp after List a venue is re-concentrated again without a second Book hop"
if grep -n 'data-empty-board' -A 20 src/app/\[city\]/board.tsx | grep -q 'book-after-list-seven'; then
  fail "empty board must not stamp Book after List a venue is re-concentrated again without a second Book hop"
fi
if grep -n 'data-later-book' -A 30 src/app/\[city\]/board.tsx | grep -q 'book-after-list-seven'; then
  fail "later ranks must not stamp Book after List a venue is re-concentrated again without a second Book hop"
fi
if grep -n 'className="book-after-list"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListSeven\|book-after-list-seven'; then
  fail "book-after-list leftover must not stamp Book after List a venue is re-concentrated again without a second Book hop"
fi
if grep -n 'className="book-after-list-hop"' -A 6 src/app/\[city\]/board.tsx | grep -q 'afterListSeven\|book-after-list-seven'; then
  fail "book-after-list-hop leftover must not stamp Book after List a venue is re-concentrated again without a second Book hop"
fi
if grep -n 'data-list-after-book-one' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSeven\|book-after-list-seven'; then
  fail "List after Book #1 must not stamp Book after List a venue is re-concentrated again without a second Book hop"
fi
if grep -n 'data-list-after-book-two' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSeven\|book-after-list-seven'; then
  fail "List after Book #1 is re-concentrated must not stamp Book after List a venue is re-concentrated again without a second Book hop"
fi
if grep -n 'data-list-after-book-three' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSeven\|book-after-list-seven'; then
  fail "List after Book #1 is re-concentrated again must not stamp Book after List a venue is re-concentrated again without a second Book hop"
fi
if grep -n 'data-list-after-book-four' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSeven\|book-after-list-seven'; then
  fail "List after the louder Book #1 must not stamp Book after List a venue is re-concentrated again without a second Book hop"
fi
if grep -n 'data-list-after-book-five' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSeven\|book-after-list-seven'; then
  fail "List after the louder Book #1 is re-concentrated again must not stamp Book after List a venue is re-concentrated again without a second Book hop"
fi
if grep -n 'data-list-after-book-six' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSeven\|book-after-list-seven'; then
  fail "List after Book #1 is re-concentrated again without another List must not stamp Book after List a venue is re-concentrated again without a second Book hop"
fi
if grep -n 'data-list-after-book-seven' -A 8 src/app/\[city\]/board.tsx | grep -q 'afterListSeven\|book-after-list-seven'; then
  fail "List after Book #1 is re-concentrated again without another List hop must not stamp Book after List a venue is re-concentrated again without a second Book hop"
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
grep -q 'data-list-after-book-three' src/app/board.css \
  || fail "poster CSS must concentrate List after Book #1 is re-concentrated again"
grep -q 'data-list-after-book-four' src/app/board.css \
  || fail "poster CSS must concentrate List after the louder Book #1"
grep -q 'data-list-after-book-five' src/app/board.css \
  || fail "poster CSS must concentrate List after the louder Book #1 is re-concentrated again"
grep -q 'data-list-after-book-six' src/app/board.css \
  || fail "poster CSS must concentrate List after Book #1 is re-concentrated again without another List"
grep -q 'data-list-after-book-seven' src/app/board.css \
  || fail "poster CSS must concentrate List after Book #1 is re-concentrated again"
grep -q 'data-list-after-book-eight' src/app/board.css \
  || fail "poster CSS must concentrate List after Book #1 is re-concentrated again"
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
if ! grep -n 'book-one\[data-book-after-list-seven\]\[data-guest-first\]' -A 16 src/app/board.css | grep -q '4.35rem'; then
  fail "poster CSS must keep guest-first Book #1 larger than leftover hops"
fi
if ! grep -n 'list-venue\[data-list-after-book-eight\]' -A 18 src/app/board.css | grep -q '6.25rem'; then
  fail "poster CSS must keep leftover List/Book hops quieter than Book #1"
fi
grep -q 'data-book-after-list-one' src/app/board.css \
  || fail "poster CSS must concentrate Book #1 after List a venue"
grep -q 'data-book-after-list-two' src/app/board.css \
  || fail "poster CSS must concentrate Book #1 after List a venue is re-concentrated"
grep -q 'data-book-after-list-three' src/app/board.css \
  || fail "poster CSS must concentrate Book #1 after List a venue is re-concentrated again"
grep -q 'data-book-after-list-four' src/app/board.css \
  || fail "poster CSS must concentrate Book #1 after the louder List a venue"
grep -q 'data-book-after-list-five' src/app/board.css \
  || fail "poster CSS must concentrate Book #1 after the louder List a venue is re-concentrated again"
grep -q 'data-book-after-list-six' src/app/board.css \
  || fail "poster CSS must concentrate Book #1 after List a venue is re-concentrated again"
grep -q 'data-book-after-list-seven' src/app/board.css \
  || fail "poster CSS must concentrate Book #1 after List a venue is re-concentrated again without a second Book hop"
grep -q 'book-later' src/app/board.css \
  || fail "poster CSS must style later-rank Book"
grep -q 'data-later-book' src/app/board.css \
  || fail "poster CSS must style later-rank places"
grep -q 'data-later-quiet' src/app/board.css \
  || fail "poster CSS must keep later ranks quieter than occupied #1 venue"
if ! grep -n 'data-later-quiet' -A 8 src/app/board.css | grep -q '1.02rem'; then
  fail "poster CSS must keep later-rank venue quieter than occupied #1"
fi
if ! grep -n 'place-foot .book-later' -A 24 src/app/board.css | grep -q 'display: inline'; then
  fail "poster CSS must keep later Book an inline foot hop"
fi
python3 - src/app/board.css <<'PY' || fail "later-rank venue and Book must stay quieter than occupied #1"
import re
import sys

css = open(sys.argv[1], encoding="utf-8").read()

def first(pattern):
    match = re.search(pattern, css, re.S)
    if not match:
        raise SystemExit(1)
    return match.group(1)

prize = first(r"clamp\(([\d.]+)rem, 9vw, 4\.4rem\)")
later_title = first(r"\[data-later-quiet\] \.title\s*\{[^}]*font-size:\s*([\d.]+)rem")
later_book_block = re.search(
    r"\.place\[data-later-book\] \.place-foot \.book-later\s*\{([^}]*)\}",
    css,
    re.S,
)
if not later_book_block:
    raise SystemExit("later Book foot hop CSS missing")
later_book_css = later_book_block.group(1)
later_book_size = re.search(r"font-size:\s*([\d.]+)rem", later_book_css)
book_one = first(r"\.book-one\[data-book-after-list-seven\]\s*\{[^}]*min-height:\s*([\d.]+)rem")
if float(later_title) >= float(prize):
    raise SystemExit("later venue shouts like occupied #1")
if not later_book_size:
    raise SystemExit("later Book must recede in size")
if float(later_book_size.group(1)) >= float(book_one):
    raise SystemExit("later Book fill shouts like occupied #1")
if "display: inline" not in later_book_css:
    raise SystemExit("later Book must be an inline hop, not a button row")
if "min-width: 0" not in later_book_css:
    raise SystemExit("later Book must drop the filled min-width")
if "border: 0" not in later_book_css:
    raise SystemExit("later Book must drop the filled border")
if "var(--accent)" in later_book_css:
    raise SystemExit("do not recolor later Book")
if "background: transparent" not in later_book_css:
    raise SystemExit("later Book must stay unfilled")
if re.search(
    r"\.number-one\[data-prize-before-price\] \.bid\.later-fact\[data-later-fact\]\s*\{",
    css,
):
    raise SystemExit("stamp-only later-fact mute on the same $bid node")
later_facts = re.search(
    r"\.number-one \.later-facts\[data-later-fact\]\s*\{([^}]*)\}",
    css,
    re.S,
)
if not later_facts:
    raise SystemExit("occupied #1 later-facts group CSS missing")
if "color: var(--accent)" in later_facts.group(1):
    raise SystemExit("occupied #1 later-fact money must not shout accent")
group_size = re.search(r"font-size:\s*([\d.]+)rem", later_facts.group(1))
if not group_size:
    raise SystemExit("occupied #1 later-facts group must recede in size")
if float(group_size.group(1)) >= float(prize):
    raise SystemExit("occupied #1 later-fact money shouts like the venue")
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
  grep -q 'empty NYC weekend stays unpublished without occupied chrome' "$test_log" \
    || fail "empty unpublished occupied-chrome test did not run"
  grep -q 'kind, \$bid, clicks, and Book' "$test_log" \
    || fail "place-card test did not run"
  grep -q 'books the paid #1 as the weekend answer' "$test_log" \
    || fail "occupied #1 booking test did not run"
  grep -q 'List a venue hop to the claim form' "$test_log" \
    || fail "occupied List a venue hop test did not run"
  grep -q 'later ranks stamp Book as the certain hop' "$test_log" \
    || fail "occupied later-rank Book test did not run"
  grep -q 'later ranks stay quieter than occupied #1 venue' "$test_log" \
    || fail "occupied later-rank quiet test did not run"
  grep -q 'later Book stays quieter than Book #1 after \$bid is a later fact' "$test_log" \
    || fail "occupied later-Book quieter-than-Book-#1 test did not run"
  grep -q 'occupied Book #1 stays the first guest click' "$test_log" \
    || fail "occupied Book #1 first guest click test did not run"
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
  grep -q 'books #1 after List a venue is re-concentrated without another Book' "$test_log" \
    || fail "occupied Book #1 after List a venue re-concentrate test did not run"
  grep -q 'lists after Book #1 is re-concentrated again without another Book' "$test_log" \
    || fail "occupied List after Book #1 re-concentrate-again test did not run"
  grep -q 'books #1 after List a venue is re-concentrated again without another Book' "$test_log" \
    || fail "occupied Book #1 after List a venue re-concentrate-again test did not run"
  grep -q 'lists after the louder Book #1 without another Book' "$test_log" \
    || fail "occupied List after the louder Book #1 test did not run"
  grep -q 'lists after the louder Book #1 is re-concentrated again without another Book' "$test_log" \
    || fail "occupied List after the louder Book #1 re-concentrate-again test did not run"
  grep -q 'lists after Book #1 is re-concentrated again without another List' "$test_log" \
    || fail "occupied List after Book #1 is re-concentrated again without another List test did not run"
  grep -q 'lists after Book #1 is re-concentrated again without another List hop' "$test_log" \
    || fail "occupied List after Book #1 is re-concentrated again without another List hop test did not run"
  grep -q 'lists after Book #1 is re-concentrated again without a second List hop' "$test_log" \
    || fail "occupied List after Book #1 is re-concentrated again without a second List hop test did not run"
  grep -q 'books #1 after the louder List a venue without another Book' "$test_log" \
    || fail "occupied Book #1 after the louder List a venue test did not run"
  grep -q 'books #1 after the louder List a venue is re-concentrated again without another Book' "$test_log" \
    || fail "occupied Book #1 after the louder List a venue re-concentrate-again test did not run"
  grep -q 'books #1 after List a venue is re-concentrated again without another Book hop' "$test_log" \
    || fail "occupied Book #1 after List a venue is re-concentrated again without another Book hop test did not run"
  grep -q 'books #1 after List a venue is re-concentrated again without a second Book hop' "$test_log" \
    || fail "occupied Book #1 after List a venue is re-concentrated again without a second Book hop test did not run"
  grep -q 'prize before price' "$test_log" \
    || fail "occupied prize-before-price test did not run"
  grep -q 'occupied NYC #1 \$bid sits in a later-fact group' "$test_log" \
    || fail "occupied later-fact \$bid group test did not run"
  grep -q 'unpaid checkout never ranks certain' "$test_log" \
    || fail "claim-form unpaid-off-board test did not run"
  grep -q 'poster form POST' "$test_log" \
    || fail "poster Polar checkout form test did not run"
  grep -q 'never trusts query alone' "$test_log" \
    || fail "checkout return page test did not run"
fi

echo "OK: buildable and testable"
