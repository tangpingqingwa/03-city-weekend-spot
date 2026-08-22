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

Live Polar (operator machine with a real token):

```bash
POLAR_LIVE=1 POLAR_ACCESS_TOKEN=… bash scripts/live-smoke.sh
```

## Verdicts

| Label | Meaning |
|---|---|
| `PASS` | Flow completed as SPEC requires. |
| `PASS-ERROR` | Documented product error; nothing invented. |
| `BLOCKED-SECRET` | Live Polar secret missing. Exact env var named. |
| `FAIL` | Broken product or invented listing / paid rank. |

## This session

Ran `bash scripts/live-smoke.sh` on **2026-08-22** from `feat/live-smoke` (parent `5d35c92`, public clicks on `origin/main`). Local process started by the script on `http://127.0.0.1:56932`. Weekend window `nyc:2026-W34` (`America/New_York`). `POLAR_LIVE` unset. `POLAR_ACCESS_TOKEN` unset. Fixture path for click only. No invented paid rank: empty NYC board first, then one fixture-paid `book.example.com/smoke-*` URL unique to this run after the paid webhook.

Also refused `CI=true` (`FAIL: live-smoke refuses CI=true`) and `GITHUB_ACTIONS=true`.

| Flow | Result | Note |
|---|---|---|
| NYC board | **PASS** | `GET /` 302 `/nyc`. `GET /nyc` 200 window `nyc:2026-W34`. Empty board + bid form. No star UI. |
| About / rules | **PASS** | `GET /about` and `GET /rules` 200. Min $5, older wins ties, raise pays difference, no fake reviews. |
| Create checkout | **BLOCKED-SECRET** | `BLOCKED-SECRET: POLAR_ACCESS_TOKEN` |
| Click | **PASS** | Fixture listing allowed. `GET /api/click/lst_fix_5696b54b-6313-44f9-b193-073bd551be95` 302 to stripped `https://book.example.com/smoke-…`. Clicks `0→1`. Tracking query not stored. |
| Unknown city | **PASS** | `GET /london` 404 `city_unknown`. NYC rank untouched. |
| Bid below min | **PASS-ERROR** | `POST /api/checkout` $4 → 400 `bid_below_min`. Board unchanged. |

Process exit 0 (`PASS=4` `PASS-ERROR=1` `BLOCKED-SECRET=1` `FAIL=0`). Re-run with `POLAR_LIVE=1` and a real token to complete Polar Checkout; missing token must stay `BLOCKED-SECRET`, never a fixture listing.

## What this does not do

- Does not call `scripts/live-smoke.sh` from `scripts/test.sh` or Actions.
- Does not set `POLAR_LIVE=1` in CI.
- Does not seed a fake paid NYC #1 or star ratings.
- Does not treat a missing Polar secret as a paid listing.
