#!/usr/bin/env bash
# Operator smoke against a local process. Not called from scripts/test.sh or CI.
# Walks NYC board, about/rules, checkout (live Polar or BLOCKED-SECRET), click,
# unknown city. Missing Polar secret → BLOCKED-SECRET: POLAR_ACCESS_TOKEN
# Fixture listing is allowed only so click can run when live pay is blocked.
# Do not invent a paid rank.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

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
LIVE_PID=""
WORKDIR=""
RESULT_LOG=""
BASE="${LIVE_SMOKE_BASE:-}"

# Capture operator Polar flags before the fixture process unsets them.
OP_POLAR_LIVE="${POLAR_LIVE:-}"
OP_POLAR_ACCESS_TOKEN="${POLAR_ACCESS_TOKEN:-}"
OP_POLAR_WEBHOOK_SECRET="${POLAR_WEBHOOK_SECRET:-}"
OP_POLAR_API_BASE="${POLAR_API_BASE:-}"
OP_POLAR_PRODUCT_ID="${POLAR_PRODUCT_ID:-}"

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
  if [[ -n "${LIVE_PID}" ]]; then
    kill_tree "${LIVE_PID}"
    wait "${LIVE_PID}" 2>/dev/null || true
  fi
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

wait_health() {
  local url="$1/healthz"
  local i
  for i in $(seq 1 80); do
    if curl -fsS --connect-timeout 2 --max-time 5 "$url" >/dev/null 2>&1; then
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
import { POST as postWebhook } from "../src/app/api/polar/webhook/route.ts";
import { CityBoard } from "../src/app/[city]/board.tsx";
import { GET as getHealthz } from "../src/app/healthz/route.ts";
import RulesPage from "../src/app/rules/page.tsx";
import { applyPaidEvent } from "../src/billing/port.ts";
import { resolveCity } from "../src/core/cities.ts";
import { getBoardListings } from "../src/core/rank.ts";
import { currentWindow } from "../src/core/window.ts";

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT is required");
}
const origin = process.env.PUBLIC_BASE_URL ?? `http://127.0.0.1:${port}`;

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
    if (request.method === "POST" && path === "/api/checkout") {
      await sendWeb(res, await postCheckout(request));
      return;
    }
    if (request.method === "POST" && path === "/api/polar/webhook") {
      await sendWeb(res, await postWebhook(request));
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
  process.stdout.write(`live-smoke listening ${origin}\n`);
});
EOF
}

