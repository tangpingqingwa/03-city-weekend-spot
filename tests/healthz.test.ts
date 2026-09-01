import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../src/app/healthz/route";
import { HEALTHZ_PATH } from "../src/core/route-contract";

test("GET /healthz returns 200 { ok: true }", async () => {
  assert.equal(HEALTHZ_PATH, "/healthz");

  const response = GET();
  const contentType = response.headers.get("content-type") ?? "";

  assert.equal(response.status, 200);
  assert.match(contentType, /^application\/json\b/);
  assert.deepEqual(await response.json(), { ok: true });
});
