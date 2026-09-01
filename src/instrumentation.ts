import { assertRuntimeReadiness } from "./config";

/**
 * Fail before a production Next server accepts application traffic when its
 * payment/database boundary is not configured. Next skips this hook during
 * the production build phase, so offline builds can still use fixture mode.
 */
export function register(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  assertRuntimeReadiness();
}

/** Focused test seam for the same startup boundary without mutating process.env. */
export function assertApplicationReadiness(env: Record<string, string | undefined>): void {
  assertRuntimeReadiness(env);
}
