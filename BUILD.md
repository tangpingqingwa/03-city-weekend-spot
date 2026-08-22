# City Weekend Spot — Detailed Specification and Build Plan

**Contract:** [SPEC.md](./SPEC.md) wins on ranking, windows, listings, and errors.  
**This file** wins on stack, module boundaries, test layout, and the PR sequence.  
**Git:** [CONTRIBUTING.md](./CONTRIBUTING.md). Every `### PR N:` row is one squash-merged PR. `main` stays green.

Pay-to-rank clone of outbid.lol. NYC is the v1 lane. Ranking is `(city, window)` so a second city is a catalog row, not a rewrite.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Runtime | Node 22, TypeScript `strict` |
| App | Next.js App Router (outbid-like public board) + Route Handlers |
| DB | SQLite via `better-sqlite3` (one file; cities, windows, listings, payments, clicks) |
| Payments | `PaymentPort`. Adapter `fixture` in tests; live Polar when `POLAR_LIVE=1` |
| Tests | `node:test` + `tsx` + fixture Polar. No live Polar in CI |
| Process | `next dev` locally; `next start` in prod. `/healthz` on the same process |

**Out of stack:** Prisma, Redis, Kubernetes, multi-region, a reviews engine, a second ranking algorithm per city.

---

## 2. Multi-city ranking (do not hard-code NYC)

```
cities (slug pk, name, timezone, active)
windows (id, city, starts_at, ends_at)
listings (id, city, window_id, venue_key, venue_name, kind, booking_url, pitch, bid_usd, first_paid_at, clicks)
payments (id, listing_id, polar_session, amount_usd, kind create|raise)
```

Board query (every city, including NYC):

```
WHERE city = ? AND window_id = current_window(city)
ORDER BY bid_usd DESC, first_paid_at ASC, id ASC
```

`current_window(city)` uses that city’s IANA timezone and the weekly weekend window in SPEC. Adding `london` must not touch this `ORDER BY`.

---

## 3. Target tree

```
/
  SPEC.md
  BUILD.md
  README.md
  CONTRIBUTING.md
  package.json                 # PR 1
  scripts/test.sh
  scripts/live-smoke.sh        # live-smoke PR
  docs/live-smoke.md
  src/
    app/
      page.tsx                 # redirect → /nyc
      [city]/page.tsx          # public board
      about/page.tsx
      rules/page.tsx
      api/checkout/route.ts
      api/polar/webhook/route.ts
      api/click/[id]/route.ts
      healthz/route.ts
    core/
      rank.ts                  # ORDER BY contract
      window.ts                # weekly weekend window
      listing.ts               # venue + city + booking URL
      url.ts                   # strip tracking, reject chat/NSFW
      cities.ts                # catalog; nyc active
    billing/
      port.ts
      fixture.ts
      polar.ts                 # live, env-gated
    db.ts
    config.ts
  tests/
    rank.test.ts
    window.test.ts
    listing.test.ts
    checkout.test.ts
    click.test.ts
    fixtures/
  .github/workflows/ci.yml
```

HTTP / pages call `core/*` only. They do not import `billing/polar.ts` directly.

---

## 4. Tests (offline)

| Test | Assert |
|---|---|
| window | NYC Thursday 12:00 included; Sunday 23:59:59 included; Monday 00:00 new window |
| rank | higher bid above; **older wins ties**; below-#1 still lists |
| raise | $5 → $12 charges **$7**; other listing cannot steal by paying $7 |
| listing | venue + city + booking URL required; “4.9 stars” → `reviews_forbidden` |
| url | `utm_source` stripped; telegram invite → `url_forbidden` |
| city | unknown slug 404; second city uses the same `rank.ts` |
| polar fixture | unpaid checkout does not list; paid fixture event lists |
| clicks | GET click route 302 + increments |
| live gate | unset / `0` / `true` stay fixture; `POLAR_FIXTURE_ONLY=1` wins |

`scripts/test.sh` stays offline. Once `package.json` exists it runs `tsc --noEmit` and `node:test`. It must never call `scripts/live-smoke.sh`.

---

## 5. PR plan

Each heading below is one PR. Dependencies are hard. Do not start the next PR in the same branch.

