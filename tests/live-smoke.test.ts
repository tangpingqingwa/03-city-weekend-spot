import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROVIDER_SELECTOR_NAMES = [
  "PAYMENT_MODE",
  "WAFFO_MODE",
  "WAFFO_LIVE",
  "WAFFO_API_BASE",
  "WAFFO_PUBLIC_BASE_URL",
  "PUBLIC_BASE_URL",
  "WAFFO_CHECKOUT_TIMEOUT_MS",
  "DATABASE_PATH",
  "WAFFO_PRIVATE_KEY",
  "WAFFO_PRIVATE_KEY_FILE",
  "WAFFO_MERCHANT_ID",
  "WAFFO_STORE_ID",
  "WAFFO_PRODUCT_ID",
  "WAFFO_WEBHOOK_PUBLIC_KEY",
  "WAFFO_WEBHOOK_TEST_PUBLIC_KEY",
  "WAFFO_WEBHOOK_PROD_PUBLIC_KEY",
  "POLAR_LIVE",
  "POLAR_ACCESS_TOKEN",
  "POLAR_WEBHOOK_SECRET",
  "POLAR_API_BASE",
  "POLAR_PRODUCT_ID",
  "POLAR_SUCCESS_URL",
  "POLAR_FIXTURE_ONLY",
] as const;

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function runSmoke(extraEnv: Record<string, string> = {}) {
  return spawnSync("bash", ["scripts/live-smoke.sh"], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "",
      GITHUB_ACTIONS: "",
      LIVE_SMOKE_ALLOW_CI: "",
      LIVE_SMOKE_PORT: "",
      ...extraEnv,
    },
  });
}

