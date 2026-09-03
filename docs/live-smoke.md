# Live smoke — City Weekend Spot

Operator-only. `bash scripts/live-smoke.sh` is not called from `scripts/test.sh` or GitHub Actions. The smoke is deliberately offline: it starts the same handlers in fixture mode, never calls Waffo, and never treats a missing provider secret as a successful checkout.

## How to run

```bash
bash scripts/live-smoke.sh
```

The script refuses CI, always starts its own isolated fixture process on loopback with a disposable file-backed SQLite database, and checks `/healthz`, canonical `/`, the `/nyc` compatibility alias, `/about`, `/rules`, `/api/checkout`, the read-only `/checkout/complete?intent=...` route, canonical `/api/waffo/webhook`, retired `/api/polar/webhook` (410), `/api/click/:id`, and unknown-city handling. It then removes only its own temporary process and work directory. It never attaches to an existing process, makes provider traffic, or accepts an external base override; that boundary is enforced before dependency installation or HTTP.

The checkout probe is fixture-only and records `PASS` only when an unpaid intent is not ranked. The click hop uses an explicit fixture settlement so the smoke can verify redirect stripping and click persistence without inventing a paid rank. No Waffo credentials, dashboard action, charge, refund, or live request is accepted by this script.

`LIVE_SMOKE_PORT` optionally selects the loopback fixture's temporary process port and must be a decimal TCP port from 1 through 65535. Malformed or occupied ports fail before any route request; the readiness token also proves that the responding process is the child started by this script. A production Waffo callback must be configured as an origin-only HTTPS URL; local smoke uses loopback only for its server bind and does not exercise production configuration.

## Verdicts

| Label | Meaning |
|---|---|
| `PASS` | The offline route or data-flow contract completed. |
| `PASS-ERROR` | A documented product validation error (for example, a below-minimum bid) occurred without mutation or invented rank. |
| `BLOCKED-SECRET` | Reserved for an explicitly missing secret in a separate operator check; this offline script does not emit it. |
| `FAIL` | A route, persistence, privacy, or ranking contract failed. |

The smoke is not a substitute for the signed Waffo acceptance suite. Canonical settlement belongs only to `POST /api/waffo/webhook`; `POST` and `GET /api/polar/webhook` return 410 and never read or settle a body.

## What this does not do

- It does not call `scripts/live-smoke.sh` from `scripts/test.sh` or Actions.
- It does not configure or invoke a live Waffo account.
- It does not seed a fake paid NYC #1, star ratings, or reviews.
- It does not settle from `/checkout/complete` or any browser-controlled query.
