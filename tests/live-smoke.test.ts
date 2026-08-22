import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("live-smoke.sh is executable and operator-only", () => {
  const scriptPath = join(ROOT, "scripts/live-smoke.sh");
  assert.equal(existsSync(scriptPath), true);
  const mode = statSync(scriptPath).mode;
  assert.equal(mode & 0o111, 0o111, "scripts/live-smoke.sh must be executable");

  const script = read("scripts/live-smoke.sh");
  assert.match(script, /BLOCKED-SECRET: POLAR_ACCESS_TOKEN/);
  assert.match(script, /POLAR_LIVE/);
  assert.match(script, /live-smoke refuses CI=true/);
  assert.match(script, /live-smoke must not run in GitHub Actions/);
  assert.match(script, /\/nyc/);
  assert.match(script, /\/about/);
  assert.match(script, /\/rules/);
  assert.match(script, /\/api\/checkout/);
  assert.match(script, /\/api\/click\//);
  assert.match(script, /city_unknown/);
  assert.match(script, /\/london/);
  assert.match(script, /no invented paid rank|Do not invent a paid rank/i);
  assert.doesNotMatch(script, /invented paid #1/);
});

test("docs/live-smoke.md records verdict labels and is not a paid-rank invention", () => {
  const docs = read("docs/live-smoke.md");
  assert.match(docs, /PASS/);
  assert.match(docs, /PASS-ERROR/);
  assert.match(docs, /BLOCKED-SECRET/);
  assert.match(docs, /FAIL/);
  assert.match(docs, /scripts\/live-smoke\.sh/);
  assert.match(
    docs,
    /not\*\* called from `scripts\/test\.sh`|not called from `scripts\/test\.sh`/i,
  );
  assert.match(docs, /POLAR_ACCESS_TOKEN/);
  assert.match(docs, /NYC/);
  assert.doesNotMatch(docs, /invented paid #1|seeded fake #1/);
});

test("scripts/test.sh and CI stay offline and do not invoke live-smoke", () => {
  const testSh = read("scripts/test.sh");
  const ci = read(".github/workflows/ci.yml");

  assert.doesNotMatch(testSh, /^\s*(bash )?(\.\/)?scripts\/live-smoke\.sh/m);
  assert.doesNotMatch(testSh, /^(export )?POLAR_LIVE=1/m);
  assert.match(testSh, /must not invoke live-smoke/);
  assert.match(testSh, /unset POLAR_LIVE POLAR_ACCESS_TOKEN POLAR_WEBHOOK_SECRET/);
  assert.match(testSh, /POLAR_FIXTURE_ONLY=1/);

  assert.doesNotMatch(ci, /live-smoke/);
  assert.doesNotMatch(ci, /POLAR_LIVE/);
  assert.doesNotMatch(ci, /POLAR_ACCESS_TOKEN/);
  assert.match(ci, /bash scripts\/test\.sh/);
});
