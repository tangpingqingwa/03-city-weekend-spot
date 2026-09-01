import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { createPrivateKey, createPublicKey } from "node:crypto";

export type WaffoEnv = Record<string, string | undefined>;
export type WaffoMode = "waffo-test" | "waffo-prod";

export const DEFAULT_WAFFO_API_BASE = "https://api.waffo.ai";

/** Polar flags are compatibility debris and never select a provider. */
export function polarFixtureOnly(_env: WaffoEnv = process.env): boolean {
  return false;
}

export function isWaffoLive(env: WaffoEnv = process.env): boolean {
  return env.PAYMENT_MODE === "waffo-test" || env.PAYMENT_MODE === "waffo-prod";
}

export function waffoApiBase(env: WaffoEnv = process.env): string {
  const value = env.WAFFO_API_BASE?.trim();
  return (value || DEFAULT_WAFFO_API_BASE).replace(/\/$/, "");
}

export function isMemoryDatabasePath(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === ":memory:" || normalized.startsWith("file::memory:") || normalized.includes("mode=memory");
}

/** URL parsers normalize an explicit :443/:80 away; retain the raw authority check. */
export function hasExplicitPort(value: string): boolean {
  const authority = value.trim().match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1];
  if (!authority) return false;
  const hostPort = authority.slice(authority.lastIndexOf("@") + 1);
  if (hostPort.startsWith("[")) {
    const close = hostPort.indexOf("]");
    return close >= 0 && hostPort.slice(close + 1).startsWith(":");
  }
  return hostPort.includes(":");
}

/** Hosts that must never receive a provider redirect or production callback. */
export function isPrivateOrLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) return true;
  const version = isIP(normalized);
  if (version === 4) {
    const octets = normalized.split(".").map(Number);
    const [first, second] = octets;
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0) ||
      (first === 192 && second === 168) ||
      (first === 198 && second >= 18 && second <= 19) ||
      (first === 198 && second === 51) ||
      (first === 203 && second === 0) ||
      first >= 224
    );
  }
  if (version === 6) {
    const mappedDotted = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mappedDotted) return isPrivateOrLocalHostname(mappedDotted[1]);
    const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const first = Number.parseInt(mappedHex[1], 16);
      const second = Number.parseInt(mappedHex[2], 16);
      return isPrivateOrLocalHostname(`${first >> 8}.${first & 0xff}.${second >> 8}.${second & 0xff}`);
    }
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8")
    );
  }
  return false;
}

export function isReservedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return (
    isPrivateOrLocalHostname(normalized) ||
    normalized === "example.com" ||
    normalized.endsWith(".example.com") ||
    normalized === "example.net" ||
    normalized.endsWith(".example.net") ||
    normalized === "example.org" ||
    normalized.endsWith(".example.org") ||
    normalized === "invalid" ||
    normalized.endsWith(".invalid") ||
    normalized === "test" ||
    normalized.endsWith(".test")
  );
}

export function waffoPrivateKey(env: WaffoEnv = process.env): string {
  const inline = env.WAFFO_PRIVATE_KEY?.trim();
  if (inline) return inline.replace(/\\n/g, "\n");
  const file = env.WAFFO_PRIVATE_KEY_FILE?.trim();
  if (file) {
    try {
      const value = readFileSync(file, "utf8").trim();
      if (value) return value;
    } catch {
      throw new Error("BLOCKED-CONFIG: WAFFO_PRIVATE_KEY_FILE");
    }
  }
  throw new Error("BLOCKED-CONFIG: WAFFO_PRIVATE_KEY");
}

export function requireWaffoSecret(
  name: "WAFFO_MERCHANT_ID" | "WAFFO_PRODUCT_ID" | "WAFFO_STORE_ID",
  env: WaffoEnv = process.env,
): string {
  const value = env[name]?.trim();
  const prefix = name === "WAFFO_MERCHANT_ID" ? "MER" : name === "WAFFO_STORE_ID" ? "STO" : "PROD";
  if (!value || !new RegExp(`^${prefix}_[A-Za-z0-9]{22}$`).test(value)) throw new Error(`BLOCKED-CONFIG: ${name}`);
  return value;
}

export function waffoWebhookPublicKey(env: WaffoEnv = process.env, mode: WaffoMode): string | undefined {
  const modeKey = mode === "waffo-prod" ? env.WAFFO_WEBHOOK_PROD_PUBLIC_KEY : env.WAFFO_WEBHOOK_TEST_PUBLIC_KEY;
  return modeKey?.replace(/\\n/g, "\n").trim() || undefined;
}

