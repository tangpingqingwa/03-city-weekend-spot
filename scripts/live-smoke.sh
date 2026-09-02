#!/usr/bin/env bash
# Operator smoke against a local process. Not called from scripts/test.sh or CI.
# Walks the Waffo-owned route surface against an offline fixture process:
# NYC board, about/rules, checkout, completion status, click, retired Polar,
# and unknown city. No provider credentials or network calls are accepted.
# Fixture listing is allowed only so click can exercise the public redirect.
# Do not invent a paid rank.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

if [[ -n "${LIVE_SMOKE_BASE:-}" ]]; then
  fail "LIVE_SMOKE_BASE is unsupported; live-smoke always spawns an isolated fixture"
fi

if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  fail "live-smoke must not run in GitHub Actions"
fi
if [[ "${CI:-}" == "true" && "${LIVE_SMOKE_ALLOW_CI:-}" != "1" ]]; then
  fail "live-smoke refuses CI=true"
fi

command -v curl >/dev/null || fail "curl is required"
command -v node >/dev/null || fail "node is required"

if [[ ! -d node_modules ]]; then
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
fi

PASS=0
PASS_ERROR=0
BLOCKED=0
FAIL=0
STARTED_PID=""
WORKDIR=""
RESULT_LOG=""
BASE=""

kill_tree() {
  local pid="${1:-}"
  [[ -n "$pid" ]] || return 0
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

cleanup() {
  if [[ -n "${STARTED_PID}" ]]; then
    kill_tree "${STARTED_PID}"
    wait "${STARTED_PID}" 2>/dev/null || true
  fi
  if [[ -n "${WORKDIR}" && -d "${WORKDIR}" ]]; then
    rm -rf "${WORKDIR}"
  fi
}
trap cleanup EXIT

record() {
  local flow="$1"
  local status="$2"
  local note="${3:-}"
  printf 'RESULT\t%s\t%s\t%s\n' "$flow" "$status" "$note"
  if [[ -n "${RESULT_LOG}" ]]; then
    printf '%s\t%s\t%s\n' "$flow" "$status" "$note" >>"${RESULT_LOG}"
  fi
  case "$status" in
    PASS) PASS=$((PASS + 1)) ;;
    PASS-ERROR) PASS_ERROR=$((PASS_ERROR + 1)) ;;
    BLOCKED-SECRET) BLOCKED=$((BLOCKED + 1)) ;;
    FAIL) FAIL=$((FAIL + 1)) ;;
    *) fail "unknown smoke status ${status}" ;;
  esac
}

pick_port() {
  node --input-type=module -e '
    import net from "node:net";
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") process.exit(1);
      process.stdout.write(String(addr.port));
      server.close();
    });
  '
}

nyc_window_id() {
  node --import tsx --input-type=module -e '
    import { getCity } from "./src/core/cities.ts";
    import { currentWindow } from "./src/core/window.ts";
    const city = getCity("nyc");
    if (!city) process.exit(2);
    process.stdout.write(currentWindow(city).id);
  '
}

process_alive() {
  local pid="$1"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  local state
  state="$(ps -p "$pid" -o state= 2>/dev/null | tr -d '[:space:]')"
  [[ -n "$state" && "$state" != Z* ]]
}

wait_health() {
  local base="$1"
  local pid="$2"
  local log_path="$3"
  local startup_token="$4"
  local url="$base/healthz"
  local ready_line="live-smoke ready pid=${pid} token=${startup_token}"
  local i
  for i in $(seq 1 80); do
    if ! process_alive "$pid"; then
      return 2
    fi
    if grep -Fq "$ready_line" "$log_path" \
      && curl -fsS --connect-timeout 2 --max-time 5 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.1
  done
  return 1
}

