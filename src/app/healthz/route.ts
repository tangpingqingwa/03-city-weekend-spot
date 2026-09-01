import { NextResponse } from "next/server";
import { assertRuntimeReadiness } from "../../config";
import { getDb } from "../../db";

export type HealthzOk = {
  ok: true;
};

export type HealthzError = {
  ok: false;
  error: "configuration_unavailable";
};

export function GET(): NextResponse<HealthzOk | HealthzError> {
  try {
    const mode = assertRuntimeReadiness();
    if (mode !== "fixture") getDb();
    return NextResponse.json({ ok: true } satisfies HealthzOk);
  } catch {
    // Do not disclose which secret or path is missing through a public probe.
    return NextResponse.json(
      { ok: false, error: "configuration_unavailable" } satisfies HealthzError,
      { status: 503 },
    );
  }
}
