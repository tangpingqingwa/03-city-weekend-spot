/** Canonical booking URL: https only, tracking stripped, chat/NSFW rejected. */

export class UrlError extends Error {
  constructor(
    readonly code: "url_insecure" | "url_forbidden",
    readonly httpStatus = 400,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "UrlError";
  }
}

/** Exact tracking / affiliate keys. `utm_*` and `ref_` are prefix-matched. */
export const TRACKING_QUERY_KEYS: readonly string[] = [
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "ref",
  "affiliate",
  "aff",
  "irclickid",
  "mc_cid",
  "mc_eid",
  "icid",
];

const TRACKING_KEY_SET = new Set(TRACKING_QUERY_KEYS);

/** Chat / invite hosts. Subdomains match. `discord.com` only `/invite`. */
export const CHAT_HOSTS: readonly string[] = [
  "t.me",
  "telegram.me",
  "telegram.org",
  "telegram.dog",
  "wa.me",
  "chat.whatsapp.com",
  "discord.gg",
  "m.me",
];

/** Known adult hosts. Subdomains match. Keep it boring. */
export const NSFW_HOSTS: readonly string[] = [
  "onlyfans.com",
  "fansly.com",
  "pornhub.com",
  "pornhub.org",
  "pornhubpremium.com",
  "xvideos.com",
  "xnxx.com",
  "xhamster.com",
  "chaturbate.com",
  "stripchat.com",
  "manyvids.com",
  "redtube.com",
  "youporn.com",
  "brazzers.com",
  "adultfriendfinder.com",
  "spankbang.com",
];

/** Obvious NSFW path tokens. Documented here so the reject list stays boring. */
export const NSFW_PATH_TOKENS: readonly string[] = [
  "porn",
  "porno",
  "xxx",
  "nsfw",
  "onlyfans",
  "fansly",
  "hentai",
  "escort",
  "escorts",
  "camgirl",
  "camgirls",
  "nude",
  "nudes",
];

const NSFW_PATH_TOKEN_SET = new Set(NSFW_PATH_TOKENS);

const NSFW_COPY_RE =
  /\b(porn|porno|xxx|nsfw|onlyfans|fansly|hentai|escort|escorts|camgirl|camgirls|nude|nudes|naked)\b/i;

function hostMatches(host: string, listed: string): boolean {
  return host === listed || host.endsWith(`.${listed}`);
}

function hostnameOf(parsed: URL): string {
  return parsed.hostname.toLowerCase().replace(/\.$/, "");
}

export function isTrackingQueryKey(key: string): boolean {
  const lowered = key.toLowerCase();
  if (lowered.startsWith("utm_")) return true;
  if (lowered.startsWith("ref_")) return true;
  return TRACKING_KEY_SET.has(lowered);
}

export function isChatUrl(parsed: URL): boolean {
  const host = hostnameOf(parsed);
  if (CHAT_HOSTS.some((listed) => hostMatches(host, listed))) {
    return true;
  }
  if (hostMatches(host, "discord.com")) {
    const path = parsed.pathname.toLowerCase();
    return path === "/invite" || path.startsWith("/invite/");
  }
  return false;
}

export function isNsfwHost(host: string): boolean {
  const lowered = host.toLowerCase().replace(/\.$/, "");
  if (NSFW_HOSTS.some((listed) => hostMatches(lowered, listed))) {
    return true;
  }
  return lowered.split(".").some((label) => NSFW_PATH_TOKEN_SET.has(label));
}

export function isNsfwPath(path: string): boolean {
  return path
    .toLowerCase()
    .split("/")
    .some((segment) => NSFW_PATH_TOKEN_SET.has(segment));
}

export function isNsfwCopy(raw: string): boolean {
  return NSFW_COPY_RE.test(raw);
}

function isUnusableHost(host: string): boolean {
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host === "[::1]" ||
    host.startsWith("fe80:")
  ) {
    return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map(Number);
  if (octets.some((part) => part > 255)) return false;
  const [a, b] = octets as [number, number, number, number];
  if (a === 0 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function stripTracking(parsed: URL): void {
  for (const key of [...parsed.searchParams.keys()]) {
    if (isTrackingQueryKey(key)) {
      parsed.searchParams.delete(key);
    }
  }
}

/**
 * Require https, drop fragment, strip tracking keys, reject chat / NSFW /
 * credentials / localhost. Store and display this URL only.
 */
export function canonicalizeBookingUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < 1) {
    throw new UrlError("url_insecure");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UrlError("url_insecure");
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol === "javascript:" || protocol === "data:") {
    throw new UrlError("url_forbidden");
  }
  if (protocol !== "https:") {
    throw new UrlError("url_insecure");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new UrlError("url_forbidden");
  }

  const host = hostnameOf(parsed);
  if (!host || isUnusableHost(host)) {
    throw new UrlError("url_forbidden");
  }
  if (isChatUrl(parsed) || isNsfwHost(host) || isNsfwPath(parsed.pathname)) {
    throw new UrlError("url_forbidden");
  }

  parsed.hash = "";
  parsed.hostname = host;
  if (parsed.port === "443") {
    parsed.port = "";
  }
  stripTracking(parsed);
  return parsed.toString();
}