write_smoke_server() {
  local dest="$1"
  cat >"$dest" <<'EOF'
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AboutPage from "../src/app/about/page.tsx";
import { POST as postCheckout } from "../src/app/api/checkout/route.ts";
import { GET as getClick } from "../src/app/api/click/[id]/route.ts";
import { POST as postWaffoWebhook } from "../src/app/api/waffo/webhook/route.ts";
import { POST as postPolarWebhook } from "../src/app/api/polar/webhook/route.ts";
import { CityBoard } from "../src/app/[city]/board.tsx";
import { GET as getHealthz } from "../src/app/healthz/route.ts";
import RulesPage from "../src/app/rules/page.tsx";
import CheckoutCompletePage from "../src/app/checkout/complete/page.tsx";
import { applyPaidEvent } from "../src/billing/port.ts";
import { resolveCity } from "../src/core/cities.ts";
import { getBoardListings } from "../src/core/rank.ts";
import { currentWindow } from "../src/core/window.ts";

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT is required");
}
const origin = process.env.PUBLIC_BASE_URL ?? `http://127.0.0.1:${port}`;
const startupToken = process.env.SMOKE_STARTUP_TOKEN;
if (!startupToken) {
  throw new Error("SMOKE_STARTUP_TOKEN is required");
}
const retiredPaymentVars = [
  "POLAR_LIVE",
  "POLAR_ACCESS_TOKEN",
  "POLAR_WEBHOOK_SECRET",
  "POLAR_API_BASE",
  "POLAR_PRODUCT_ID",
  "POLAR_SUCCESS_URL",
  "POLAR_FIXTURE_ONLY",
] as const;
const inheritedRetiredPaymentVars = retiredPaymentVars.filter((name) => process.env[name] !== undefined);
if (inheritedRetiredPaymentVars.length > 0) {
  throw new Error(`fixture child inherited retired payment vars: ${inheritedRetiredPaymentVars.join(",")}`);
}