### PR 1: Skeleton + CI
- **Description:** package.json, tsconfig, Next healthz, extend `scripts/test.sh` to typecheck + run tests once src exists.
- **Files:** `package.json`, `tsconfig.json`, `src/app/healthz/route.ts`, `scripts/test.sh`, `.gitignore`
- **Dependencies:** None
- **Acceptance:** `GET /healthz` → `{ ok: true }`. `bash scripts/test.sh` green offline.

### PR 2: Board UI clone of outbid.lol
- **Description:** Public NYC board: one URL/venue field, whole-dollar amount, Outbid button, ranked cards with **$** and **clicks**. No stars.
- **Files:** `src/app/page.tsx`, `src/app/[city]/page.tsx`, `src/core/cities.ts`, board styles
- **Dependencies:** PR 1
- **Acceptance:** `/` redirects to `/nyc`. Empty window renders the form. Cards show money not stars.

### PR 3: City lanes and weekend window
- **Description:** City catalog + deterministic weekly weekend window. Listing row is venue + city + booking URL. Shared `rank.ts`.
- **Files:** `src/core/window.ts`, `src/core/rank.ts`, `src/core/listing.ts`, `src/db.ts`, `tests/window.test.ts`, `tests/rank.test.ts`
- **Dependencies:** PR 2
- **Acceptance:** SPEC window bounds. Unknown city 404. Ranking function takes `city`; NYC is data.

### PR 4: Polar checkout and fixture
- **Description:** `PaymentPort.createCheckout`. Fixture adapter for tests. Live Polar behind `POLAR_LIVE=1`. Rank changes only on paid webhook / fixture event.
- **Files:** `src/billing/port.ts`, `src/billing/fixture.ts`, `src/billing/polar.ts`, `src/app/api/checkout/route.ts`, `src/app/api/polar/webhook/route.ts`, `tests/checkout.test.ts`
- **Dependencies:** PR 3
- **Acceptance:** $5 fixture create lists at #1. Abandoned checkout does not. CI does not set `POLAR_LIVE`.

### PR 5: Raise-bid
- **Description:** Same venue key in the same city + window raises by paying the difference. Different listing pays full amount.
- **Files:** `src/core/listing.ts`, checkout route, `tests/checkout.test.ts`
- **Dependencies:** PR 4
- **Acceptance:** SPEC acceptance 5. `bid_not_higher` when raise ≤ current.

### PR 6: Rules, about, and URL hygiene
- **Description:** `/about`, `/rules`. Strip tracking. Reject chat/NSFW. Reject review-speak (`reviews_forbidden`).
- **Files:** `src/app/about/page.tsx`, `src/app/rules/page.tsx`, `src/core/url.ts`, `tests/listing.test.ts`
- **Dependencies:** PR 3
- **Acceptance:** Rules page states min $5, older wins ties, raise pays difference, no fake reviews. Tracking keys stripped.

### PR 7: Public click counts
- **Description:** Outbound click route increments a public counter. Board shows the number.
- **Files:** `src/app/api/click/[id]/route.ts`, `tests/click.test.ts`
- **Dependencies:** PR 3
- **Acceptance:** SPEC acceptance 9. Clicks are visible on the card.

### PR 8: live-smoke
- **Description:** Operator script walks NYC board, about/rules, checkout (live Polar or `BLOCKED-SECRET`), click, unknown city. Not in CI.
- **Files:** `scripts/live-smoke.sh`, `docs/live-smoke.md`, `tests/live-smoke.test.ts` (offline guards only)
- **Dependencies:** PR 4, PR 6, PR 7
- **Acceptance:** Script is executable. `scripts/test.sh` and `.github/workflows/ci.yml` do not invoke it. Docs record PASS / PASS-ERROR / BLOCKED-SECRET. No invented paid rank.

---

## 6. Env

| Var | Role |
|---|---|
| `POLAR_LIVE` | `1` selects live Polar. Unset / `0` / `true` stay fixture or fail-closed |
| `POLAR_FIXTURE_ONLY` | `1` always wins |
| `POLAR_ACCESS_TOKEN` | Live Polar. Missing → live-smoke `BLOCKED-SECRET` |
| `POLAR_WEBHOOK_SECRET` | Live webhook verify |
| `DATABASE_PATH` | SQLite file; default `./data/city-weekend-spot.sqlite` |

Dockerfile / runbook may land with a later deploy PR. Image must not set `POLAR_LIVE=1`.

---

## 7. Rollback

Any PR that makes `scripts/test.sh` red is reverted with `fix/` via PR. Do not force-push `main`.
