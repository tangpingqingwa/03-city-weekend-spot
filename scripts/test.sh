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
if grep -RInE 'https?://([^/]*\.)?polar\.sh' src tests >/dev/null 2>&1; then
  fail "src/tests must not hard-code polar.sh HTTP"
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
grep -q 'data-empty-board' src/app/\[city\]/board.tsx || fail "board must have an honest empty state"
grep -q 'data-bid' src/app/\[city\]/board.tsx || fail "cards must show the bid amount"
grep -q 'data-clicks' src/app/\[city\]/board.tsx || fail "cards must show public clicks"
grep -q 'board.css' src/app/layout.tsx || fail "root layout must load board styles"
if grep -RInEi '★|star rating|4\.8 stars|review count' src/app src/core >/dev/null; then
  fail "board UI must not render stars or review chrome"
fi
if grep -RInE 'createCheckout|POLAR_LIVE|polar\.sh' src/app src/core >/dev/null 2>&1; then
  fail "PR 2 board UI must not wire Polar checkout"
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
  fail "PR 3 must not wire Polar checkout"
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

  unset POLAR_LIVE POLAR_ACCESS_TOKEN POLAR_WEBHOOK_SECRET
  export POLAR_FIXTURE_ONLY=1
  [[ "${POLAR_LIVE:-}" != "1" ]] || fail "POLAR_LIVE must stay unset in test.sh"

  echo "== tsc --noEmit =="
  npx tsc --noEmit

  echo "== unit tests =="
  test_log="$(mktemp)"
  trap 'rm -f "$test_log"' EXIT
  set +e
  npx tsx --test --test-reporter spec 'tests/**/*.test.ts' | tee "$test_log"
  test_status=${PIPESTATUS[0]}
  set -e
  [[ $test_status -eq 0 ]] || fail "unit tests failed"
  grep -Eq 'tests[[:space:]]+[1-9][0-9]*' "$test_log" \
    || fail "test runner reported 0 tests"
fi

echo "OK: buildable and testable"
