# City Weekend Spot — Product Development Spec

**Version:** 1.0  
**Status:** Ready to build  
**Repo:** https://github.com/tangpingqingwa/03-city-weekend-spot  
**Market:** global English. USD only.  
**Clone of:** [outbid.lol](https://outbid.lol/) pay-to-rank mechanics, applied to a per-city weekend slot.

One public board per city. Venues bid whole USD for the #1 “where to go this Friday/Saturday” slot. **Ranking is money not stars.** No fake reviews.

---

## 1. Product statement

A weekly weekend window auction for the first place a local looks when deciding where to eat, drink, or see a show this Friday or Saturday.

v1 lane is **NYC** (`nyc`, `America/New_York`). Architecture is multi-city from day one: ranking is `(city, window)` and does not hard-code New York.

One-line pitch: **This weekend in this city, #1 is whoever paid the most.**

---

## 2. Goals and non-goals

### Goals

- Public leaderboard. No ads, no API keys, no revenue share.
- Whole-dollar USD bids. Minimum **$5**.
- Rank equals current bid. Paying less than #1 still lists at the rank that bid can take.
- Equal bids: **older wins ties** (first paid at that amount stays above).
- Same listing can raise; **raise pays difference** only.
- Listing is **venue + city + booking URL**. Optional one-line pitch. Optional kind (`restaurant` | `bar` | `show`).
- **Weekly weekend window.** Occupied rank is the rolling last 7 days from paid `createdAt`. Not Monday 00:00 UTC. Bids older than 7 days do not carry.
- **No fake reviews.** No star ratings, no invented quotes, no scraped scores.
- Strip tracking and affiliate query strings. No chat / invite links. No NSFW.
- Public click counts on the booking URL.
- Live payments via Polar (merchant of record). Tests use a Polar **fixture**.
- Pages: board, about, rules, checkout return.

### Non-goals

- Yelp / Google clone. Stars, reviews, and “editor’s picks” are out.
- Chat, DMs, comments, or accounts-as-social-graph.
- Multi-currency. USD only in v1.
- China-city default. Global English market; NYC is the first dense lane, not a China city.
- Rewriting ranking to add a second city.
- Ads, affiliate networks, or revenue share with booking platforms.

---

## 3. City lanes

A **lane** is one city slug + IANA timezone + display name + `active` flag.

| slug | name | timezone | v1 |
|---|---|---|---|
| `nyc` | New York City | `America/New_York` | **yes — ship this** |

More cities (London, Lisbon, Bali, …) are additional rows. They share the same ranking function. Do not fork board code per city.

Unknown slug → `404 city_unknown`. Inactive slug → `404 city_inactive`.

Default board URL `/` redirects to `/nyc` until a second active city exists. After that, `/` is a city picker only — never a global mash-up rank.

---

## 4. Weekly weekend window (normative)

Each city has one open **weekly weekend window** at a time.

```
city local timezone
new bids open: Thursday 12:00 (noon)
new bids close: Sunday 23:59:59.999
occupied rank: rolling last 7 days from paid createdAt
slot meaning:  “this Friday / Saturday”
```

- Occupied poster rank is Polar-paid rows whose `firstPaidAt` (`createdAt`) is still inside the **rolling last 7 days**. Not Monday 00:00 UTC. Not a 24h lock on #1.
- New bids still open Thursday noon through Sunday 23:59:59.999 local. `{city}:{iso_week}` is a Polar/audit label, Thursday-anchored. Do not invent a second clock.
- A traveler outside civil Monday midnight does not lose the occupied poster on a timezone tax.
- Bids older than 7 days never reappear on the live board. Want #1 again? Pay again.

Empty board is valid: show the ranked list with zero cards and the bid form.

---

## 5. Ranking rules (normative)

Clone of outbid.lol. Rank is the bid. Nothing else.

| Rule | Detail |
|---|---|
| Currency | USD |
| Amount | Whole dollars only. Reject cents. |
| Minimum | **$5** on a first bid for a listing in this window |
| Rank | Descending `bid_usd`. **rank = bid** |
| Below #1 | Still lists, at the rank that amount can take |
| Ties | **Older wins ties.** Compare `first_paid_at` ascending, then listing id |
| Raise | Same `(venue_key, city, window)` may raise. Charge **new − current** only |
| Steal | A *different* listing that wants that rank must pay the **full** target amount, not the incumbent’s difference |
| Floor after raise | New amount must be a whole dollar ≥ current + $1 and ≥ $5 |

There is no relevance score, recency boost, star average, or editorial override in v1.

---

## 6. Listing schema

```ts
type CitySlug = string   // ^[a-z][a-z0-9-]{1,31}$

type VenueKind = "restaurant" | "bar" | "show"

type Listing = {
  id: string
  city: CitySlug
  windowId: string
  venueName: string          // 1–80 chars, trimmed
  kind: VenueKind | null     // optional; never required to rank
  bookingUrl: string         // https, tracking stripped
  pitch: string | null       // ≤ 120 chars; no review-speak
  bidUsd: number             // integer ≥ 5
  firstPaidAt: string        // ISO instant of first successful payment
  lastPaidAt: string
  clicks: number             // public, increment on outbound click
}
```

**Canonical venue key** for raise matching: lowercase trimmed `venueName` + host of `bookingUrl` + `city` + `windowId`. Same key → raise. Different key → new listing that must pay the full bid.

Forbidden on a listing:

- Star ratings, “4.8”, review counts, “people say…”, fake testimonials.
- Scraped or invented review text.
- Chat / WhatsApp / Telegram / Discord invite URLs.
- NSFW copy or booking URLs.

The board may show: rank, venue name, city, kind, pitch, **$bid**, public **clicks**, booking CTA. It may not show stars.

---

## 7. URL hygiene

On create and raise, normalize `bookingUrl`:

1. Require `https:` (http → reject `url_insecure`).
2. Strip tracking / affiliate query keys: `utm_*`, `fbclid`, `gclid`, `gbraid`, `wbraid`, `msclkid`, `ref`, `ref_`, `affiliate`, `aff`, `irclickid`, `mc_cid`, `mc_eid`, `icid`.
3. Strip fragments.
4. Reject chat / invite hosts (telegram, wa.me, chat.whatsapp, discord.gg, t.me).
5. Reject obvious NSFW path tokens (document the list in code; keep it boring).

Store and display only the stripped URL. Public clicks count on that stored URL.

---

## 8. Payments

`PaymentPort`:

```ts
createCheckout(input: {
  listingDraft: ListingDraft
  amountUsd: number          // full first bid, or raise difference
  kind: "create" | "raise"
}): Promise<{ checkoutUrl: string; sessionId: string }>

handleWebhook(rawBody: string, headers: Record<string, string>): Promise<PaidEvent>
```

| Mode | When | Behavior |
|---|---|---|
| Fixture | tests, `POLAR_FIXTURE_ONLY=1`, or Polar unset | In-memory / signed fixture session. No network |
| Live Polar | `POLAR_LIVE=1` + Polar secrets | Polar checkout + webhook. Merchant of record |

`POLAR_FIXTURE_ONLY=1` always wins. Unset / `0` / `true` stay fixture or fail-closed. CI must not set `POLAR_LIVE=1`.

Rank updates **only** after a successful paid event. Abandoned checkout does not create or raise a listing.

---

## 9. Pages

```
GET  /                         → 302 /nyc   (while nyc is the only active city)
GET  /:city                    public board for that city + current window
POST /:city/checkout           { venueName, bookingUrl, amountUsd, kind?, pitch? }
                               → PaymentPort.createCheckout (create or raise)
GET  /:city/return             checkout return; show paid / pending, never trust query alone
GET  /:city/click/:id          302 bookingUrl; increment public clicks
GET  /about                    what this is; NYC v1; rank is money
GET  /rules                    min $5, ties, raise = difference, no reviews, no NSFW
GET  /healthz                  { ok: true }
```

Board UI (clone outbid.lol, not a redesign):

- One venue / booking URL field, one whole-dollar amount, one **Outbid** button.
- Ranked cards: rank, venue, **$amount**, public **clicks**, booking link.
- No star widgets. No review blurb.

---

## 10. Errors

| Code | HTTP | When |
|---|---|---|
| `city_unknown` | 404 | slug not in catalog |
| `city_inactive` | 404 | slug exists but `active=0` |
| `window_closed` | 400 | new bid outside Thursday noon–Sunday local; occupied rank still rolls 7 days |
| `bid_not_whole` | 400 | cents or non-integer |
| `bid_below_min` | 400 | first bid &lt; $5 |
| `bid_not_higher` | 400 | raise ≤ current |
| `url_insecure` | 400 | not https |
| `url_forbidden` | 400 | chat / NSFW / unusable host |
| `reviews_forbidden` | 400 | pitch or name contains star/review claims |
| `payment_incomplete` | 402 | checkout abandoned; board unchanged |
| `polar_unavailable` | 503 | live Polar down; fixture never invents a paid event |

Zero invented listings on any error.

---

## 11. Acceptance

| # | Case | Expected |
|---|---|---|
| 1 | NYC board, empty window | 200, zero cards, bid form visible |
| 2 | First bid $5 fixture | listing appears; rank 1; `$5` |
| 3 | Second listing $8 | new listing #1; $5 listing #2 |
| 4 | Two $8 bids | older listing stays above |
| 5 | #2 raises to $12 | pays **$7** difference; becomes #1 |
| 6 | Tracking query on booking URL | stored URL has tracking stripped |
| 7 | Pitch with “4.9 stars” | `reviews_forbidden`; no listing |
| 8 | Chat invite URL | `url_forbidden` |
| 9 | Click booking CTA | 302 to stripped URL; public clicks +1 |
| 10 | London slug before it is active | `city_unknown` or `city_inactive`; NYC rank untouched |
| 11 | After 7 days from paid createdAt | board drops that listing; Monday 00:00 UTC does not |
| 12 | `POLAR_LIVE` unset | fixture / fail-closed; no Polar network |

---

## 12. Live-smoke flows

Operator-only. `scripts/live-smoke.sh` is **not** called from `scripts/test.sh` or Actions.

Local process, `POLAR_LIVE=1` if Polar secrets exist, else record `BLOCKED-SECRET` for checkout only. Board, rules, about, and click still run.

| Flow | Pass |
|---|---|
| NYC board | 200, current weekly weekend window, no star UI |
| About / rules | 200, state min $5, older wins ties, raise pays difference, no fake reviews |
| Create checkout | Polar session for a real https booking URL **or** `BLOCKED-SECRET` (`POLAR_ACCESS_TOKEN`) |
| Click | 302, click count increments (fixture listing allowed if live pay is blocked) |
| Unknown city | 404 `city_unknown` |

Missing Polar secret is not a license to invent a paid rank.

---

## 13. Layout

```
/
  SPEC.md
  BUILD.md
  README.md
  CONTRIBUTING.md
  scripts/test.sh
  src/                 # later PRs
  tests/
  docs/live-smoke.md   # live-smoke PR
```

---

## 14. Git collaboration (normative)

Development is GitHub trunk-based. **`main` is always cloneable, buildable, and testable.**

| Rule | Requirement |
|---|---|
| Integration branch | `main` only. No long-lived `develop`. |
| How code lands | Pull request into `main`. No direct push. |
| Required check | GitHub Actions workflow `ci` (job id `ci`) must be green. |
| Local / CI test | `bash scripts/test.sh` — offline, no production secrets. |
| Branch names | `feat/` `fix/` `docs/` `chore/` `test/` + short slug. |
| Merge | Squash. Delete the head branch. |
| Broken `main` | Treat as an incident. Fix on `fix/…` via PR. |

Full process: [CONTRIBUTING.md](./CONTRIBUTING.md).

Implementation plan (stack, modules, PR DAG): [BUILD.md](./BUILD.md).

Until there is an application binary, `scripts/test.sh` still has to pass: contract files exist, SPEC/CONTRIBUTING agree, no tracked secrets. Adding a server means **extending** that script with unit/contract tests. Live Polar calls are optional and must not be required for `main` to stay green.