function htmlDocument(inner: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>City Weekend Spot</title></head><body><header class="site-header"><nav class="site-nav"><a href="/">Board</a><a href="/about">About</a><a href="/rules">Rules</a></nav></header>${inner}</body></html>`;
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const url = new URL(req.url ?? "/", origin);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  const method = req.method ?? "GET";
  if (method === "GET" || method === "HEAD") {
    return new Request(url, { method, headers });
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new Request(url, { method, headers, body: Buffer.concat(chunks) });
}

async function sendWeb(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

function sendHtml(res: ServerResponse, node: ReactNode, extra = ""): void {
  const body = htmlDocument(`${extra}${renderToStaticMarkup(node)}`);
  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "private, no-store");
  res.end(body);
}

function sendCityUnknown(res: ServerResponse): void {
  const inner =
    '<main class="board" data-city-error="city_unknown"><h1>404</h1><p>city_unknown</p></main>';
  const body = htmlDocument(inner);
  res.statusCode = 404;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "private, no-store");
  res.end(body);
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.statusCode = status;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "private, no-store");
  res.end(JSON.stringify(body));
}

function renderNycBoard(): { node: ReactNode; extra: string } {
  const resolved = resolveCity("nyc");
  if (!resolved.ok) {
    throw new Error("nyc catalog row is required");
  }
  const window = currentWindow(resolved.city);
  const listings = getBoardListings(resolved.city.slug);
  return {
    node: createElement(CityBoard, { city: resolved.city, listings }),
    extra: `<div hidden data-window-id="${window.id}" data-iso-week="${window.isoWeek}"></div>`,
  };
}

const server = createServer((req, res) => {
  void (async () => {
    const request = await toRequest(req);
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET" && path === "/healthz") {
      await sendWeb(res, getHealthz());
      return;
    }
    if (request.method === "GET" && path === "/") {
      res.statusCode = 302;
      res.setHeader("location", "/nyc");
      res.end();
      return;
    }
    if (request.method === "GET" && path === "/about") {
      sendHtml(res, createElement(AboutPage));
      return;
    }
    if (request.method === "GET" && path === "/rules") {
      sendHtml(res, createElement(RulesPage));
      return;
    }
    if (request.method === "GET" && path === "/checkout/complete") {
      const intent = url.searchParams.get("intent") ?? undefined;
      sendHtml(res, await CheckoutCompletePage({ searchParams: Promise.resolve({ intent }) }));
      return;
    }
    if (request.method === "POST" && path === "/api/checkout") {
      await sendWeb(res, await postCheckout(request));
      return;
    }
    if (request.method === "POST" && path === "/api/waffo/webhook") {
      await sendWeb(res, await postWaffoWebhook(request));
      return;
    }
    if ((request.method === "POST" || request.method === "GET") && path === "/api/polar/webhook") {
      await sendWeb(res, await postPolarWebhook(request));
      return;
    }
    const click = path.match(/^\/api\/click\/([^/]+)$/);
    if (request.method === "GET" && click) {
      await sendWeb(
        res,
        await getClick(request, { params: { id: decodeURIComponent(click[1]) } }),
      );
      return;
    }
    if (request.method === "POST" && path === "/__smoke/apply-paid") {
      const raw = (await request.json()) as Record<string, unknown>;
      const resolved = resolveCity("nyc");
      if (!resolved.ok) {
        sendJson(res, 500, { error: "city_unknown" });
        return;
      }
      const window = currentWindow(resolved.city);
      const venueName = typeof raw.venueName === "string" ? raw.venueName : "";
      const bookingUrl = typeof raw.bookingUrl === "string" ? raw.bookingUrl : "";
      const sessionId = typeof raw.sessionId === "string" ? raw.sessionId : `fix_smoke_${Date.now()}`;
      if (!venueName || !bookingUrl) {
        sendJson(res, 400, { error: "listing_invalid" });
        return;
      }
      const listing = applyPaidEvent({
        sessionId,
        listingDraft: {
          city: "nyc",
          windowId: window.id,
          venueName,
          bookingUrl,
          kind: "restaurant",
          pitch: null,
        },
        amountUsd: 5,
        kind: "create",
        paidAt: new Date().toISOString(),
      });
      sendJson(res, 200, { id: listing.id, windowId: listing.windowId });
      return;
    }
    const cityMatch = path.match(/^\/([a-z][a-z0-9-]{1,31})$/);
    if (request.method === "GET" && cityMatch) {
      const slug = cityMatch[1];
      if (slug === "about" || slug === "rules" || slug === "healthz") {
        sendText(res, 404, "not found");
        return;
      }
      const resolved = resolveCity(slug);
      if (!resolved.ok) {
        sendCityUnknown(res);
        return;
      }
      if (slug === "nyc") {
        const board = renderNycBoard();
        sendHtml(res, board.node, board.extra);
        return;
      }
      const listings = getBoardListings(resolved.city.slug);
      sendHtml(res, createElement(CityBoard, { city: resolved.city, listings }));
      return;
    }
    sendText(res, 404, "not found");
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    if (!res.headersSent) sendText(res, 500, message);
    else res.end();
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`live-smoke ready pid=${process.pid} token=${startupToken}\n`);
});
EOF
}

start_smoke_server() {
  local port="$1"
  local log_path="$2"
  local server_path="$3"
  local startup_token="$4"
  (
    cd "$root"
    unset PAYMENT_MODE WAFFO_MODE WAFFO_LIVE WAFFO_API_BASE \
      WAFFO_PUBLIC_BASE_URL PUBLIC_BASE_URL \
      NODE_ENV VERCEL_ENV APP_ENV DEPLOY_ENV BUILD_ENV NEXT_PHASE \
      WAFFO_CHECKOUT_TIMEOUT_MS DATABASE_PATH \
      WAFFO_PRIVATE_KEY WAFFO_PRIVATE_KEY_FILE \
      WAFFO_MERCHANT_ID WAFFO_STORE_ID WAFFO_PRODUCT_ID WAFFO_WEBHOOK_PUBLIC_KEY \
      WAFFO_WEBHOOK_TEST_PUBLIC_KEY WAFFO_WEBHOOK_PROD_PUBLIC_KEY \
      POLAR_LIVE POLAR_ACCESS_TOKEN POLAR_WEBHOOK_SECRET POLAR_API_BASE \
      POLAR_PRODUCT_ID POLAR_SUCCESS_URL POLAR_FIXTURE_ONLY || true
    export PAYMENT_MODE=fixture
    export DATABASE_PATH="${WORKDIR}/smoke.sqlite"
    export PORT="${port}"
    export PUBLIC_BASE_URL="http://127.0.0.1:${port}"
    export SMOKE_STARTUP_TOKEN="${startup_token}"
    exec node --import tsx "${server_path}"
  ) >"${log_path}" 2>&1 &
  echo $!
}

assert_fixture_child() {
  local ready_line="live-smoke ready pid=${STARTED_PID} token=${STARTUP_TOKEN}"
  if ! process_alive "${STARTED_PID}" || ! grep -Fq "$ready_line" "${LOG_PATH}"; then
    fail "fixture child ownership was not proven before request"
  fi
}

http_get() {
  local base="$1"
  local path="$2"
  local out="$3"
  assert_fixture_child
  curl -sS -o "$out" -w "%{http_code}" --connect-timeout 5 --max-time 20 \
    "${base}${path}"
}

http_get_headers() {
  local base="$1"
  local path="$2"
  local body="$3"
  local hdrs="$4"
  assert_fixture_child
  curl -sS -D "$hdrs" -o "$body" -w "%{http_code}" --connect-timeout 5 --max-time 20 \
    --max-redirs 0 \
    "${base}${path}"
}

http_post_json() {
  local base="$1"
  local path="$2"
  local payload="$3"
  local body="$4"
  local hdrs="$5"
  assert_fixture_child
  curl -sS -D "$hdrs" -o "$body" -w "%{http_code}" --connect-timeout 5 --max-time 30 \
    --max-redirs 0 \
    -X POST \
    -H "content-type: application/json" \
    -H "accept: application/json" \
    --data "$payload" \
    "${base}${path}"
}

header_value() {
  local file="$1"
  local name="$2"
  awk -v name="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]')" '
    BEGIN { FS = ": " }
    tolower($1) == name {
      val = $0
      sub(/^[^:]+:[ \t]*/, "", val)
      gsub(/\r/, "", val)
      print val
      exit
    }
  ' "$file"
}

json_field() {
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const raw = readFileSync(process.argv[1], "utf8");
    let data;
    try { data = JSON.parse(raw); } catch { process.exit(2); }
    const key = process.argv[2];
    const value = data == null ? undefined : data[key];
    if (value === undefined || value === null) process.exit(3);
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      process.stdout.write(String(value));
      process.exit(0);
    }
    process.stdout.write(JSON.stringify(value));
  ' "$1" "$2"
}

html_has() {
  local file="$1"
  local pattern="$2"
  grep -Eq "$pattern" "$file"
}

invented_stars() {
  local file="$1"
  grep -Eiq '★|⭐|4\.8 stars|data-stars=|data-rating=|review count|rated 4\.9' "$file"
}

board_rating_ui() {
  local file="$1"
  grep -Eiq '★|⭐|star-rating|rating|4\.8 stars|data-stars=|data-rating=|review count|rated 4\.9' "$file"
}

listing_count() {
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const html = readFileSync(process.argv[1], "utf8");
    process.stdout.write(String([...html.matchAll(/data-listing-id="([^"]+)"/g)].length));
  ' "$1"
}

id_for_venue() {
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const html = readFileSync(process.argv[1], "utf8");
    const venue = process.argv[2];
    const cards = [...html.matchAll(/<(?:article|li)\b[\s\S]*?<\/(?:article|li)>/g)].map((m) => m[0]);
    for (const card of cards) {
      if (card.includes(venue)) {
        const id = card.match(/data-listing-id="([^"]+)"/);
        if (id) {
          process.stdout.write(id[1]);
          process.exit(0);
        }
      }
    }
    process.exit(2);
  ' "$1" "$2"
}

clicks_for_id() {
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const html = readFileSync(process.argv[1], "utf8");
    const id = process.argv[2];
    const cards = [...html.matchAll(/<(?:article|li)\b[\s\S]*?<\/(?:article|li)>/g)].map((m) => m[0]);
    for (const card of cards) {
      if (card.includes(`data-listing-id="${id}"`)) {
        const clicks = card.match(/(\d+) clicks?/);
        if (clicks) {
          process.stdout.write(clicks[1]);
          process.exit(0);
        }
      }
    }
    process.exit(2);
  ' "$1" "$2"
}

PORT_RAW="${LIVE_SMOKE_PORT:-$(pick_port)}"
if [[ ! "$PORT_RAW" =~ ^[0-9]{1,5}$ ]]; then
  fail "LIVE_SMOKE_PORT must be a decimal TCP port from 1 to 65535"
fi
PORT=$((10#$PORT_RAW))
if (( PORT < 1 || PORT > 65535 )); then
  fail "LIVE_SMOKE_PORT must be a decimal TCP port from 1 to 65535"
fi

WORKDIR="$(mktemp -d "${root}/.live-smoke.XXXXXX")"
RESULT_LOG="${WORKDIR}/results.tsv"
: >"${RESULT_LOG}"
STAMP="$(date -u +%Y%m%d%H%M%S)"
STARTUP_TOKEN="smoke-${STAMP}-${PORT}"
WINDOW_ID="$(nyc_window_id)"
VENUE="Smoke Venue ${STAMP}"
STRIPPED_URL="https://book.example.com/smoke-${STAMP}"
TRACKED_URL="${STRIPPED_URL}?utm_source=smoke&fbclid=1"
SERVER_PATH="${WORKDIR}/smoke-server.tsx"
write_smoke_server "$SERVER_PATH"

echo "== live-smoke (operator only; not CI) =="
echo "root=${root}"
echo "windowId=${WINDOW_ID}"

BASE="http://127.0.0.1:${PORT}"
LOG_PATH="${WORKDIR}/server.log"
echo "starting isolated loopback fixture process"
STARTED_PID="$(start_smoke_server "$PORT" "$LOG_PATH" "$SERVER_PATH" "$STARTUP_TOKEN")"
if ! wait_health "$BASE" "$STARTED_PID" "$LOG_PATH" "$STARTUP_TOKEN"; then
  echo "server log:" >&2
  cat "${LOG_PATH}" >&2 || true
  fail "local fixture process did not become healthy (loopback port ${PORT})"
fi

echo "base=loopback:${PORT}"

# --- healthz ---
health_body="${WORKDIR}/healthz.json"
health_code="$(http_get "$BASE" "/healthz" "$health_body" || true)"
if [[ "$health_code" != "200" ]] || ! grep -q '"ok":true' "$health_body"; then
  fail "GET /healthz HTTP ${health_code}"
fi

# --- Completion and retired provider routes ---
complete_body="${WORKDIR}/complete.html"
complete_code="$(http_get "$BASE" "/checkout/complete?intent=unknown-smoke-intent" "$complete_body" || true)"
polar_body="${WORKDIR}/polar-retired.json"
polar_hdrs="${WORKDIR}/polar-retired.hdrs"
polar_code="$(http_post_json "$BASE" "/api/polar/webhook" '{}' "$polar_body" "$polar_hdrs" || true)"
if [[ "$complete_code" == "200" ]] \
  && html_has "$complete_body" 'data-checkout-complete="true"' \
  && html_has "$complete_body" 'data-checkout-state="unknown"'; then
  record "checkout-complete" "PASS" "GET /checkout/complete is read-only and reports unknown intent truthfully"
else
  record "checkout-complete" "FAIL" "GET /checkout/complete HTTP ${complete_code} did not render unknown state"
fi
if [[ "$polar_code" == "410" ]] \
  && grep -q 'polar_webhook_retired' "$polar_body" \
  && grep -q '/api/waffo/webhook' "$polar_body"; then
  record "retired-polar" "PASS" "POST /api/polar/webhook is inert 410; canonical settlement is Waffo"
else
  record "retired-polar" "FAIL" "retired Polar route HTTP ${polar_code} was not inert"
fi

# --- NYC board: current weekly weekend window, no star UI ---
root_body="${WORKDIR}/root.body"
root_hdrs="${WORKDIR}/root.hdrs"
root_code="$(http_get_headers "$BASE" "/" "$root_body" "$root_hdrs" || true)"
root_loc="$(header_value "$root_hdrs" "location" || true)"
board0="${WORKDIR}/board0.html"
board0_code="$(http_get "$BASE" "/nyc" "$board0" || true)"
board0_count="$(listing_count "$board0" || echo 0)"
if [[ "$root_code" != "302" && "$root_code" != "307" ]] || [[ "$root_loc" != *"/nyc" ]]; then
  record "nyc-board" "FAIL" "GET / HTTP ${root_code} loc=${root_loc} (expected 302 /nyc)"
elif [[ "$board0_code" != "200" ]]; then
  record "nyc-board" "FAIL" "GET /nyc HTTP ${board0_code}"
elif ! html_has "$board0" 'data-city="nyc"' \
  || ! html_has "$board0" 'This weekend'; then
  record "nyc-board" "FAIL" "GET /nyc missing NYC board or weekend copy"
elif ! html_has "$board0" "data-window-id=\"${WINDOW_ID}\""; then
  record "nyc-board" "FAIL" "GET /nyc returned a different city/window than ${WINDOW_ID}"
elif html_has "$board0" 'data-window-closed'; then
  if html_has "$board0" 'data-bid-form=""|name="amountUsd"|data-action="outbid"'; then
    record "nyc-board" "FAIL" "GET /nyc closed response retained bid-form or submit controls"
  elif board_rating_ui "$board0"; then
    record "nyc-board" "FAIL" "GET /nyc closed response retained star/rating UI"
  elif ! html_has "$board0" 'data-action="claim-rank"|Claim rank'; then
    record "nyc-board" "FAIL" "GET /nyc closed response omitted disabled Claim rank status"
  elif ! html_has "$board0" 'Claim rank opens Thursday at noon local time'; then
    record "nyc-board" "FAIL" "GET /nyc closed response omitted Claim rank reopen copy"
  elif html_has "$board0" 'This weekend is still open|class="empty-bid-open"|List a venue this weekend|Print this weekend'; then
    record "nyc-board" "FAIL" "GET /nyc closed response retained contradictory open/action copy"
  elif ! html_has "$board0" 'New bids are closed and reopen Thursday at noon local time'; then
    record "nyc-board" "FAIL" "GET /nyc closed response omitted expected Thursday reopen copy"
  else
    record "nyc-board" "PASS-ERROR" "GET /nyc ${WINDOW_ID} is closed; disabled Claim rank status and Thursday reopen copy present"
  fi
elif ! html_has "$board0" 'name="amountUsd"' || ! html_has "$board0" 'Claim rank'; then
  record "nyc-board" "FAIL" "GET /nyc missing open-window bid form"
elif board_rating_ui "$board0"; then
  record "nyc-board" "FAIL" "GET /nyc invented star/rating UI"
elif [[ "$board0_count" == "0" ]] && html_has "$board0" 'data-empty-board="true"'; then
  record "nyc-board" "PASS" "GET / → /nyc 200 window ${WINDOW_ID} empty + bid form; no star UI"
elif [[ "$board0_count" != "0" ]] \
  && html_has "$board0" 'data-bid' \
  && html_has "$board0" 'data-clicks'; then
  record "nyc-board" "PASS" "GET / → /nyc 200 window ${WINDOW_ID}; ${board0_count} already-paid card(s); no star UI"
else
  record "nyc-board" "FAIL" "GET /nyc 200 but empty/paid board contract broken"
fi

# --- About / rules ---
about_body="${WORKDIR}/about.html"
about_code="$(http_get "$BASE" "/about" "$about_body" || true)"
rules_body="${WORKDIR}/rules.html"
rules_code="$(http_get "$BASE" "/rules" "$rules_body" || true)"
if [[ "$about_code" == "200" && "$rules_code" == "200" ]] \
  && html_has "$about_body" 'Rank is money, not stars' \
  && html_has "$about_body" 'star ratings, review scores, or invented quotes' \
  && html_has "$about_body" 'City Weekend Spot' \
  && html_has "$about_body" 'New York' \
  && html_has "$about_body" 'English' \
  && html_has "$rules_body" 'A new venue starts at' \
  && html_has "$rules_body" '\$5' \
  && html_has "$rules_body" 'venue placed first keeps the higher rank' \
  && html_has "$rules_body" 'charged only the difference between' \
  && html_has "$rules_body" 'reviews never influence position' \
  && html_has "$rules_body" 'review claims' \
  && html_has "$rules_body" 'adult content are rejected' \
  && ! invented_stars "$about_body" \
  && ! invented_stars "$rules_body"; then
  record "about-rules" "PASS" "GET /about and /rules 200; min \$5, older wins ties, raise pays difference, no fake reviews"
else
  record "about-rules" "FAIL" "about HTTP ${about_code} rules HTTP ${rules_code}"
fi

# --- Documented product error (not a paid rank) ---
min_body="${WORKDIR}/min.json"
min_hdrs="${WORKDIR}/min.hdrs"
min_code="$(http_post_json "$BASE" "/api/checkout" \
  "{\"city\":\"nyc\",\"venueName\":\"${VENUE}\",\"bookingUrl\":\"${STRIPPED_URL}\",\"amountUsd\":4}" \
  "$min_body" "$min_hdrs" || true)"
min_err="$(json_field "$min_body" "error" || true)"
board_min="${WORKDIR}/board-min.html"
http_get "$BASE" "/nyc" "$board_min" >/dev/null || true
if [[ "$min_code" == "400" && "$min_err" == "bid_below_min" ]] \
  && ! html_has "$board_min" "$VENUE"; then
  record "bid-below-min" "PASS-ERROR" "POST /api/checkout \$4 → 400 bid_below_min; board unchanged"
elif [[ "$min_code" == "400" && "$min_err" == "window_closed" ]] \
  && ! html_has "$board_min" "$VENUE"; then
  record "bid-below-min" "PASS-ERROR" "POST /api/checkout while window closed → 400 window_closed; board unchanged"
else
  record "bid-below-min" "FAIL" "\$4 checkout HTTP ${min_code} error=${min_err}"
fi

# --- Create checkout: offline fixture only (never a provider operator path) ---
echo "== create checkout (fixture-only; no provider network) =="

# --- Click: fixture listing allowed when live pay is blocked ---
fix_body="${WORKDIR}/fixture.json"
fix_hdrs="${WORKDIR}/fixture.hdrs"
fix_code="$(http_post_json "$BASE" "/api/checkout" \
  "{\"city\":\"nyc\",\"venueName\":\"${VENUE}\",\"bookingUrl\":\"${TRACKED_URL}\",\"amountUsd\":5,\"kind\":\"restaurant\"}" \
  "$fix_body" "$fix_hdrs" || true)"
fix_session="$(json_field "$fix_body" "sessionId" || true)"
fix_err="$(json_field "$fix_body" "error" || true)"
board_unpaid="${WORKDIR}/board-unpaid.html"
http_get "$BASE" "/nyc" "$board_unpaid" >/dev/null || true

if [[ "$fix_code" == "200" && -n "$fix_session" ]] \
  && ! html_has "$board_unpaid" "$VENUE"; then
  record "create-checkout" "PASS" "fixture intent created; unpaid session is not ranked"
elif [[ "$fix_code" == "400" && "$fix_err" == "window_closed" ]]; then
  record "create-checkout" "PASS-ERROR" "window_closed; no checkout or listing was invented"
else
  record "create-checkout" "FAIL" "fixture checkout HTTP ${fix_code} error=${fix_err}"
fi

listing_id=""
if html_has "$board_unpaid" "$VENUE"; then
  record "click" "FAIL" "unpaid fixture checkout appeared on the board"
elif [[ "$fix_code" == "200" && -n "$fix_session" ]]; then
  hook_body="${WORKDIR}/fixture-webhook.json"
  hook_hdrs="${WORKDIR}/fixture-webhook.hdrs"
  hook_code="$(http_post_json "$BASE" "/api/waffo/webhook" \
    "{\"type\":\"checkout.updated\",\"data\":{\"id\":\"${fix_session}\",\"status\":\"succeeded\"}}" \
    "$hook_body" "$hook_hdrs" || true)"
  board_paid="${WORKDIR}/board-paid.html"
  board_paid_code="$(http_get "$BASE" "/nyc" "$board_paid" || true)"
  listing_id="$(id_for_venue "$board_paid" "$VENUE" || true)"
  if [[ "$hook_code" != "200" || "$board_paid_code" != "200" || -z "$listing_id" ]]; then
    record "click" "FAIL" "fixture paid event did not list (webhook HTTP ${hook_code})"
  elif html_has "$board_paid" 'utm_source' || board_rating_ui "$board_paid"; then
    record "click" "FAIL" "paid card leaked tracking or invented stars"
  else
    before_clicks="$(clicks_for_id "$board_paid" "$listing_id" || echo "")"
    click_body="${WORKDIR}/click.body"
    click_hdrs="${WORKDIR}/click.hdrs"
    click_code="$(http_get_headers "$BASE" "/api/click/${listing_id}" "$click_body" "$click_hdrs" || true)"
    click_loc="$(header_value "$click_hdrs" "location" || true)"
    board_clicked="${WORKDIR}/board-clicked.html"
    http_get "$BASE" "/nyc" "$board_clicked" >/dev/null || true
    after_clicks="$(clicks_for_id "$board_clicked" "$listing_id" || echo "")"
    if [[ "$click_code" == "302" \
      && "$click_loc" == "${STRIPPED_URL}" \
      && "$before_clicks" =~ ^[0-9]+$ \
      && "$after_clicks" =~ ^[0-9]+$ \
      && "$after_clicks" -eq $((before_clicks + 1)) ]]; then
      record "click" "PASS" "GET /api/click/${listing_id} 302 → stripped URL; clicks ${before_clicks}→${after_clicks}"
    else
      record "click" "FAIL" "GET /api/click/${listing_id} HTTP ${click_code} loc=${click_loc} clicks ${before_clicks}→${after_clicks}"
    fi
  fi
elif [[ "$fix_code" == "400" && "$fix_err" == "window_closed" ]]; then
  seed_body="${WORKDIR}/seed.json"
  seed_hdrs="${WORKDIR}/seed.hdrs"
  seed_code="$(http_post_json "$BASE" "/__smoke/apply-paid" \
    "{\"venueName\":\"${VENUE}\",\"bookingUrl\":\"${TRACKED_URL}\",\"sessionId\":\"fix_closed_${STAMP}\"}" \
    "$seed_body" "$seed_hdrs" || true)"
  listing_id="$(json_field "$seed_body" "id" || true)"
  board_paid="${WORKDIR}/board-paid.html"
  http_get "$BASE" "/nyc" "$board_paid" >/dev/null || true
  if [[ "$seed_code" != "200" || -z "$listing_id" ]]; then
    record "click" "FAIL" "window_closed and fixture seed failed HTTP ${seed_code}"
  else
    before_clicks="$(clicks_for_id "$board_paid" "$listing_id" || echo "0")"
    click_body="${WORKDIR}/click.body"
    click_hdrs="${WORKDIR}/click.hdrs"
    click_code="$(http_get_headers "$BASE" "/api/click/${listing_id}" "$click_body" "$click_hdrs" || true)"
    click_loc="$(header_value "$click_hdrs" "location" || true)"
    board_clicked="${WORKDIR}/board-clicked.html"
    http_get "$BASE" "/nyc" "$board_clicked" >/dev/null || true
    after_clicks="$(clicks_for_id "$board_clicked" "$listing_id" || echo "")"
    if [[ "$click_code" == "302" \
      && "$click_loc" == "${STRIPPED_URL}" \
      && "$after_clicks" =~ ^[0-9]+$ \
      && "$after_clicks" -eq $((before_clicks + 1)) ]]; then
      record "click" "PASS" "window_closed; fixture listing GET /api/click/${listing_id} 302; clicks ${before_clicks}→${after_clicks}"
    else
      record "click" "FAIL" "GET /api/click/${listing_id} HTTP ${click_code} loc=${click_loc} clicks ${before_clicks}→${after_clicks}"
    fi
  fi
else
  record "click" "FAIL" "fixture checkout HTTP ${fix_code} error=${fix_err} (needed for click hop)"
fi

# --- Unknown city: 404 city_unknown; NYC board untouched ---
unknown_body="${WORKDIR}/unknown.html"
unknown_hdrs="${WORKDIR}/unknown.hdrs"
unknown_code="$(http_get_headers "$BASE" "/london" "$unknown_body" "$unknown_hdrs" || true)"
board_after_unknown="${WORKDIR}/board-after-unknown.html"
http_get "$BASE" "/nyc" "$board_after_unknown" >/dev/null || true
if [[ "$unknown_code" == "404" ]] \
  && html_has "$unknown_body" 'city_unknown' \
  && ! html_has "$unknown_body" "$VENUE" \
  && html_has "$board_after_unknown" 'data-city="nyc"'; then
  record "unknown-city" "PASS" "GET /london 404 city_unknown; NYC rank untouched"
else
  record "unknown-city" "FAIL" "GET /london HTTP ${unknown_code}"
fi

echo
echo "== summary =="
echo "PASS=${PASS} PASS-ERROR=${PASS_ERROR} BLOCKED-SECRET=${BLOCKED} FAIL=${FAIL}"
echo "base=loopback:${PORT}"
echo "windowId=${WINDOW_ID}"
if [[ -f "${RESULT_LOG}" ]]; then
  echo "----"
  while IFS=$'\t' read -r flow status note; do
    printf '%-18s %-16s %s\n' "$flow" "$status" "$note"
  done <"${RESULT_LOG}"
fi

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
