import { requireWaffoConfig } from "./billing/waffo-session";

export type PaymentMode = "fixture" | "waffo-test" | "waffo-prod";
export type AppEnv = Record<string, string | undefined>;

/** Deployment systems expose different names for the same production boundary. */
export function isProductionLike(env: AppEnv = process.env): boolean {
  const values = [
    env.NODE_ENV,
    env.VERCEL_ENV,
    env.APP_ENV,
    env.DEPLOY_ENV,
    env.BUILD_ENV,
  ].map((value) => value?.trim().toLowerCase());
  return values.some((value) => value === "production" || value === "prod" || value === "live")
    || env.NEXT_PHASE?.trim() === "phase-production-build";
}

/** Configuration is explicit; an unset or legacy mode is a startup error. */
export function paymentMode(env: AppEnv = process.env): PaymentMode {
  const explicit = env.PAYMENT_MODE?.trim();
  const alias = env.WAFFO_MODE?.trim();
  if (alias) throw new Error("BLOCKED-CONFIG: WAFFO_MODE is retired; set PAYMENT_MODE");
  const mode = explicit;
  if (mode === "fixture") {
    if (isProductionLike(env)) throw new Error("BLOCKED-CONFIG: fixture mode is not allowed in production");
    return mode;
  }
  if (mode === "waffo-test" || mode === "waffo-prod") return mode;
  throw new Error("BLOCKED-CONFIG: PAYMENT_MODE must be fixture, waffo-test, or waffo-prod");
}

export function publicBaseUrl(env: AppEnv = process.env): string {
  const explicit = env.WAFFO_PUBLIC_BASE_URL?.trim();
  const alias = env.PUBLIC_BASE_URL?.trim();
  if (explicit && alias && explicit !== alias) throw new Error("BLOCKED-CONFIG: PUBLIC_BASE_URL aliases disagree");
  const value = explicit ?? alias;
  if (!value) throw new Error("BLOCKED-CONFIG: PUBLIC_BASE_URL");
  return value.replace(/\/$/, "");
}

export function durableDatabasePath(env: AppEnv = process.env): string {
  const value = env.DATABASE_PATH?.trim();
  if (!value || value === ":memory:" || value.toLowerCase().startsWith("file::memory:") || value.toLowerCase().includes("mode=memory")) throw new Error("BLOCKED-CONFIG: DATABASE_PATH");
  return value;
}

/** Shared request/readiness boundary used by health and mutation routes. */
export function assertRuntimeReadiness(env: AppEnv = process.env): PaymentMode {
  const mode = paymentMode(env);
  if (mode !== "fixture") requireWaffoConfig(env, mode);
  return mode;
}