export function waffoPublicBaseUrl(env: WaffoEnv = process.env): string {
  const explicit = env.WAFFO_PUBLIC_BASE_URL?.trim();
  const alias = env.PUBLIC_BASE_URL?.trim();
  if (explicit && alias && explicit !== alias) throw new Error("BLOCKED-CONFIG: PUBLIC_BASE_URL aliases disagree");
  const value = explicit ?? alias;
  if (!value) throw new Error("BLOCKED-CONFIG: PUBLIC_BASE_URL");
  return value.replace(/\/$/, "");
}

export function requireWaffoConfig(
  env: WaffoEnv,
  mode: WaffoMode,
  injectedWebhookPublicKey?: string,
): {
  merchantId: string;
  storeId: string;
  productId: string;
  privateKey: string;
  publicBaseUrl: string;
  webhookPublicKey?: string;
} {
  const merchantId = requireWaffoSecret("WAFFO_MERCHANT_ID", env);
  const storeId = requireWaffoSecret("WAFFO_STORE_ID", env);
  const productId = requireWaffoSecret("WAFFO_PRODUCT_ID", env);
  const privateKey = waffoPrivateKey(env);
  const publicBaseUrl = waffoPublicBaseUrl(env);
  const apiBase = waffoApiBase(env);
  let apiUrl: URL;
  try {
    apiUrl = new URL(apiBase);
  } catch {
    throw new Error("BLOCKED-CONFIG: WAFFO_API_BASE");
  }
  if (mode === "waffo-prod" && (apiUrl.protocol !== "https:" || apiUrl.hostname !== "api.waffo.ai" || apiUrl.username || apiUrl.password || hasExplicitPort(apiBase) || apiUrl.pathname !== "/" || apiUrl.search || apiUrl.hash)) {
    throw new Error("BLOCKED-CONFIG: WAFFO_API_BASE must be the official HTTPS Waffo origin in waffo-prod");
  }
  let publicUrl: URL;
  try {
    publicUrl = new URL(publicBaseUrl);
  } catch {
    throw new Error("BLOCKED-CONFIG: PUBLIC_BASE_URL");
  }
  if (
    mode === "waffo-prod" &&
    (
      publicUrl.protocol !== "https:" ||
      !publicUrl.hostname ||
      publicUrl.username ||
      publicUrl.password ||
      hasExplicitPort(publicBaseUrl) ||
      publicUrl.pathname !== "/" ||
      publicUrl.search ||
      publicUrl.hash ||
      isReservedHostname(publicUrl.hostname)
    )
  ) {
    throw new Error("BLOCKED-CONFIG: PUBLIC_BASE_URL must be an origin-only public HTTPS URL in waffo-prod");
  }
  const webhookPublicKey = injectedWebhookPublicKey?.trim() || waffoWebhookPublicKey(env, mode);
  if (!webhookPublicKey) {
    throw new Error(`BLOCKED-CONFIG: ${mode === "waffo-prod" ? "WAFFO_WEBHOOK_PROD_PUBLIC_KEY" : "WAFFO_WEBHOOK_TEST_PUBLIC_KEY"}`);
  }
  const databasePath = env.DATABASE_PATH?.trim();
  if (!databasePath || isMemoryDatabasePath(databasePath)) {
    throw new Error("BLOCKED-CONFIG: DATABASE_PATH");
  }
  try {
    if (createPrivateKey(privateKey).asymmetricKeyType !== "rsa") throw new Error("not rsa");
  } catch {
    throw new Error("BLOCKED-CONFIG: WAFFO_PRIVATE_KEY");
  }
  try {
    if (createPublicKey(webhookPublicKey).asymmetricKeyType !== "rsa") throw new Error("not rsa");
  } catch {
    throw new Error(`BLOCKED-CONFIG: ${mode === "waffo-prod" ? "WAFFO_WEBHOOK_PROD_PUBLIC_KEY" : "WAFFO_WEBHOOK_TEST_PUBLIC_KEY"}`);
  }
  return { merchantId, storeId, productId, privateKey, publicBaseUrl, webhookPublicKey };
}

/** Compatibility assertion used by old imports; production config is strict. */
export function requireWaffoLiveSecrets(env: WaffoEnv = process.env): void {
  requireWaffoConfig(env, "waffo-prod");
}
