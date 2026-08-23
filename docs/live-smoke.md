# Live smoke — City Weekend Spot

Operator-only. `bash scripts/live-smoke.sh` is **not** called from `scripts/test.sh` or GitHub Actions. CI and `scripts/test.sh` stay offline and must not set `POLAR_LIVE`.

`100%` for this unit means a **local process** walked every SPEC §12 flow. Fixture checkout is allowed for the click hop. Live Polar runs only when `POLAR_LIVE=1` and `POLAR_ACCESS_TOKEN` exists. Missing Polar secret is `BLOCKED-SECRET: POLAR_ACCESS_TOKEN` — that is not a fixture success and not a paid NYC rank. Do not invent a paid rank. An empty weekend window is valid.

## How to run

```bash
bash scripts/live-smoke.sh
```

The script:

1. Refuses `CI=true` and `GITHUB_ACTIONS=true`.
2. Starts a local process that serves the same App Router handlers (`/`, `/nyc`, `/about`, `/rules`, `/api/checkout`, `/api/polar/webhook`, `/api/click/:id`, `/healthz`) on a free loopback port with Polar env unset and `POLAR_FIXTURE_ONLY=1`. (`next dev` is not required; the product handlers run through tsx.)
3. Or attaches to `LIVE_SMOKE_BASE` if that server already answers `GET /healthz`.
4. Walks NYC board, `/about`, `/rules`, checkout (live Polar or `BLOCKED-SECRET`), click, unknown city.
5. Live Polar: if `POLAR_LIVE` is not `1` or `POLAR_ACCESS_TOKEN` is empty, prints `BLOCKED-SECRET: POLAR_ACCESS_TOKEN` for checkout only. Board, rules, about, click, and unknown city still run.
6. Kills the process it started and deletes the temp workdir.

Overrides: `LIVE_SMOKE_BASE`, `LIVE_SMOKE_PORT`.

Live Polar sandbox (operator machine; source `~/.polar/sandbox.env`, never commit it):

```bash
set -a
# shellcheck disable=SC1091
source "$HOME/.polar/sandbox.env"
set +a
unset POLAR_FIXTURE_ONLY
export POLAR_LIVE=1
export POLAR_API_BASE=https://sandbox-api.polar.sh
bash scripts/live-smoke.sh
```

Sandbox tokens return `401` on `https://api.polar.sh`. The live client defaults to production and honors `POLAR_API_BASE`. A PASS checkout URL must be a real `https://sandbox.polar.sh/…` Checkout, not a fixture `/{city}/return` listing. Missing `POLAR_ACCESS_TOKEN` stays `BLOCKED-SECRET`.

## Verdicts

| Label | Meaning |
|---|---|
| `PASS` | Flow completed as SPEC requires. |
| `PASS-ERROR` | Documented product error; nothing invented. |
| `BLOCKED-SECRET` | Live Polar secret missing. Exact env var named. |
| `FAIL` | Broken product or invented listing / paid rank. |

## This session

Ran `bash scripts/test.sh` (offline, Polar env unset, `POLAR_FIXTURE_ONLY=1`) then `bash scripts/live-smoke.sh` on **2026-08-23** from `feat/live-polar-sandbox-smoke` (parent `bf84c38` on `origin/main`). Operator sourced `~/.polar/sandbox.env` (mode 600; token length 53, webhook length 49, product id length 36 — values never printed or committed). `POLAR_LIVE=1`. `POLAR_FIXTURE_ONLY` unset. `POLAR_API_BASE=https://sandbox-api.polar.sh`. Sandbox token against production `https://api.polar.sh` is `401`. Script started a fixture process on `http://127.0.0.1:56887` for board/click, then a second live-flagged process for checkout. Weekend window `nyc:2026-W34` (`America/New_York`).

| Flow | Result | Note |
|---|---|---|
| NYC board | **PASS** | `GET /` 302 `/nyc`. `GET /nyc` 200 window `nyc:2026-W34`. Empty board + bid form. No star UI. |
| About / rules | **PASS** | `GET /about` and `GET /rules` 200. Min $5, older wins ties, raise pays difference, no fake reviews. |
| Create checkout | **PASS** | Live Polar sandbox Checkout URL (`https://sandbox.polar.sh/…`). Not a fixture `/{city}/return` listing. Unpaid session not listed. |
| Click | **PASS** | Fixture listing allowed for the hop. `GET /api/click/lst_fix_0dbcbbfd-d0fb-454f-b33a-418da2e11475` 302 to stripped `https://book.example.com/smoke-…`. Clicks `0→1`. |
| Unknown city | **PASS** | `GET /london` 404 `city_unknown`. NYC rank untouched. |
| Bid below min | **PASS-ERROR** | `POST /api/checkout` $4 → 400 `bid_below_min`. Board unchanged. |

Process exit 0 (`PASS=5` `PASS-ERROR=1` `BLOCKED-SECRET=0` `FAIL=0`). Missing Polar secret would still be `BLOCKED-SECRET`, never an invented paid rank.

## What this does not do

- Does not call `scripts/live-smoke.sh` from `scripts/test.sh` or Actions.
- Does not set `POLAR_LIVE=1` in CI.
- Does not seed a fake paid NYC #1 or star ratings.
- Does not treat a missing Polar secret as a paid listing.
