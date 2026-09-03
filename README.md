# City Weekend Spot

Build contract: [SPEC.md](./SPEC.md).  
How we work: [CONTRIBUTING.md](./CONTRIBUTING.md). `main` stays buildable and testable.  
How we build: [BUILD.md](./BUILD.md) — stack, modules, tests, PR sequence.

Per-city weekend board for the #1 Friday/Saturday slot (restaurant, bar, show). NYC is the v1 lane. Rank is money, not stars. No fake reviews. The weekly label is Thursday-anchored, but valid Claim rank submissions are available any time; paid placements remain eligible for seven days.

Clone of [outbid.lol](https://outbid.lol/) mechanics: public board, USD whole dollars, min $5, older wins ties, raise pays the difference, Waffo Pancake + fixture.

```bash
bash scripts/test.sh
```

`GET /` directly renders the canonical NYC board. `/nyc` remains a compatibility alias whose canonical URL is `/`. The empty board is truthful until a Waffo payment completes, and the Claim rank button enables only after a valid venue/booking URL is entered. Waffo production credentials and network access are never required to keep `main` green; the retired `/api/polar/webhook` path is inert.