test("live-smoke.sh is executable, offline, and exercises the Waffo route contract", () => {
  const scriptPath = join(ROOT, "scripts/live-smoke.sh");
  assert.equal(existsSync(scriptPath), true);
  const mode = statSync(scriptPath).mode;
  assert.equal(mode & 0o111, 0o111, "scripts/live-smoke.sh must be executable");

  const script = read("scripts/live-smoke.sh");
  assert.match(script, /PAYMENT_MODE=fixture/);
  assert.ok(script.includes("/api/waffo/webhook"));
  assert.ok(script.includes("/checkout/complete"));
  assert.match(script, /polar_webhook_retired/);
  assert.match(script, /live-smoke refuses CI=true/);
  assert.match(script, /live-smoke must not run in GitHub Actions/);
  assert.match(script, /LIVE_SMOKE_BASE is unsupported/);
  assert.match(script, /starting isolated loopback fixture process/);
  assert.doesNotMatch(script, /assuming existing server/);
  assert.match(script, /LIVE_SMOKE_PORT must be a decimal TCP port from 1 to 65535/);
  assert.match(script, /live-smoke ready pid=/);
  assert.match(script, /fixture child ownership was not proven before request/);
  assert.match(script, /POLAR_SUCCESS_URL/);
  assert.match(script, /POLAR_FIXTURE_ONLY/);
  assert.match(script, /GET \/ 200 canonical NYC board/);
  assert.doesNotMatch(script, /expected 302 \/nyc|window closed/);
  assert.ok(script.includes("/nyc"));
  assert.ok(script.includes("/about"));
  assert.ok(script.includes("/rules"));
  assert.ok(script.includes("/api/checkout"));
  assert.ok(script.includes("/api/click/"));
  assert.match(script, /city_unknown/);
  assert.ok(script.includes("/london"));
  assert.match(script, /no invented paid rank|Do not invent a paid rank/i);
  assert.doesNotMatch(script, /POLAR_LIVE=1|POLAR_ACCESS_TOKEN=|sandbox\.polar\.sh|POLAR_API_BASE=/);
  assert.doesNotMatch(script, /invented paid #1/);
});

test("live-smoke rejects remote and userinfo base overrides before starting or requesting", () => {
  for (const base of [
    "https://remote.example.invalid",
    "http://smoke-user:smoke-token@127.0.0.1:1",
  ]) {
    const result = runSmoke({ LIVE_SMOKE_BASE: base });
    assert.notEqual(result.status, 0, `unexpectedly accepted ${base}`);
    const output = `${result.stdout}${result.stderr}`;
    assert.match(output, /LIVE_SMOKE_BASE is unsupported/);
    assert.doesNotMatch(output, /starting isolated loopback fixture process|live-smoke listening|RESULT\t/);
    assert.doesNotMatch(output, /remote\.example\.invalid|smoke-user:smoke-token/);
  }
});

test("live-smoke rejects malformed, out-of-range, and authority-bearing ports before startup", () => {
  for (const port of [
    "443@remote.example.invalid",
    "1/path",
    "+80",
    "0",
    "00000",
    "65536",
    "99999",
  ]) {
    const result = runSmoke({ LIVE_SMOKE_PORT: port });
    assert.notEqual(result.status, 0, `unexpectedly accepted ${port}`);
    const output = `${result.stdout}${result.stderr}`;
    assert.match(output, /LIVE_SMOKE_PORT must be a decimal TCP port from 1 to 65535/);
    assert.doesNotMatch(output, /starting isolated loopback fixture process|live-smoke ready|RESULT\t/);
    assert.doesNotMatch(output, /remote\.example\.invalid/);
  }
});

test("live-smoke fails on an occupied port instead of accepting another service", async () => {
  const blocker = createServer();
  await new Promise<void>((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, "127.0.0.1", () => resolve());
  });
  const address = blocker.address();
  assert.ok(address && typeof address !== "string");
  try {
    const result = runSmoke({ LIVE_SMOKE_PORT: String(address.port) });
    assert.notEqual(result.status, 0);
    const output = `${result.stdout}${result.stderr}`;
    assert.match(output, /local fixture process did not become healthy/);
    assert.match(output, /EADDRINUSE/);
    assert.doesNotMatch(output, /RESULT\t/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      blocker.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("fixture child scrubs inherited Polar and Waffo selectors without logging sentinels", () => {
  const sentinelEnv = Object.fromEntries(
    PROVIDER_SELECTOR_NAMES.map((name) => [name, `sentinel-${name}`]),
  );
  const result = runSmoke(sentinelEnv);
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  const output = `${result.stdout}${result.stderr}`;
  assert.match(output, /PASS=7 PASS-ERROR=1 BLOCKED-SECRET=0 FAIL=0/);
  assert.doesNotMatch(output, /sentinel-/);
});

test("docs/live-smoke.md records verdict labels and Waffo-only ownership", () => {
  const docs = read("docs/live-smoke.md");
  assert.match(docs, /PASS/);
  assert.match(docs, /PASS-ERROR/);
  assert.match(docs, /BLOCKED-SECRET/);
  assert.match(docs, /FAIL/);
  assert.match(docs, /scripts\/live-smoke\.sh/);
  assert.match(docs, /not called from `scripts\/test\.sh`|not\*\* called from `scripts\/test\.sh`/i);
  assert.match(docs, /Waffo/);
  assert.match(docs, /\/api\/waffo\/webhook/);
  assert.match(docs, /\/checkout\/complete/);
  assert.match(docs, /\/api\/polar\/webhook.*410|410.*\/api\/polar\/webhook/s);
  assert.match(docs, /always starts its own isolated fixture process on loopback/);
  assert.match(docs, /disposable file-backed SQLite/);
  assert.match(docs, /never attaches to an existing process, makes provider traffic/);
  assert.doesNotMatch(docs, /LIVE_SMOKE_BASE/);
  assert.doesNotMatch(docs, /POLAR_ACCESS_TOKEN|POLAR_LIVE|sandbox\.polar\.sh/);
  assert.doesNotMatch(docs, /invented paid #1|seeded fake #1/);
});

test("CI provider guard covers YAML mappings and shell assignments for every selector", () => {
  const testSh = read("scripts/test.sh");
  assert.match(testSh, /ci_provider_selector_re/);
  assert.match(testSh, /\[:=\]/);
  for (const name of PROVIDER_SELECTOR_NAMES) {
    assert.match(testSh, new RegExp(`\\b${name}\\b`), `${name} missing from CI guard`);
  }
  const syntheticWorkflow = [
    "env:",
    "  PAYMENT_MODE: waffo-prod",
    "  WAFFO_MODE: waffo-prod",
    "  WAFFO_PRIVATE_KEY: ${{ secrets.WAFFO_PRIVATE_KEY }}",
    "  DATABASE_PATH: /srv/app.sqlite",
    "run: WAFFO_API_BASE=https://api.waffo.ai",
  ].join("\\n");
  const assignmentOrMapping = new RegExp(
    `(?:^|[\\s\"'])(?:${PROVIDER_SELECTOR_NAMES.join("|")})(?:[\\s\"']*[:=])`,
    "im",
  );
  assert.match(syntheticWorkflow, assignmentOrMapping);
});

test("scripts/test.sh and CI stay offline and do not invoke live-smoke", () => {
  const testSh = read("scripts/test.sh");
  const ci = read(".github/workflows/ci.yml");

  assert.doesNotMatch(testSh, /^\s*(bash )?(\.\/)?scripts\/live-smoke\.sh/m);
  assert.doesNotMatch(testSh, /^(export )?POLAR_LIVE=1/m);
  assert.match(testSh, /must not invoke live-smoke/);
  assert.match(testSh, /PAYMENT_MODE/);
  assert.match(testSh, /WAFFO/);
  assert.match(testSh, /export PAYMENT_MODE=fixture/);

  assert.doesNotMatch(ci, /live-smoke/);
  assert.doesNotMatch(ci, /POLAR_LIVE/);
  assert.doesNotMatch(ci, /POLAR_ACCESS_TOKEN/);
  assert.match(ci, /bash scripts\/test\.sh/);
});
