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
| Payments | `PaymentPort`. Adapter `fixture` in tests; Waffo Pancake in explicit `waffo-test`/`waffo-prod` |
| Tests | `node:test` + `tsx` + fixture Waffo boundary. No live Waffo in CI |
| Process | `next dev` locally; `next start` in prod. `/healthz` on the same process |

**Out of stack:** Prisma, Redis, Kubernetes, multi-region, a reviews engine, a second ranking algorithm per city.

---

## 2. Multi-city ranking (do not hard-code NYC)

```
cities (slug pk, name, timezone, active)
windows (id, city, starts_at, ends_at)
listings (id, city, window_id, venue_key, venue_name, kind, booking_url, pitch, bid_usd, first_paid_at, clicks)
payments (id, listing_id, provider_checkout_id, provider_order_id, provider_payment_id, amount_usd, kind create|raise)
```

Board query (every city, including NYC):

```
WHERE city = ? AND window_id = current_window(city)
ORDER BY bid_usd DESC, first_paid_at ASC, id ASC
```

`current_window(city)` uses that city’s IANA timezone for the ISO `{city}:{iso_week}` label and new-bid hours. Occupied live board filters Waffo-paid `firstPaidAt` in the rolling last 7 days, not Monday 00:00 UTC. Adding `london` must not touch this `ORDER BY`.

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
      api/waffo/webhook/route.ts
      api/polar/webhook/route.ts  # retired 410 compatibility path
      checkout/complete/page.tsx
      api/click/[id]/route.ts
      healthz/route.ts
    core/
      rank.ts                  # ORDER BY contract
      window.ts                # weekly weekend window; rolling last-7-days occupancy
      listing.ts               # venue + city + booking URL
      url.ts                   # strip tracking, reject chat/NSFW
      cities.ts                # catalog; nyc active
    billing/
      port.ts
      fixture.ts
      waffo.ts                 # signed Waffo Pancake boundary
      waffo-session.ts         # fail-closed Waffo config/URL checks
      polar.ts                 # retired inert compatibility module
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
| window | NYC Thursday 12:00 included; Sunday 23:59:59 included; Monday 00:00 new ISO label; occupied rank is rolling last 7 days from paid createdAt |
| rank | higher bid above; **older wins ties**; below-#1 still lists |
| raise | $5 → $12 charges **$7**; other listing cannot steal by paying $7 |
| listing | venue + city + booking URL required; “4.9 stars” → `reviews_forbidden` |
| url | `utm_source` stripped; telegram invite → `url_forbidden` |
| city | unknown slug 404; second city uses the same `rank.ts` |
| waffo fixture | unpaid checkout does not list; paid fixture event lists |
| clicks | GET click route 302 + increments |
| provider gate | explicit `PAYMENT_MODE=fixture` for offline tests; Waffo modes fail closed without config |

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

### PR 4: Waffo checkout and fixture
- **Description:** `PaymentPort.createCheckout`. Fixture adapter for tests. Waffo Pancake behind explicit `waffo-test`/`waffo-prod` config. Rank changes only on the signed Waffo webhook / fixture event; the old Polar path is inert.
- **Files:** `src/billing/port.ts`, `src/billing/fixture.ts`, `src/billing/waffo.ts`, `src/billing/waffo-session.ts`, `src/app/api/checkout/route.ts`, `src/app/api/waffo/webhook/route.ts`, `src/app/api/polar/webhook/route.ts`, `tests/checkout.test.ts`
- **Dependencies:** PR 3
- **Acceptance:** $5 fixture create lists at #1. Abandoned checkout does not. CI has no provider secrets and only runs offline fixture tests.

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
- **Description:** Offline operator script walks NYC board, about/rules, fixture checkout, read-only completion, canonical Waffo webhook, retired Polar 410, click, and unknown city. Not in CI and never calls a provider.
- **Files:** `scripts/live-smoke.sh`, `docs/live-smoke.md`, `tests/live-smoke.test.ts` (offline guards only)
- **Dependencies:** PR 4, PR 6, PR 7
- **Acceptance:** Script is executable. `scripts/test.sh` and `.github/workflows/ci.yml` do not invoke it. Docs record PASS / PASS-ERROR / BLOCKED-SECRET. No invented paid rank.

---

## 6. Env

| Var | Role |
|---|---|
| `PAYMENT_MODE` | Explicit `fixture`, `waffo-test`, or `waffo-prod`; no provider is inferred |
| `WAFFO_MERCHANT_ID` / `WAFFO_STORE_ID` / `WAFFO_PRODUCT_ID` | Waffo identifiers; required in both Waffo modes |
| `WAFFO_PRIVATE_KEY` / `WAFFO_PRIVATE_KEY_FILE` | Waffo API signing key; required in both Waffo modes |
| `WAFFO_WEBHOOK_TEST_PUBLIC_KEY` / `WAFFO_WEBHOOK_PROD_PUBLIC_KEY` | Signed `order.completed` verification keys |
| `WAFFO_API_BASE` | Official `https://api.waffo.ai` in production; test may use an injected endpoint |
| `PUBLIC_BASE_URL` / `WAFFO_PUBLIC_BASE_URL` | Production origin-only HTTPS callback base; local fixture may use loopback |
| `DATABASE_PATH` | SQLite file; default `./data/city-weekend-spot.sqlite` |

Polar variables and the `/api/polar/webhook` endpoint are retained only as inert compatibility debris; they cannot select a provider or settle a payment. Dockerfile / runbook may land with a later deploy PR. Image must use a durable `DATABASE_PATH` and may not enable fixture mode in production.

---

## 7. Rollback

Any PR that makes `scripts/test.sh` red is reverted with `fix/` via PR. Do not force-push `main`.
