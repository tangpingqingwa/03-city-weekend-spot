# City Weekend Spot

Build contract: [SPEC.md](./SPEC.md).  
How we work: [CONTRIBUTING.md](./CONTRIBUTING.md). `main` stays buildable and testable.  
How we build: [BUILD.md](./BUILD.md) — stack, modules, tests, PR sequence.

Per-city weekend auction for the #1 Friday/Saturday slot (restaurant, bar, show). NYC is the v1 lane. Rank is money, not stars. No fake reviews.

Clone of [outbid.lol](https://outbid.lol/) mechanics: public board, USD whole dollars, min $5, older wins ties, raise pays the difference, Polar + fixture.

```bash
bash scripts/test.sh
```

`GET /healthz` returns `{ ok: true }`. Live Polar is never required to keep `main` green.
