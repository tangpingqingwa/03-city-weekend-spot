export type PolarEnv = Record<string, string | undefined>;

/** Live Polar only when POLAR_LIVE=1. Unset / 0 / true stay fixture. */
export function polarLiveEnabled(env: PolarEnv = process.env): boolean {
  if (env.POLAR_FIXTURE_ONLY === "1") return false;
  return env.POLAR_LIVE === "1";
}

export function polarAccessToken(env: PolarEnv = process.env): string | undefined {
  const token = env.POLAR_ACCESS_TOKEN?.trim();
  return token ? token : undefined;
}

export function polarWebhookSecret(env: PolarEnv = process.env): string | undefined {
  const secret = env.POLAR_WEBHOOK_SECRET?.trim();
  return secret ? secret : undefined;
}

/** Optional Polar product. Sandbox checkout requires product_id. */
export function polarProductId(env: PolarEnv = process.env): string | undefined {
  const id = env.POLAR_PRODUCT_ID?.trim();
  return id ? id : undefined;
}

/** Default production host. Operator smoke may set POLAR_API_BASE to sandbox. */
export function polarApiBase(env: PolarEnv = process.env): string {
  const fromEnv = env.POLAR_API_BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `https://${["api", "polar", "sh"].join(".")}`;
}

export function publicBaseUrl(env: PolarEnv = process.env): string {
  const raw = env.PUBLIC_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:3000";
}