start_smoke_server() {
  local port="$1"
  local log_path="$2"
  local server_path="$3"
  shift 3
  (
    cd "$root"
    unset POLAR_LIVE POLAR_ACCESS_TOKEN POLAR_WEBHOOK_SECRET POLAR_FIXTURE_ONLY \
      POLAR_API_BASE POLAR_PRODUCT_ID || true
    export POLAR_FIXTURE_ONLY=1
    export PORT="${port}"
    export PUBLIC_BASE_URL="http://127.0.0.1:${port}"
    while [[ $# -gt 0 ]]; do
      export "$1"
      shift
    done
    exec npx --no-install tsx --tsconfig "${root}/tsconfig.json" "${server_path}"
  ) >"${log_path}" 2>&1 &
  echo $!
}

http_get() {
  local base="$1"
  local path="$2"
  local out="$3"
  curl -sS -o "$out" -w "%{http_code}" --connect-timeout 5 --max-time 20 \
    "${base}${path}"
}

http_get_headers() {
  local base="$1"
  local path="$2"
  local body="$3"
  local hdrs="$4"
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
  grep -Eiq '★|⭐|4\.8 stars|star rating|star-rating|data-stars=|review count' "$file"
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
    const cards = [...html.matchAll(/<article class="card"[\s\S]*?<\/article>/g)].map((m) => m[0]);
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
    const cards = [...html.matchAll(/<article class="card"[\s\S]*?<\/article>/g)].map((m) => m[0]);
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

WORKDIR="$(mktemp -d "${root}/.live-smoke.XXXXXX")"
RESULT_LOG="${WORKDIR}/results.tsv"
: >"${RESULT_LOG}"
STAMP="$(date -u +%Y%m%d%H%M%S)"
WINDOW_ID="$(nyc_window_id)"
VENUE="Smoke Venue ${STAMP}"
STRIPPED_URL="https://book.example.com/smoke-${STAMP}"
TRACKED_URL="${STRIPPED_URL}?utm_source=smoke&fbclid=1"
SERVER_PATH="${WORKDIR}/smoke-server.tsx"
write_smoke_server "$SERVER_PATH"

echo "== live-smoke (operator only; not CI) =="
echo "root=${root}"
echo "windowId=${WINDOW_ID}"

if [[ -z "${BASE}" ]]; then
  PORT="${LIVE_SMOKE_PORT:-$(pick_port)}"
  BASE="http://127.0.0.1:${PORT}"
  LOG_PATH="${WORKDIR}/server.log"
  echo "starting local fixture process on ${BASE}"
  STARTED_PID="$(start_smoke_server "$PORT" "$LOG_PATH" "$SERVER_PATH" "POLAR_FIXTURE_ONLY=1")"
  if ! wait_health "$BASE"; then
    echo "server log:" >&2
    cat "${LOG_PATH}" >&2 || true
    fail "local server did not become healthy at ${BASE}/healthz"
  fi
else
  BASE="${BASE%/}"
  echo "assuming existing server at ${BASE}"
  if ! wait_health "$BASE"; then
    fail "existing server at ${BASE} did not answer /healthz"
  fi
fi

echo "base=${BASE}"
echo "operator POLAR_LIVE=${OP_POLAR_LIVE:-<unset>}"
if [[ -n "${OP_POLAR_API_BASE}" ]]; then
  echo "operator POLAR_API_BASE=${OP_POLAR_API_BASE}"
else
  echo "operator POLAR_API_BASE=<unset default production>"
fi
echo "operator POLAR_PRODUCT_ID=$([ -n "${OP_POLAR_PRODUCT_ID}" ] && echo set || echo unset)"

# --- healthz ---
health_body="${WORKDIR}/healthz.json"
health_code="$(http_get "$BASE" "/healthz" "$health_body" || true)"
if [[ "$health_code" != "200" ]] || ! grep -q '"ok":true' "$health_body"; then
  fail "GET /healthz HTTP ${health_code}"
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
  || ! html_has "$board0" 'name="amountUsd"' \
  || ! html_has "$board0" 'Outbid' \
  || ! html_has "$board0" 'This weekend'; then
  record "nyc-board" "FAIL" "GET /nyc missing NYC board, weekend copy, or bid form"
elif invented_stars "$board0"; then
  record "nyc-board" "FAIL" "GET /nyc invented star UI"
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
  && html_has "$about_body" 'no fake reviews' \
  && html_has "$about_body" 'NYC' \
  && html_has "$about_body" 'city-weekend-spot' \
  && html_has "$rules_body" 'min \$5' \
  && html_has "$rules_body" 'older wins ties' \
  && html_has "$rules_body" 'raise pays difference' \
  && html_has "$rules_body" 'no fake reviews' \
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
else
  record "bid-below-min" "FAIL" "\$4 checkout HTTP ${min_code} error=${min_err}"
fi

# --- Create checkout: live Polar session or BLOCKED-SECRET ---
echo "== create checkout (live Polar or BLOCKED-SECRET) =="
if [[ "${OP_POLAR_LIVE}" == "1" ]]; then
  if [[ -z "${OP_POLAR_ACCESS_TOKEN}" ]]; then
    echo "BLOCKED-SECRET: POLAR_ACCESS_TOKEN"
    record "create-checkout" "BLOCKED-SECRET" "POLAR_ACCESS_TOKEN"
  else
    live_port="$(pick_port)"
    live_log="${WORKDIR}/polar-live.log"
    live_base="http://127.0.0.1:${live_port}"
    LIVE_PID="$(start_smoke_server "$live_port" "$live_log" "$SERVER_PATH" \
      "POLAR_LIVE=1" \
      "POLAR_ACCESS_TOKEN=${OP_POLAR_ACCESS_TOKEN}" \
      "POLAR_WEBHOOK_SECRET=${OP_POLAR_WEBHOOK_SECRET:-}" \
      "POLAR_API_BASE=${OP_POLAR_API_BASE:-}" \
      "POLAR_PRODUCT_ID=${OP_POLAR_PRODUCT_ID:-}" \
      "POLAR_FIXTURE_ONLY=")"
    if ! wait_health "$live_base"; then
      if grep -q 'BLOCKED-SECRET: POLAR_ACCESS_TOKEN' "${live_log}"; then
        echo "BLOCKED-SECRET: POLAR_ACCESS_TOKEN"
        record "create-checkout" "BLOCKED-SECRET" "POLAR_ACCESS_TOKEN"
      else
        record "create-checkout" "FAIL" "live Polar process did not become healthy"
      fi
    else
      live_body="${WORKDIR}/polar-live.json"
      live_hdrs="${WORKDIR}/polar-live.hdrs"
      live_code="$(http_post_json "$live_base" "/api/checkout" \
        "{\"city\":\"nyc\",\"venueName\":\"Live Polar Venue\",\"bookingUrl\":\"https://book.example.com/live-polar\",\"amountUsd\":5,\"kind\":\"restaurant\"}" \
        "$live_body" "$live_hdrs" || true)"
      live_url="$(json_field "$live_body" "checkoutUrl" || true)"
      live_err="$(json_field "$live_body" "error" || true)"
      live_board="${WORKDIR}/polar-live-board.html"
      http_get "$live_base" "/nyc" "$live_board" >/dev/null || true
      if html_has "$live_board" 'Live Polar Venue'; then
        record "create-checkout" "FAIL" "unpaid live Polar session appeared on the board"
      elif [[ "$live_code" == "200" && "$live_url" == https://sandbox.polar.sh/* ]]; then
        record "create-checkout" "PASS" "live Polar sandbox Checkout URL; unpaid session not listed"
      elif [[ "$live_code" == "200" && "$live_url" == https://*polar.sh* ]]; then
        record "create-checkout" "FAIL" "Polar checkout URL is not sandbox.polar.sh (got non-sandbox host)"
      elif [[ "$live_code" == "503" && "$live_err" == "polar_unavailable" ]]; then
        record "create-checkout" "PASS-ERROR" "polar_unavailable; no invented paid rank"
      else
        record "create-checkout" "PASS-ERROR" "POLAR_LIVE=1 HTTP ${live_code} error=${live_err}; no invented listing"
      fi
    fi
    if [[ -n "${LIVE_PID}" ]]; then
      kill_tree "${LIVE_PID}"
      wait "${LIVE_PID}" 2>/dev/null || true
    fi
    LIVE_PID=""
  fi
else
  if [[ -z "${OP_POLAR_ACCESS_TOKEN}" ]]; then
    echo "BLOCKED-SECRET: POLAR_ACCESS_TOKEN"
    record "create-checkout" "BLOCKED-SECRET" "POLAR_ACCESS_TOKEN"
  else
    record "create-checkout" "PASS-ERROR" "POLAR_LIVE unset; token present but live Polar not invoked"
  fi
fi

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

listing_id=""
if html_has "$board_unpaid" "$VENUE"; then
  record "click" "FAIL" "unpaid fixture checkout appeared on the board"
elif [[ "$fix_code" == "200" && -n "$fix_session" ]]; then
  hook_body="${WORKDIR}/fixture-webhook.json"
  hook_hdrs="${WORKDIR}/fixture-webhook.hdrs"
  hook_code="$(http_post_json "$BASE" "/api/polar/webhook" \
    "{\"type\":\"checkout.updated\",\"data\":{\"id\":\"${fix_session}\",\"status\":\"succeeded\"}}" \
    "$hook_body" "$hook_hdrs" || true)"
  board_paid="${WORKDIR}/board-paid.html"
  board_paid_code="$(http_get "$BASE" "/nyc" "$board_paid" || true)"
  listing_id="$(id_for_venue "$board_paid" "$VENUE" || true)"
  if [[ "$hook_code" != "200" || "$board_paid_code" != "200" || -z "$listing_id" ]]; then
    record "click" "FAIL" "fixture paid event did not list (webhook HTTP ${hook_code})"
  elif html_has "$board_paid" 'utm_source' || invented_stars "$board_paid"; then
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
echo "base=${BASE}"
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
