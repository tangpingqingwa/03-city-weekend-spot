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
  // Normalize every terminal dot before host-policy checks. WHATWG URL keeps
  // repeated DNS root-label dots, and leaving one behind would let values such
  // as `t.me..` or `onlyfans.com...` bypass exact/subdomain denylist matches.
  return parsed.hostname.toLowerCase().replace(/\.+$/, "");
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
  const lowered = host.toLowerCase().replace(/\.+$/, "");
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
  const normalized = host
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");
  const isIpv6 = normalized.includes(":");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    (isIpv6 && (
      normalized === "::" ||
      normalized === "::1" ||
      /^fe[89a-f]/.test(normalized) ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("ff") ||
      normalized === "2001:db8" ||
      normalized.startsWith("2001:db8:")
    ))
  ) {
    return true;
  }
  if (isIpv6) {
    const mappedDotted = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mappedDotted) return isUnusableHost(mappedDotted[1]);
    const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const first = Number.parseInt(mappedHex[1], 16);
      const second = Number.parseInt(mappedHex[2], 16);
      return isUnusableHost(
        `${first >> 8}.${first & 0xff}.${second >> 8}.${second & 0xff}`,
      );
    }
  }
  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map(Number);
  if (octets.some((part) => part > 255)) return true;
  const [a, b] = octets as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && b >= 18 && b <= 19) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function stripTracking(parsed: URL): void {
  for (const key of [...parsed.searchParams.keys()]) {
    if (isTrackingQueryKey(key)) {
      parsed.searchParams.delete(key);
    }
  }
}

const BARE_HOST_WITH_PORT =
  /^(?:(?:[a-z0-9](?:[a-z0-9-]*\.)+[a-z]{2,}|localhost|(?:\d{1,3}\.){3}\d{1,3}):\d+)(?:[/?#]|$)/i;

/**
 * URL accepts a hostname without a scheme only when it is given a base URL.
 * Booking URLs are entered by people, so a bare domain is a useful shorthand;
 * add the one safe scheme before parsing it. Explicit schemes stay untouched
 * so `http:`, `javascript:`, and other non-https values continue to fail
 * through the checks below instead of being silently upgraded. A dotted host
 * followed by a numeric port is the one bare-host shape that looks like a
 * scheme to the WHATWG parser (`book.example:8443/path`).
 */
function parseableBookingUrl(raw: string): string {
  if (raw.startsWith("//")) {
    // Backslashes are treated as authority/path separators by the WHATWG
    // parser for special schemes. Do not let protocol-relative shorthand
    // reinterpret `//\\evil.com` or `//evil.com\\path` after prefixing HTTPS.
    if (raw.slice(2).includes("\\")) return raw;
    return `https:${raw}`;
  }

  // The WHATWG parser reads `book.example.com:8443` as a scheme named
  // `book.example.com`; recognize only plausible host/port authorities here.
  // Numeric-leading IPv4 and bracketed IPv6 values fall through to the normal
  // no-scheme path, while `ftp:123`, `data:123`, and `javascript:123` stay
  // explicit schemes and are rejected below.
  if (BARE_HOST_WITH_PORT.test(raw)) {
    return `https://${raw}`;
  }

  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(raw);
  if (!scheme) return `https://${raw}`;
  return raw;
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
  // Reject before WHATWG URL parsing, which otherwise normalizes backslashes
  // into slashes and can change the authority represented by user input.
  if (trimmed.includes("\\")) {
    throw new UrlError("url_forbidden");
  }

  let parsed: URL;
  try {
    parsed = new URL(parseableBookingUrl(trimmed));
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
