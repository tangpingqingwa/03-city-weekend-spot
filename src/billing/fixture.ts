import { randomUUID } from "node:crypto";
import type {
  CheckoutKind,
  CheckoutRecord,
  CheckoutStart,
  CreateCheckoutInput,
  ListingDraft,
  PaidEvent,
  PaymentPort,
  WebhookResult,
} from "./port";

type StoredCheckout = CheckoutRecord;

/** In-memory Polar. No network. Paid events list; abandon does not. */
export class FixturePayment implements PaymentPort {
  readonly kind = "fixture" as const;
  private readonly sessions = new Map<string, StoredCheckout>();

  reset(): void {
    this.sessions.clear();
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutStart> {
    if (!Number.isInteger(input.amountUsd) || input.amountUsd < 1) {
      throw new Error("bid_not_whole");
    }
    const sessionId = `fix_${randomUUID()}`;
    const checkoutUrl = fixtureCheckoutUrl(input.listingDraft.city, sessionId);
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
    return session ? copyCheckout(session) : undefined;
  }

  async completeCheckout(sessionId: string): Promise<PaidEvent> {
    const session = this.requireSession(sessionId);
    if (session.status === "abandoned") {
      throw new Error("payment_incomplete");
    }
    if (session.status !== "paid") {
      session.status = "paid";
      session.paidAt = new Date().toISOString();
    }
    return paidEvent(session);
  }

  async abandonCheckout(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "open") return;
    session.status = "abandoned";
  }

  async handleWebhook(
    rawBody: string,
    _headers: Record<string, string>,
  ): Promise<WebhookResult> {
    const event = parseJson(rawBody);
    if (!isRecord(event)) {
      return { ignored: true };
    }
    const data = isRecord(event.data) ? event.data : event;
    const status = typeof data.status === "string" ? data.status : "";
    const sessionId = typeof data.id === "string" ? data.id : "";
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
    if (!this.sessions.has(sessionId)) {
      const draft = draftFromMetadata(data);
      const amountUsd = draftAmount(data);
      if (!draft || amountUsd === undefined) {
        return { ignored: true };
      }
      this.sessions.set(sessionId, {
        sessionId,
        status: "open",
        checkoutUrl: fixtureCheckoutUrl(draft.city, sessionId),
        listingDraft: draft,
        amountUsd,
        kind: draftKind(data),
      });
    }
    return this.completeCheckout(sessionId);
  }

  private requireSession(sessionId: string): StoredCheckout {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("payment_incomplete");
    }
    return session;
  }
}

let sharedFixture: FixturePayment | undefined;

export function getFixturePayment(): FixturePayment {
  if (!sharedFixture) sharedFixture = new FixturePayment();
  return sharedFixture;
}

export function fixtureCheckoutUrl(city: string, sessionId: string): string {
  return `/${city}/return?sessionId=${encodeURIComponent(sessionId)}`;
}

function copyCheckout(session: StoredCheckout): CheckoutRecord {
  return { ...session, listingDraft: { ...session.listingDraft } };
}

function paidEvent(session: StoredCheckout): PaidEvent {
  return {
    sessionId: session.sessionId,
    listingDraft: { ...session.listingDraft },
    amountUsd: session.amountUsd,
    kind: session.kind,
    paidAt: session.paidAt ?? new Date().toISOString(),
  };
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
