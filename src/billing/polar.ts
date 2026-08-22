import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CheckoutKind,
  CheckoutRecord,
  CheckoutStart,
  CreateCheckoutInput,
  ListingDraft,
  PaidEvent,
  PaymentPort,
  PolarEnv,
  WebhookResult,
} from "./port";
import {
  polarAccessToken,
  polarLiveEnabled,
  polarWebhookSecret,
  publicBaseUrl,
} from "./port";

/** Only used when POLAR_LIVE=1. tests/ never fetch this host. */
export const POLAR_API_BASE = "https://api.polar.sh";

export type PolarPaymentOptions = {
  env?: PolarEnv;
  fetch?: typeof fetch;
};

/** Live Polar Checkout. Never constructed unless POLAR_LIVE=1. */
export class PolarPayment implements PaymentPort {
  readonly kind = "live" as const;
  private readonly env: PolarEnv;
  private readonly fetchFn: typeof fetch;
  private readonly sessions = new Map<string, CheckoutRecord>();

  constructor(options: PolarPaymentOptions = {}) {
    this.env = options.env ?? process.env;
    this.fetchFn = options.fetch ?? fetch;
    if (!polarLiveEnabled(this.env)) {
      throw new Error("PolarPayment requires POLAR_LIVE=1");
    }
    if (!polarAccessToken(this.env)) {
      throw new Error("BLOCKED-SECRET: POLAR_ACCESS_TOKEN");
    }
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutStart> {
    const token = this.requireToken();
    let response: Response;
    try {
      response = await this.fetchFn(`${POLAR_API_BASE}/v1/checkouts/`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          amount: input.amountUsd * 100,
          currency: "usd",
          success_url: `${publicBaseUrl(this.env)}/${input.listingDraft.city}/return?sessionId={CHECKOUT_ID}`,
          metadata: {
            city: input.listingDraft.city,
            windowId: input.listingDraft.windowId,
            venueName: input.listingDraft.venueName,
            bookingUrl: input.listingDraft.bookingUrl,
            venueKind: input.listingDraft.kind ?? "",
            pitch: input.listingDraft.pitch ?? "",
            amountUsd: String(input.amountUsd),
            kind: input.kind,
          },
        }),
      });
    } catch {
      throw new Error("polar_unavailable");
    }
    if (!response.ok) {
      throw new Error("polar_unavailable");
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const sessionId = readString(payload.id);
    const checkoutUrl = readString(payload.url);
    if (!sessionId || !checkoutUrl) {
      throw new Error("polar_unavailable");
    }
    this.sessions.set(sessionId, {
      sessionId,
      status: "open",
      checkoutUrl,
      listingDraft: { ...input.listingDraft },
      amountUsd: input.amountUsd,
      kind: input.kind,
    });
    return { checkoutUrl, sessionId };
  }

  getCheckout(sessionId: string): CheckoutRecord | undefined {
    const session = this.sessions.get(sessionId);
    return session
      ? { ...session, listingDraft: { ...session.listingDraft } }
      : undefined;
  }

  async completeCheckout(sessionId: string): Promise<PaidEvent> {
    throw new Error(`live Polar session ${sessionId} completes via webhook only`);
  }

  async abandonCheckout(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session && session.status === "open") {
      session.status = "abandoned";
    }
  }

  async handleWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookResult> {
    const secret = polarWebhookSecret(this.env);
    if (!secret) {
      throw new Error("BLOCKED-SECRET: POLAR_WEBHOOK_SECRET");
    }
    if (!verifyPolarSignature(rawBody, headers, secret)) {
      throw new Error("invalid Polar webhook signature");
    }
    const event = parseJson(rawBody);
    if (!isRecord(event)) {
      return { ignored: true };
    }
    const data = isRecord(event.data) ? event.data : event;
    const status = readString(data.status) ?? "";
    const sessionId = readString(data.id);
    if (!sessionId) {
      return { ignored: true };
    }
    if (status === "expired" || status === "failed" || status === "canceled") {
      await this.abandonCheckout(sessionId);
      return { ignored: true };
    }
    if (!isPaidStatus(status) && event.type !== "order.paid") {
      return { ignored: true };
    }
    const existing = this.sessions.get(sessionId);
    const listingDraft = existing?.listingDraft ?? draftFromMetadata(data);
    const amountUsd = existing?.amountUsd ?? draftAmount(data);
    if (!listingDraft || amountUsd === undefined) {
      return { ignored: true };
    }
    const paidAt = new Date().toISOString();
    const kind = existing?.kind ?? draftKind(data);
    this.sessions.set(sessionId, {
      sessionId,
      status: "paid",
      checkoutUrl: existing?.checkoutUrl ?? "",
      listingDraft,
      amountUsd,
      kind,
      paidAt,
    });
    return { sessionId, listingDraft, amountUsd, kind, paidAt };
  }

  private requireToken(): string {
    const token = polarAccessToken(this.env);
    if (!token) {
      throw new Error("BLOCKED-SECRET: POLAR_ACCESS_TOKEN");
    }
    return token;
  }
}

export function verifyPolarSignature(
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
): boolean {
  const id = header(headers, "webhook-id");
  const timestamp = header(headers, "webhook-timestamp");
  const signature = header(headers, "webhook-signature");
  if (!id || !timestamp || !signature) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");
  for (const part of signature.split(" ")) {
    const value = part.startsWith("v1,") ? part.slice(3) : part;
    if (safeEqual(value, expected)) {
      return true;
    }
  }
  return false;
}

function header(headers: Record<string, string>, name: string): string | undefined {
  const needle = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === needle && value.trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isPaidStatus(status: string): boolean {
  return (
    status === "succeeded" ||
    status === "paid" ||
    status === "confirmed" ||
    status === "complete"
  );
}

function parseJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function draftFromMetadata(data: Record<string, unknown>): ListingDraft | undefined {
  const metadata = isRecord(data.metadata) ? data.metadata : {};
  const city = readString(metadata.city);
  const windowId = readString(metadata.windowId);
  const venueName = readString(metadata.venueName);
  const bookingUrl = readString(metadata.bookingUrl);
  if (!city || !windowId || !venueName || !bookingUrl) return undefined;
  return {
    city,
    windowId,
    venueName,
    bookingUrl,
    kind: readKind(metadata.venueKind),
    pitch: readString(metadata.pitch) ?? null,
  };
}

function draftKind(data: Record<string, unknown>): CheckoutKind {
  const metadata = isRecord(data.metadata) ? data.metadata : {};
  return metadata.kind === "raise" ? "raise" : "create";
}

function draftAmount(data: Record<string, unknown>): number | undefined {
  const metadata = isRecord(data.metadata) ? data.metadata : {};
  const bidUsd = readInt(metadata.amountUsd) ?? readInt(metadata.bidUsd);
  if (bidUsd !== undefined) return bidUsd;
  const cents = readInt(data.amount);
  if (cents !== undefined && cents % 100 === 0) return cents / 100;
  return undefined;
}

function readKind(value: unknown): ListingDraft["kind"] {
  if (value === "restaurant" || value === "bar" || value === "show") return value;
  return null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function readInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return undefined;
}
