import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { CITIES, type City } from "./core/cities";
import {
  createListing,
  raiseListing,
  venueKey,
  type Listing,
  type ListingDraft,
} from "./core/listing";
import { bidInRollingWeek, type WeekendWindow } from "./core/window";

export type CityRow = {
  slug: string;
  name: string;
  timezone: string;
  active: 0 | 1;
};

export type WindowRow = {
  id: string;
  city: string;
  starts_at: string;
  ends_at: string;
};

export type ListingRow = {
  id: string;
  city: string;
  window_id: string;
  venue_key: string;
  venue_name: string;
  kind: string | null;
  booking_url: string;
  pitch: string | null;
  bid_usd: number;
  first_paid_at: string;
  last_paid_at: string;
  clicks: number;
};

export type PaymentStatus =
  | "applied"
  | "reconciliation_required"
  | "rejected";

/** Provider identities are separate immutable facts, never aliases. */
export type PaymentRow = {
  id: string;
  listing_id: string | null;
  /** Compatibility name retained for old callers; it is the checkout ID. */
  polar_session: string;
  amount_usd: number;
  kind: "create" | "raise";
  provider_checkout_id?: string | null;
  provider_order_id?: string | null;
  provider_payment_id?: string | null;
  intent_id?: string | null;
  target_bid_cents?: number | null;
  quote_base_bid_cents?: number | null;
  amount_cents?: number | null;
  currency?: string | null;
  product_id?: string | null;
  facts_fingerprint?: string | null;
  status?: PaymentStatus;
  reason?: string | null;
  provider_paid_at?: string | null;
  created_at?: string;
};

export type PaymentEventOutcome =
  | "applied"
  | "replayed"
  | "rejected"
  | "reconciliation_required";

export type PaymentEventRow = {
  id: number;
  /** Waffo delivery ID (`event.id`). */
  provider_event_id: string;
  /** Waffo checkout/session ID when the provider includes or returned it. */
  provider_checkout_id: string | null;
  /** Waffo event type (`order.completed`). */
  event_type: string;
  received_at: string;
  payload_json: string | null;
  business_event_id?: string | null;
  provider_order_id?: string | null;
  provider_payment_id?: string | null;
  intent_id?: string | null;
  body_hash?: string | null;
  fingerprint?: string | null;
  outcome?: PaymentEventOutcome;
  reason?: string | null;
  listing_id?: string | null;
};

export type PaymentEventInput = Omit<PaymentEventRow, "id">;

export type CheckoutIntentStatus =
  | "creating"
  | "open"
  | "unknown"
  | "paid"
  | "abandoned"
  | "reconciliation_required"
  | "needs_reconciliation"
  | "rejected";

/**
 * These states are immutable settlement outcomes. A late provider delivery
 * may be recorded for audit, but it must not reopen the intent or mutate rank.
 */
function isTerminalCheckoutIntentStatus(status: CheckoutIntentStatus): boolean {
  return status === "paid" || status === "abandoned" || status === "reconciliation_required" || status === "needs_reconciliation" || status === "rejected";
}

export type CheckoutIntentRow = {
  id: string;
  mode: "fixture" | "waffo-test" | "waffo-prod";
  city: string;
  window_id: string;
  store_id: string;
  listing_draft_json: string;
  kind: "create" | "raise";
  target_bid_cents: number;
  quote_base_bid_cents: number | null;
  charge_cents: number;
  currency: string;
  product_id: string;
  tax_category: string;
  metadata_json: string;
  fingerprint: string;
  status: CheckoutIntentStatus;
  provider_checkout_id: string | null;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  provider_event_id: string | null;
  business_event_id: string | null;
  checkout_url: string | null;
  expires_at: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};

export type CheckoutIntentInput = {
  id?: string;
  mode: CheckoutIntentRow["mode"];
  listingDraft: ListingDraft;
  kind: CheckoutIntentRow["kind"];
  targetBidUsd: number;
  quoteBaseBidUsd?: number | null;
  chargeCents: number;
  currency: string;
  productId: string;
  storeId?: string;
  taxCategory?: string;
  metadata: Record<string, string>;
  createdAt?: string;
};

export type AttachCheckoutInput = {
  providerCheckoutId: string;
  checkoutUrl: string;
  expiresAt?: string | null;
};

export type PaidSettlementInput = {
  sessionId: string;
  intentId?: string | null;
  listingDraft?: ListingDraft;
  amountUsd: number;
  amountCents?: number;
  kind: "create" | "raise";
  paidAt: string;
  providerCheckoutId?: string | null;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  providerEventId?: string | null;
  businessEventId?: string | null;
  eventType?: string;
  currency?: string | null;
  productId?: string | null;
  metadata?: Record<string, string>;
  intentFingerprint?: string | null;
  payloadJson?: string | null;
  payloadFingerprint?: string | null;
  targetBidUsd?: number | null;
  quoteBaseBidUsd?: number | null;
  mode?: CheckoutIntentRow["mode"];
  /** Provider boundary validation failure; it is durably rejected, never ranked. */
  validationError?: string;
};

export type SettlementResult = {
  status: "applied" | "replayed" | "rejected" | "reconciliation_required";
  listing?: Listing;
  reason?: string;
  intentId?: string;
};

export const DEFAULT_DATABASE_PATH = "./data/city-weekend-spot.sqlite";

export function defaultDatabasePath(): string {
  return process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
}

/**
 * Durable ledger schema. There is intentionally no UNIQUE(venue_key): an old
 * cycle must remain history while a venue can start a new paid cycle after
 * its rolling seven-day occupancy expires.
 */
export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cities (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS windows (
  id TEXT PRIMARY KEY,
  city TEXT NOT NULL REFERENCES cities(slug),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  city TEXT NOT NULL REFERENCES cities(slug),
  window_id TEXT NOT NULL,
  venue_key TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  kind TEXT,
  booking_url TEXT NOT NULL,
  pitch TEXT,
  bid_usd INTEGER NOT NULL,
  first_paid_at TEXT NOT NULL,
  last_paid_at TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checkout_intents (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('fixture', 'waffo-test', 'waffo-prod')),
  city TEXT NOT NULL,
  window_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  listing_draft_json TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('create', 'raise')),
  target_bid_cents INTEGER NOT NULL,
  quote_base_bid_cents INTEGER,
  charge_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  product_id TEXT NOT NULL,
  tax_category TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_checkout_id TEXT,
  provider_order_id TEXT,
  provider_payment_id TEXT,
  provider_event_id TEXT,
  business_event_id TEXT,
  checkout_url TEXT,
  expires_at TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  listing_id TEXT REFERENCES listings(id),
  polar_session TEXT NOT NULL,
  provider_checkout_id TEXT,
  provider_order_id TEXT,
  provider_payment_id TEXT,
  intent_id TEXT REFERENCES checkout_intents(id),
  amount_usd INTEGER NOT NULL,
  amount_cents INTEGER,
  kind TEXT NOT NULL CHECK (kind IN ('create', 'raise')),
  target_bid_cents INTEGER,
  quote_base_bid_cents INTEGER,
  currency TEXT,
  product_id TEXT,
  facts_fingerprint TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  reason TEXT,
  provider_paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_event_id TEXT NOT NULL UNIQUE,
  provider_checkout_id TEXT,
  provider_order_id TEXT,
  provider_payment_id TEXT,
  business_event_id TEXT,
  intent_id TEXT REFERENCES checkout_intents(id),
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL,
  payload_json TEXT,
  body_hash TEXT,
  fingerprint TEXT,
  outcome TEXT NOT NULL DEFAULT 'rejected',
  reason TEXT,
  listing_id TEXT REFERENCES listings(id)
);

CREATE TABLE IF NOT EXISTS checkout_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intent_id TEXT NOT NULL UNIQUE REFERENCES checkout_intents(id),
  provider_checkout_id TEXT NOT NULL UNIQUE,
  checkout_url TEXT NOT NULL,
  expires_at TEXT,
  request_fingerprint TEXT NOT NULL,
  response_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_event_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_kind TEXT NOT NULL,
  identity_value TEXT NOT NULL,
  existing_fingerprint TEXT,
  incoming_fingerprint TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_windows_city ON windows(city);
CREATE INDEX IF NOT EXISTS idx_listings_city_window ON listings(city, window_id);
CREATE INDEX IF NOT EXISTS idx_listings_venue_key ON listings(venue_key);
CREATE INDEX IF NOT EXISTS idx_payments_listing ON payments(listing_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_checkout
  ON payment_events(provider_checkout_id) WHERE provider_checkout_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_order
  ON payment_events(provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_payment
  ON payment_events(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_checkout
  ON payments(provider_checkout_id) WHERE provider_checkout_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order
  ON payments(provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_payment
  ON payments(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_intent_applied
  ON payments(intent_id) WHERE intent_id IS NOT NULL AND status = 'applied';
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_business
  ON payment_events(event_type, business_event_id)
  WHERE business_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_intents_checkout
  ON checkout_intents(provider_checkout_id)
  WHERE provider_checkout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intents_venue ON checkout_intents(city, window_id);
`.trim();

type SqliteDatabase = Database.Database;
type SqliteRow = Record<string, unknown>;

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function canonicalUtcTimestamp(value: string): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function draftJson(draft: ListingDraft): string {
  return stableJson({
    city: draft.city,
    windowId: draft.windowId,
    venueName: draft.venueName,
    bookingUrl: draft.bookingUrl,
    kind: draft.kind ?? null,
    pitch: draft.pitch ?? null,
  });
}

function parseDraft(raw: string): ListingDraft {
  return JSON.parse(raw) as ListingDraft;
}

function metadataJson(metadata: Record<string, string>): string {
  return stableJson(
    Object.fromEntries(
      Object.entries(metadata)
        .map(([key, value]) => [key, String(value)] as const)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}

function parseMetadata(raw: string): Record<string, string> {
  const value = JSON.parse(raw) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, String(val)]));
}

export function checkoutIntentFingerprint(input: {
  city: string;
  windowId: string;
  listingDraftJson: string;
  kind: string;
  targetBidCents: number;
  quoteBaseBidCents: number | null;
  chargeCents: number;
  currency: string;
  productId: string;
  storeId?: string;
  taxCategory?: string;
  metadata: Record<string, string>;
}): string {
  return sha256(
    stableJson({
      city: input.city,
      windowId: input.windowId,
      listingDraftJson: input.listingDraftJson,
      kind: input.kind,
      targetBidCents: input.targetBidCents,
      quoteBaseBidCents: input.quoteBaseBidCents,
      chargeCents: input.chargeCents,
      currency: input.currency,
      productId: input.productId,
      storeId: input.storeId ?? "",
      taxCategory: input.taxCategory ?? "digital_goods",
      metadata: input.metadata,
    }),
  );
}

export function paymentEventFingerprint(event: PaymentEventInput): string {
  return sha256(
    stableJson({
      provider_checkout_id: event.provider_checkout_id,
      provider_order_id: event.provider_order_id ?? null,
      provider_payment_id: event.provider_payment_id ?? null,
      business_event_id: event.business_event_id ?? null,
      intent_id: event.intent_id ?? null,
      event_type: event.event_type,
      body_hash: eventBodyHash(event),
    }),
  );
}

export class LedgerIdentityError extends Error {
  readonly code: string;

  constructor(code: string, message = code) {
    super(message);
    this.name = "LedgerIdentityError";
    this.code = code;
  }
}

type TableDefinition<T> = {
  table: string;
  columns: readonly string[];
  keyColumn: string;
  selectSql: string;
  encode(value: T): SqliteRow;
  decode(row: SqliteRow): T;
};

/** Map-shaped access for the old domain code, backed entirely by SQLite. */
class SqliteMap<T> {
  constructor(
    private readonly owner: AppDb,
    private readonly definition: TableDefinition<T>,
  ) {}

  get(key: string): T | undefined {
    const row = this.owner.sqlite
      .prepare(`${this.definition.selectSql} WHERE ${this.definition.keyColumn} = ?`)
      .get(key) as SqliteRow | undefined;
    return row ? this.definition.decode(row) : undefined;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  set(key: string, value: T): this {
    if (this.definition.table === "payments") {
      this.owner.runTransaction(() => {
        this.owner.setPaymentRowWithinTransaction(key, value as unknown as PaymentRow);
      });
      return this;
    }
    this.owner.runTransaction(() => {
      const encoded = {
        ...this.definition.encode(value),
        [this.definition.keyColumn]: key,
      };
      const columns = this.definition.columns;
      const assignments = columns
        .filter((column) => column !== this.definition.keyColumn)
        .map((column) => `${column} = excluded.${column}`)
        .join(", ");
      this.owner.sqlite
        .prepare(
          `INSERT INTO ${this.definition.table} (${columns.join(", ")})
           VALUES (${columns.map(() => "?").join(", ")})
           ON CONFLICT(${this.definition.keyColumn}) DO UPDATE SET ${assignments}`,
        )
        .run(...columns.map((column) => encoded[column]));
    });
    return this;
  }

  *values(): IterableIterator<T> {
    const rows = this.owner.sqlite
      .prepare(this.definition.selectSql)
      .all() as unknown as SqliteRow[];
    for (const row of rows) yield this.definition.decode(row);
  }

  *keys(): IterableIterator<string> {
    const rows = this.owner.sqlite
      .prepare(`SELECT ${this.definition.keyColumn} FROM ${this.definition.table}`)
      .all() as unknown as SqliteRow[];
    for (const row of rows) yield String(row[this.definition.keyColumn]);
  }

  *entries(): IterableIterator<[string, T]> {
    for (const value of this.values()) {
      yield [String((value as Record<string, unknown>)[this.definition.keyColumn]), value];
    }
  }

  [Symbol.iterator](): IterableIterator<[string, T]> {
    return this.entries();
  }

  forEach(callback: (value: T, key: string, map: this) => void, thisArg?: unknown): void {
    for (const [key, value] of this.entries()) callback.call(thisArg, value, key, this);
  }

  get size(): number {
    const row = this.owner.sqlite
      .prepare(`SELECT COUNT(*) AS count FROM ${this.definition.table}`)
      .get() as { count: number };
    return Number(row.count);
  }

  delete(key: string): boolean {
    return this.owner.runTransaction(() => {
      const result = this.owner.sqlite
        .prepare(`DELETE FROM ${this.definition.table} WHERE ${this.definition.keyColumn} = ?`)
        .run(key);
      return result.changes > 0;
    });
  }

  clear(): void {
    this.owner.runTransaction(() => {
      this.owner.sqlite.prepare(`DELETE FROM ${this.definition.table}`).run();
    });
  }
}

const CITY_COLUMNS = ["slug", "name", "timezone", "active"] as const;
const WINDOW_COLUMNS = ["id", "city", "starts_at", "ends_at"] as const;
const LISTING_COLUMNS = [
  "id",
  "city",
  "window_id",
  "venue_key",
  "venue_name",
  "kind",
  "booking_url",
  "pitch",
  "bid_usd",
  "first_paid_at",
  "last_paid_at",
  "clicks",
] as const;
const PAYMENT_COLUMNS = [
  "id",
  "listing_id",
  "polar_session",
  "provider_checkout_id",
  "provider_order_id",
  "provider_payment_id",
  "intent_id",
  "amount_usd",
  "amount_cents",
  "kind",
  "target_bid_cents",
  "quote_base_bid_cents",
  "currency",
  "product_id",
  "facts_fingerprint",
  "status",
  "reason",
  "provider_paid_at",
  "created_at",
] as const;

const CITY_SELECT = `SELECT ${CITY_COLUMNS.join(", ")} FROM cities`;
const WINDOW_SELECT = `SELECT ${WINDOW_COLUMNS.join(", ")} FROM windows`;
const LISTING_SELECT = `SELECT ${LISTING_COLUMNS.join(", ")} FROM listings`;
const PAYMENT_SELECT = `SELECT ${PAYMENT_COLUMNS.join(", ")} FROM payments`;

const CITY_TABLE: TableDefinition<CityRow> = {
  table: "cities",
  columns: CITY_COLUMNS,
  keyColumn: "slug",
  selectSql: CITY_SELECT,
  encode: (row) => row,
  decode: (row) => ({
    slug: String(row.slug),
    name: String(row.name),
    timezone: String(row.timezone),
    active: Number(row.active) === 1 ? 1 : 0,
  }),
};

const WINDOW_TABLE: TableDefinition<WindowRow> = {
  table: "windows",
  columns: WINDOW_COLUMNS,
  keyColumn: "id",
  selectSql: WINDOW_SELECT,
  encode: (row) => row,
  decode: (row) => ({
    id: String(row.id),
    city: String(row.city),
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
  }),
};

const LISTING_TABLE: TableDefinition<ListingRow> = {
  table: "listings",
  columns: LISTING_COLUMNS,
  keyColumn: "id",
  selectSql: LISTING_SELECT,
  encode: (row) => row,
  decode: (row) => ({
    id: String(row.id),
    city: String(row.city),
    window_id: String(row.window_id),
    venue_key: String(row.venue_key),
    venue_name: String(row.venue_name),
    kind: nullableString(row.kind),
    booking_url: String(row.booking_url),
    pitch: nullableString(row.pitch),
    bid_usd: Number(row.bid_usd),
    first_paid_at: String(row.first_paid_at),
    last_paid_at: String(row.last_paid_at),
    clicks: Number(row.clicks),
  }),
};

function decodePayment(row: SqliteRow): PaymentRow {
  const amountUsd = Number(row.amount_usd);
  const providerCheckoutId = nullableString(row.provider_checkout_id);
  return {
    id: String(row.id),
    listing_id: nullableString(row.listing_id),
    polar_session: String(row.polar_session ?? providerCheckoutId ?? ""),
    // An omitted Waffo checkout is a real null, not the compatibility
    // `polar_session` alias used by legacy callers.
    provider_checkout_id: providerCheckoutId,
    provider_order_id: nullableString(row.provider_order_id),
    provider_payment_id: nullableString(row.provider_payment_id),
    intent_id: nullableString(row.intent_id),
    amount_usd: amountUsd,
    amount_cents: row.amount_cents === null || row.amount_cents === undefined
      ? amountUsd * 100
      : Number(row.amount_cents),
    kind: row.kind === "raise" ? "raise" : "create",
    target_bid_cents: row.target_bid_cents === null || row.target_bid_cents === undefined
      ? null
      : Number(row.target_bid_cents),
    quote_base_bid_cents:
      row.quote_base_bid_cents === null || row.quote_base_bid_cents === undefined
        ? null
        : Number(row.quote_base_bid_cents),
    currency: nullableString(row.currency),
    product_id: nullableString(row.product_id),
    facts_fingerprint: nullableString(row.facts_fingerprint),
    status:
      row.status === "reconciliation_required" || row.status === "rejected"
        ? row.status
        : "applied",
    reason: nullableString(row.reason),
    provider_paid_at: nullableString(row.provider_paid_at),
    created_at: nullableString(row.created_at) ?? undefined,
  };
}

function decodeEvent(row: SqliteRow): PaymentEventRow {
  return {
    id: Number(row.id),
    provider_event_id: String(row.provider_event_id),
    provider_checkout_id: nullableString(row.provider_checkout_id),
    provider_order_id: nullableString(row.provider_order_id),
    provider_payment_id: nullableString(row.provider_payment_id),
    business_event_id: nullableString(row.business_event_id),
    intent_id: nullableString(row.intent_id),
    event_type: String(row.event_type),
    received_at: String(row.received_at),
    payload_json: nullableString(row.payload_json),
    body_hash: nullableString(row.body_hash),
    fingerprint: nullableString(row.fingerprint),
    outcome:
      row.outcome === "applied" || row.outcome === "replayed" || row.outcome === "reconciliation_required"
        ? row.outcome
        : "rejected",
    reason: nullableString(row.reason),
    listing_id: nullableString(row.listing_id),
  };
}

function decodeIntent(row: SqliteRow): CheckoutIntentRow {
  return {
    id: String(row.id),
    mode: row.mode === "waffo-prod" || row.mode === "waffo-test" ? row.mode : "fixture",
    city: String(row.city),
    window_id: String(row.window_id),
    store_id: String(row.store_id ?? "fixture"),
    listing_draft_json: String(row.listing_draft_json),
    kind: row.kind === "raise" ? "raise" : "create",
    target_bid_cents: Number(row.target_bid_cents),
    quote_base_bid_cents:
      row.quote_base_bid_cents === null || row.quote_base_bid_cents === undefined
        ? null
        : Number(row.quote_base_bid_cents),
    charge_cents: Number(row.charge_cents),
    currency: String(row.currency),
    product_id: String(row.product_id),
    tax_category: String(row.tax_category ?? "digital_goods"),
    metadata_json: String(row.metadata_json),
    fingerprint: String(row.fingerprint),
    status:
      row.status === "open" || row.status === "unknown" || row.status === "paid" || row.status === "abandoned" || row.status === "reconciliation_required" || row.status === "needs_reconciliation" || row.status === "rejected"
        ? row.status
        : "creating",
    provider_checkout_id: nullableString(row.provider_checkout_id),
    provider_order_id: nullableString(row.provider_order_id),
    provider_payment_id: nullableString(row.provider_payment_id),
    provider_event_id: nullableString(row.provider_event_id),
    business_event_id: nullableString(row.business_event_id),
    checkout_url: nullableString(row.checkout_url),
    expires_at: nullableString(row.expires_at),
    reason: nullableString(row.reason),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    paid_at: nullableString(row.paid_at),
  };
}

export class AppDb {
  readonly cities: SqliteMap<CityRow>;
  readonly windows: SqliteMap<WindowRow>;
  readonly listings: SqliteMap<ListingRow>;
  readonly payments: SqliteMap<PaymentRow>;
  private transactionDepth = 0;
  private closed = false;

  constructor(readonly sqlite: SqliteDatabase) {
    this.cities = new SqliteMap(this, CITY_TABLE);
    this.windows = new SqliteMap(this, WINDOW_TABLE);
    this.listings = new SqliteMap(this, LISTING_TABLE);
    this.payments = new SqliteMap(this, {
      table: "payments",
      columns: PAYMENT_COLUMNS,
      keyColumn: "id",
      selectSql: PAYMENT_SELECT,
      encode: (row) => paymentEncode(row),
      decode: decodePayment,
    });
  }

  runTransaction<T>(operation: () => T): T {
    if (this.transactionDepth > 0) return operation();
    this.transactionDepth += 1;
    try {
      const transaction = this.sqlite.transaction(() => operation()).immediate;
      return transaction();
    } finally {
      this.transactionDepth = 0;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.sqlite.close();
  }

  setPaymentRowWithinTransaction(key: string, value: PaymentRow): PaymentRow {
    const normalized = normalizePayment(key, value);
    const existing = paymentByAnyIdentity(this, normalized);
    if (existing) {
      if (paymentFactsEqual(existing, normalized)) return existing;
      insertConflictWithinTransaction(
        this,
        "payment",
        paymentIdentity(existing),
        existing.facts_fingerprint,
        paymentFactsFingerprint(normalized),
        JSON.stringify(normalized),
      );
      throw new LedgerIdentityError("payment_identity_reuse");
    }
    insertPaymentWithinTransaction(this, normalized);
    return normalized;
  }
}

function paymentEncode(row: PaymentRow): SqliteRow {
  // `undefined` means an old caller supplied only the compatibility session
  // name; an explicit null means a Waffo event arrived before its checkout
  // response and must not be relabelled as a provider checkout ID.
  const providerCheckout = row.provider_checkout_id !== undefined ? row.provider_checkout_id : row.polar_session;
  const amountCents = row.amount_cents ?? Math.round(row.amount_usd * 100);
  return {
    id: row.id,
    listing_id: row.listing_id,
    polar_session: row.polar_session || providerCheckout || row.id,
    provider_checkout_id: providerCheckout || null,
    provider_order_id: row.provider_order_id ?? null,
    provider_payment_id: row.provider_payment_id ?? null,
    intent_id: row.intent_id ?? null,
    amount_usd: row.amount_usd,
    amount_cents: amountCents,
    kind: row.kind,
    target_bid_cents: row.target_bid_cents ?? null,
    quote_base_bid_cents: row.quote_base_bid_cents ?? null,
    currency: row.currency ?? "USD",
    product_id: row.product_id ?? null,
    facts_fingerprint: row.facts_fingerprint ?? paymentFactsFingerprint(row),
    status: row.status ?? "applied",
    reason: row.reason ?? null,
    provider_paid_at: row.provider_paid_at ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function normalizePayment(key: string, row: PaymentRow): PaymentRow {
  const providerCheckout = row.provider_checkout_id !== undefined ? row.provider_checkout_id : row.polar_session ?? key;
  return {
    ...row,
    id: key,
    listing_id: row.listing_id ?? null,
    polar_session: row.polar_session || providerCheckout || key,
    provider_checkout_id: providerCheckout,
    amount_cents: row.amount_cents ?? Math.round(row.amount_usd * 100),
    currency: row.currency ?? "USD",
    status: row.status ?? "applied",
    created_at: row.created_at ?? new Date().toISOString(),
    facts_fingerprint: row.facts_fingerprint ?? paymentFactsFingerprint(row),
  };
}

function paymentFactsFingerprint(row: PaymentRow): string {
  return sha256(
    stableJson({
      id: row.id,
      // The listing association is the result of settlement, not an
      // independently replayable provider fact. Likewise, polar_session is a
      // compatibility alias; canonical identity is the nullable provider
      // checkout ID so an omitted Waffo checkout is not relabelled.
      listing_id: null,
      polar_session: row.provider_checkout_id ?? null,
      provider_checkout_id: row.provider_checkout_id ?? null,
      provider_order_id: row.provider_order_id ?? null,
      provider_payment_id: row.provider_payment_id ?? null,
      intent_id: row.intent_id ?? null,
      amount_cents: row.amount_cents ?? Math.round(row.amount_usd * 100),
      kind: row.kind,
      target_bid_cents: row.target_bid_cents ?? null,
      quote_base_bid_cents: row.quote_base_bid_cents ?? null,
      currency: row.currency ?? "USD",
      product_id: row.product_id ?? null,
    }),
  );
}

function paymentFactsEqual(a: PaymentRow, b: PaymentRow): boolean {
  return paymentFactsFingerprint(a) === paymentFactsFingerprint(b);
}

function paymentIdentity(row: PaymentRow): string {
  return row.provider_payment_id ?? row.provider_order_id ?? row.provider_checkout_id ?? row.id;
}

function paymentIdentityValue(checkoutId: string | null, orderId?: string | null, paymentId?: string | null): string {
  return paymentId ?? orderId ?? checkoutId ?? "unknown-provider-identity";
}

function paymentByAnyIdentity(db: AppDb, row: PaymentRow): PaymentRow | undefined {
  const existing = db.sqlite
    .prepare(
      `${PAYMENT_SELECT}
       WHERE id = ?
          OR provider_checkout_id = ?
          OR provider_order_id = ?
          OR provider_payment_id = ?
          OR (intent_id IS NOT NULL AND intent_id = ?)
       LIMIT 1`,
    )
    .get(
      row.id,
      row.provider_checkout_id ?? null,
      row.provider_order_id ?? null,
      row.provider_payment_id ?? null,
      row.intent_id ?? null,
    ) as SqliteRow | undefined;
  return existing ? decodePayment(existing) : undefined;
}

function insertPaymentWithinTransaction(db: AppDb, row: PaymentRow): PaymentRow {
  const encoded = paymentEncode(row);
  db.sqlite
    .prepare(
      `INSERT INTO payments (${PAYMENT_COLUMNS.join(", ")})
       VALUES (${PAYMENT_COLUMNS.map(() => "?").join(", ")})`,
    )
    .run(...PAYMENT_COLUMNS.map((column) => encoded[column]));
  return db.payments.get(row.id) ?? row;
}

export function cityToRow(city: City): CityRow {
  return { slug: city.slug, name: city.name, timezone: city.timezone, active: city.active ? 1 : 0 };
}

export function windowToRow(window: WeekendWindow): WindowRow {
  return {
    id: window.id,
    city: window.city,
    starts_at: window.startsAt.toISOString(),
    ends_at: window.endsAt.toISOString(),
  };
}

function kindFromRow(kind: string | null): Listing["kind"] {
  return kind === "restaurant" || kind === "bar" || kind === "show" ? kind : null;
}

export function listingToRow(listing: Listing): ListingRow {
  return {
    id: listing.id,
    city: listing.city,
    window_id: listing.windowId,
    venue_key: listing.venueKey,
    venue_name: listing.venueName,
    kind: listing.kind,
    booking_url: listing.bookingUrl,
    pitch: listing.pitch,
    bid_usd: listing.bidUsd,
    first_paid_at: listing.firstPaidAt,
    last_paid_at: listing.lastPaidAt,
    clicks: listing.clicks,
  };
}

export function listingFromRow(row: ListingRow): Listing {
  return {
    id: row.id,
    city: row.city as Listing["city"],
    windowId: row.window_id,
    venueName: row.venue_name,
    venueKey: row.venue_key,
    kind: kindFromRow(row.kind),
    bookingUrl: row.booking_url,
    pitch: row.pitch,
    bidUsd: row.bid_usd,
    firstPaidAt: row.first_paid_at,
    lastPaidAt: row.last_paid_at,
    clicks: row.clicks,
  };
}

export function seedCities(db: AppDb, cities: readonly City[] = CITIES): AppDb {
  db.runTransaction(() => {
    for (const city of cities) db.cities.set(city.slug, cityToRow(city));
  });
  return db;
}

export function upsertWindow(db: AppDb, window: WeekendWindow): WindowRow {
  const row = windowToRow(window);
  db.windows.set(row.id, row);
  return db.windows.get(row.id) ?? row;
}

function listingRowById(db: AppDb, id: string): ListingRow | undefined {
  const row = db.sqlite.prepare(`${LISTING_SELECT} WHERE id = ?`).get(id) as SqliteRow | undefined;
  return row ? LISTING_TABLE.decode(row) : undefined;
}

function listingRowsByVenueKey(db: AppDb, key: string): ListingRow[] {
  const rows = db.sqlite
    .prepare(`${LISTING_SELECT} WHERE venue_key = ? ORDER BY first_paid_at DESC, id ASC`)
    .all(key) as unknown as SqliteRow[];
  return rows.map((row) => LISTING_TABLE.decode(row));
}

export function insertListing(db: AppDb, listing: Listing): ListingRow {
  const row = listingToRow(listing);
  return db.runTransaction(() => {
    const existing = listingRowById(db, row.id);
    if (existing) {
      if (stableJson(existing) !== stableJson(row)) {
        throw new LedgerIdentityError("listing_identity_reuse");
      }
      return existing;
    }
    db.sqlite
      .prepare(
        `INSERT INTO listings (${LISTING_COLUMNS.join(", ")})
         VALUES (${LISTING_COLUMNS.map(() => "?").join(", ")})`,
      )
      .run(...LISTING_COLUMNS.map((column) => row[column]));
    return db.listings.get(row.id) ?? row;
  });
}

export function listingsForCityWindow(db: AppDb, city: string, windowId: string): Listing[] {
  const rows = db.sqlite
    .prepare(`${LISTING_SELECT} WHERE city = ? AND window_id = ?`)
    .all(city, windowId) as unknown as SqliteRow[];
  return rows.map((row) => listingFromRow(LISTING_TABLE.decode(row)));
}

export function listingsForCityRollingWeek(
  db: AppDb,
  city: string,
  now: Date = new Date(),
): Listing[] {
  return Array.from(db.listings.values())
    .filter((row) => row.city === city && bidInRollingWeek(row.first_paid_at, now))
    .map(listingFromRow);
}

export function findListingByVenueKey(db: AppDb, key: string): Listing | undefined {
  const row = listingRowsByVenueKey(db, key)[0];
  return row ? listingFromRow(row) : undefined;
}

/** Current live cycle; historical rows remain queryable but never merge here. */
export function findLiveListingByVenueKey(
  db: AppDb,
  key: string,
  now: Date = new Date(),
): Listing | undefined {
  const row = listingRowsByVenueKey(db, key).find((candidate) =>
    bidInRollingWeek(candidate.first_paid_at, now),
  );
  return row ? listingFromRow(row) : undefined;
}

export function updateListing(db: AppDb, listing: Listing): ListingRow {
  const row = listingToRow(listing);
  return db.runTransaction(() => {
    const existing = listingRowById(db, row.id);
    if (
      existing &&
      row.clicks === existing.clicks + 1 &&
      row.city === existing.city &&
      row.window_id === existing.window_id &&
      row.venue_key === existing.venue_key &&
      row.venue_name === existing.venue_name &&
      row.kind === existing.kind &&
      row.booking_url === existing.booking_url &&
      row.pitch === existing.pitch &&
      row.bid_usd === existing.bid_usd &&
      row.first_paid_at === existing.first_paid_at &&
      row.last_paid_at === existing.last_paid_at
    ) {
      db.sqlite.prepare("UPDATE listings SET clicks = clicks + 1 WHERE id = ?").run(row.id);
      return db.listings.get(row.id) ?? row;
    }
    if (existing && row.clicks < existing.clicks) return existing;
    if (!existing) return insertListing(db, listing);
    db.sqlite
      .prepare(
        `UPDATE listings SET city = ?, window_id = ?, venue_key = ?, venue_name = ?, kind = ?, booking_url = ?, pitch = ?, bid_usd = ?, first_paid_at = ?, last_paid_at = ?, clicks = ? WHERE id = ?`,
      )
      .run(row.city, row.window_id, row.venue_key, row.venue_name, row.kind, row.booking_url, row.pitch, row.bid_usd, row.first_paid_at, row.last_paid_at, row.clicks, row.id);
    return db.listings.get(row.id) ?? row;
  });
}

function insertConflictWithinTransaction(
  db: AppDb,
  identityKind: string,
  identityValue: string,
  existingFingerprint: string | null | undefined,
  incomingFingerprint: string,
  payloadJson: string | null,
): void {
  db.sqlite
    .prepare(
      `INSERT INTO payment_event_conflicts
       (identity_kind, identity_value, existing_fingerprint, incoming_fingerprint, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(identityKind, identityValue, existingFingerprint ?? null, incomingFingerprint, payloadJson, new Date().toISOString());
}

function eventStoredFingerprint(row: PaymentEventRow): string {
  return row.fingerprint ?? paymentEventFingerprint(row);
}

function eventBodyHash(event: Pick<PaymentEventRow, "body_hash" | "payload_json">): string | null {
  // The raw payload is the immutable source of truth. A caller-supplied hash
  // is only useful for legacy rows that did not retain the body.
  return event.payload_json ? sha256(event.payload_json) : event.body_hash ?? null;
}

function eventIdentityMatches(
  existing: PaymentEventRow,
  incomingFingerprint: string,
  incomingBodyHash: string | null,
): boolean {
  return eventStoredFingerprint(existing) === incomingFingerprint && eventBodyHash(existing) === incomingBodyHash;
}

function insertEventWithinTransaction(db: AppDb, event: PaymentEventInput): PaymentEventRow {
  const fingerprint = event.fingerprint ?? paymentEventFingerprint(event);
  db.sqlite
    .prepare(
      `INSERT INTO payment_events
       (provider_event_id, provider_checkout_id, provider_order_id, provider_payment_id, business_event_id, intent_id, event_type, received_at, payload_json, body_hash, fingerprint, outcome, reason, listing_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.provider_event_id,
      event.provider_checkout_id,
      event.provider_order_id ?? null,
      event.provider_payment_id ?? null,
      event.business_event_id ?? null,
      event.intent_id ?? null,
      event.event_type,
      event.received_at,
      event.payload_json ?? null,
      event.body_hash ?? null,
      fingerprint,
      event.outcome ?? "rejected",
      event.reason ?? null,
      event.listing_id ?? null,
    );
  const row = db.sqlite
    .prepare("SELECT * FROM payment_events WHERE provider_event_id = ?")
    .get(event.provider_event_id) as SqliteRow | undefined;
  if (!row) throw new Error("payment event was not recorded");
  return decodeEvent(row);
}

export function recordPaymentEvent(db: AppDb, event: PaymentEventInput): PaymentEventRow {
  let identityReuse = false;
  let result: PaymentEventRow | undefined;
  db.runTransaction(() => {
    const incomingFingerprint = event.fingerprint ?? paymentEventFingerprint(event);
    const incomingBodyHash = eventBodyHash(event);
    const existingByDelivery = db.sqlite
      .prepare("SELECT * FROM payment_events WHERE provider_event_id = ?")
      .get(event.provider_event_id) as SqliteRow | undefined;
    if (existingByDelivery) {
      const existing = decodeEvent(existingByDelivery);
      if (eventIdentityMatches(existing, incomingFingerprint, incomingBodyHash)) {
        result = existing;
        return;
      }
      insertConflictWithinTransaction(db, "delivery", event.provider_event_id, eventStoredFingerprint(existing), incomingFingerprint, event.payload_json ?? null);
      identityReuse = true;
      result = existing;
      return;
    }
    if (event.business_event_id) {
      const existingBusiness = db.sqlite
        .prepare("SELECT * FROM payment_events WHERE event_type = ? AND business_event_id = ?")
        .get(event.event_type, event.business_event_id) as SqliteRow | undefined;
      if (existingBusiness) {
        const existing = decodeEvent(existingBusiness);
        if (eventIdentityMatches(existing, incomingFingerprint, incomingBodyHash)) {
          result = existing;
          return;
        }
        insertConflictWithinTransaction(db, "business_event", `${event.event_type}:${event.business_event_id}`, eventStoredFingerprint(existing), incomingFingerprint, event.payload_json ?? null);
        identityReuse = true;
        result = existing;
        return;
      }
    }
    const existingProvider = paymentEventByProviderIdentity(db, event);
    if (existingProvider) {
      if (eventIdentityMatches(existingProvider, incomingFingerprint, incomingBodyHash)) {
        result = existingProvider;
        return;
      }
      const identity = providerEventIdentity(event);
      insertConflictWithinTransaction(db, identity.kind, identity.value, eventStoredFingerprint(existingProvider), incomingFingerprint, event.payload_json ?? null);
      identityReuse = true;
      result = existingProvider;
      return;
    }
    result = insertEventWithinTransaction(db, { ...event, fingerprint: incomingFingerprint });
  });
  if (identityReuse) throw new LedgerIdentityError("payment_event_identity_reuse");
  if (!result) throw new Error("payment event was not recorded");
  return result;
}

export function paymentEventByDeliveryId(db: AppDb, providerEventId: string): PaymentEventRow | undefined {
  const row = db.sqlite.prepare("SELECT * FROM payment_events WHERE provider_event_id = ?").get(providerEventId) as SqliteRow | undefined;
  return row ? decodeEvent(row) : undefined;
}

function paymentEventByProviderIdentity(db: AppDb, event: Pick<PaymentEventInput, "provider_checkout_id" | "provider_order_id" | "provider_payment_id">): PaymentEventRow | undefined {
  const identities: Array<[string, string]> = [];
  if (event.provider_checkout_id) identities.push(["provider_checkout_id", event.provider_checkout_id]);
  if (event.provider_order_id) identities.push(["provider_order_id", event.provider_order_id]);
  if (event.provider_payment_id) identities.push(["provider_payment_id", event.provider_payment_id]);
  if (identities.length === 0) return undefined;
  const where = identities.map(([column]) => `${column} = ?`).join(" OR ");
  const row = db.sqlite
    .prepare(`SELECT * FROM payment_events WHERE ${where} ORDER BY id ASC LIMIT 1`)
    .get(...identities.map(([, value]) => value)) as SqliteRow | undefined;
  return row ? decodeEvent(row) : undefined;
}

function providerEventIdentity(event: Pick<PaymentEventInput, "provider_checkout_id" | "provider_order_id" | "provider_payment_id">): { kind: string; value: string } {
  if (event.provider_payment_id) return { kind: "provider_payment", value: event.provider_payment_id };
  if (event.provider_order_id) return { kind: "provider_order", value: event.provider_order_id };
  if (event.provider_checkout_id) return { kind: "provider_checkout", value: event.provider_checkout_id };
  return { kind: "provider_identity", value: "unknown-provider-identity" };
}

export function paymentEventsForCheckout(db: AppDb, providerCheckoutId: string): PaymentEventRow[] {
  const rows = db.sqlite
    .prepare("SELECT * FROM payment_events WHERE provider_checkout_id = ? ORDER BY id ASC")
    .all(providerCheckoutId) as unknown as SqliteRow[];
  return rows.map(decodeEvent);
}

function intentSelect(where = ""): string {
  return `SELECT * FROM checkout_intents${where ? ` WHERE ${where}` : ""}`;
}

export function getCheckoutIntent(db: AppDb, id: string): CheckoutIntentRow | undefined {
  const row = db.sqlite.prepare(intentSelect("id = ?")).get(id) as SqliteRow | undefined;
  return row ? decodeIntent(row) : undefined;
}

export function checkoutIntentByProviderCheckout(db: AppDb, checkoutId: string): CheckoutIntentRow | undefined {
  const row = db.sqlite.prepare(intentSelect("provider_checkout_id = ?")).get(checkoutId) as SqliteRow | undefined;
  return row ? decodeIntent(row) : undefined;
}

export function createCheckoutIntent(db: AppDb, input: CheckoutIntentInput): CheckoutIntentRow {
  const id = input.id ?? `int_${randomUUID()}`;
  const createdAt = input.createdAt ?? new Date().toISOString();
  const listingDraftJson = draftJson(input.listingDraft);
  const targetBidCents = input.targetBidUsd * 100;
  const quoteBaseBidCents = input.quoteBaseBidUsd === undefined || input.quoteBaseBidUsd === null ? null : input.quoteBaseBidUsd * 100;
  const storeId = input.storeId ?? (input.mode === "fixture" ? "fixture" : "");
  const taxCategory = input.taxCategory ?? "digital_goods";
  const baseMetadata = Object.fromEntries(Object.entries(input.metadata).map(([key, value]) => [key, String(value)]));
  const fingerprint = checkoutIntentFingerprint({
    city: input.listingDraft.city,
    windowId: input.listingDraft.windowId,
    listingDraftJson,
    kind: input.kind,
    targetBidCents,
    quoteBaseBidCents,
    chargeCents: input.chargeCents,
    currency: input.currency,
    productId: input.productId,
    storeId,
    taxCategory,
    metadata: baseMetadata,
  });
  const metadata = { ...baseMetadata, intentId: id, intentFingerprint: fingerprint };
  return db.runTransaction(() => {
    const existing = getCheckoutIntent(db, id);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new LedgerIdentityError("intent_identity_reuse");
      return existing;
    }
    db.sqlite
      .prepare(
        `INSERT INTO checkout_intents
         (id, mode, city, window_id, store_id, listing_draft_json, kind, target_bid_cents, quote_base_bid_cents, charge_cents, currency, product_id, tax_category, metadata_json, fingerprint, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'creating', ?, ?)`,
      )
      .run(id, input.mode, input.listingDraft.city, input.listingDraft.windowId, storeId, listingDraftJson, input.kind, targetBidCents, quoteBaseBidCents, input.chargeCents, input.currency, input.productId, taxCategory, metadataJson(metadata), fingerprint, createdAt, createdAt);
    return getCheckoutIntent(db, id)!;
  });
}

export function attachCheckoutIntent(db: AppDb, id: string, input: AttachCheckoutInput): CheckoutIntentRow {
  return db.runTransaction(() => {
    const intent = getCheckoutIntent(db, id);
    if (!intent) throw new LedgerIdentityError("unknown_intent");
    const other = checkoutIntentByProviderCheckout(db, input.providerCheckoutId);
    if (other && other.id !== id) throw new LedgerIdentityError("checkout_identity_reuse");
    if (intent.provider_checkout_id && intent.provider_checkout_id !== input.providerCheckoutId) {
      throw new LedgerIdentityError("checkout_identity_reuse");
    }
    if (intent.checkout_url && (intent.checkout_url !== input.checkoutUrl || intent.provider_checkout_id !== input.providerCheckoutId)) {
      throw new LedgerIdentityError("checkout_response_reuse");
    }
    const now = new Date().toISOString();
    db.sqlite
      .prepare(
        `UPDATE checkout_intents SET provider_checkout_id = ?, checkout_url = ?, expires_at = ?, status = CASE WHEN status = 'creating' OR status = 'unknown' THEN 'open' ELSE status END, updated_at = ? WHERE id = ?`,
      )
      .run(input.providerCheckoutId, input.checkoutUrl, input.expiresAt ?? null, now, id);
    db.sqlite
      .prepare(
        `INSERT INTO checkout_events (intent_id, provider_checkout_id, checkout_url, expires_at, request_fingerprint, response_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(intent_id) DO UPDATE SET provider_checkout_id = excluded.provider_checkout_id, checkout_url = excluded.checkout_url, expires_at = excluded.expires_at`,
      )
      .run(id, input.providerCheckoutId, input.checkoutUrl, input.expiresAt ?? null, intent.fingerprint, JSON.stringify(input), now);
    return getCheckoutIntent(db, id)!;
  });
}

export function updateCheckoutIntentProviderFacts(
  db: AppDb,
  id: string,
  facts: { providerOrderId?: string | null; providerPaymentId?: string | null; providerEventId?: string | null; businessEventId?: string | null; status?: CheckoutIntentStatus; reason?: string | null; paidAt?: string | null },
): CheckoutIntentRow {
  return db.runTransaction(() => {
    const current = getCheckoutIntent(db, id);
    if (!current) throw new LedgerIdentityError("unknown_intent");
    const terminal = isTerminalCheckoutIntentStatus(current.status);
    const nextStatus = terminal ? current.status : facts.status ?? current.status;
    const nextReason = terminal ? current.reason : facts.reason ?? null;
    const nextPaidAt = terminal ? current.paid_at : facts.paidAt ?? null;
    db.sqlite
      .prepare(
        `UPDATE checkout_intents SET provider_order_id = COALESCE(?, provider_order_id), provider_payment_id = COALESCE(?, provider_payment_id), provider_event_id = COALESCE(?, provider_event_id), business_event_id = COALESCE(?, business_event_id), status = ?, reason = ?, paid_at = COALESCE(?, paid_at), updated_at = ? WHERE id = ?`,
      )
      .run(facts.providerOrderId ?? null, facts.providerPaymentId ?? null, facts.providerEventId ?? null, facts.businessEventId ?? null, nextStatus, nextReason, nextPaidAt, new Date().toISOString(), id);
    return getCheckoutIntent(db, id)!;
  });
}

export function markCheckoutIntentUnknown(db: AppDb, id: string, reason: string): CheckoutIntentRow {
  return updateCheckoutIntentProviderFacts(db, id, { status: "unknown", reason });
}

export function markCheckoutIntentRejected(db: AppDb, id: string, reason: string): CheckoutIntentRow {
  return updateCheckoutIntentProviderFacts(db, id, { status: "rejected", reason });
}

export function markCheckoutIntentAbandoned(db: AppDb, id: string): CheckoutIntentRow | undefined {
  const intent = getCheckoutIntent(db, id);
  if (!intent || isTerminalCheckoutIntentStatus(intent.status)) return intent;
  return updateCheckoutIntentProviderFacts(db, id, { status: "abandoned", reason: "abandoned" });
}

function incomingPaymentFingerprint(input: PaidSettlementInput, intentId: string, providerCheckoutId: string | null): string {
  return sha256(
    stableJson({
      id: `pay_${intentId}`,
      listing_id: null,
      polar_session: providerCheckoutId,
      provider_checkout_id: providerCheckoutId,
      provider_order_id: input.providerOrderId ?? null,
      provider_payment_id: input.providerPaymentId ?? null,
      intent_id: intentId,
      amount_cents: input.amountCents ?? Math.round(input.amountUsd * 100),
      kind: input.kind,
      target_bid_cents: input.targetBidUsd === null || input.targetBidUsd === undefined ? null : input.targetBidUsd * 100,
      quote_base_bid_cents: input.quoteBaseBidUsd === null || input.quoteBaseBidUsd === undefined ? null : input.quoteBaseBidUsd * 100,
      currency: input.currency ?? "USD",
      product_id: input.productId ?? null,
    }),
  );
}

function settlementEventFingerprint(input: PaidSettlementInput, event: PaymentEventInput): string {
  return sha256(
    stableJson({
      identity: paymentEventFingerprint(event),
      paid_at: input.paidAt,
      amount_usd: input.amountUsd,
      amount_cents: input.amountCents ?? Math.round(input.amountUsd * 100),
      kind: input.kind,
      currency: input.currency ?? null,
      product_id: input.productId ?? null,
      target_bid_cents: input.targetBidUsd === null || input.targetBidUsd === undefined ? null : input.targetBidUsd * 100,
      quote_base_bid_cents: input.quoteBaseBidUsd === null || input.quoteBaseBidUsd === undefined ? null : input.quoteBaseBidUsd * 100,
      intent_fingerprint: input.intentFingerprint ?? null,
      metadata: input.metadata ?? null,
      listing_draft: input.listingDraft ? draftJson(input.listingDraft) : null,
      validation_error: input.validationError ?? null,
    }),
  );
}

function eventResultFromStored(db: AppDb, event: PaymentEventRow): SettlementResult {
  if (event.outcome === "applied" || event.outcome === "replayed") {
    const payment = db.sqlite
      .prepare(`${PAYMENT_SELECT} WHERE provider_payment_id = ? OR provider_checkout_id = ? OR intent_id = ? LIMIT 1`)
      .get(event.provider_payment_id ?? null, event.provider_checkout_id, event.intent_id ?? null) as SqliteRow | undefined;
    const listingId = event.listing_id ?? (payment ? nullableString(payment.listing_id) : null);
    const row = listingId ? listingRowById(db, listingId) : undefined;
    return { status: "replayed", listing: row ? listingFromRow(row) : undefined, intentId: event.intent_id ?? undefined };
  }
  return { status: event.outcome === "reconciliation_required" ? "reconciliation_required" : "rejected", reason: event.reason ?? undefined, intentId: event.intent_id ?? undefined };
}

function storeRejectedSettlement(
  db: AppDb,
  event: PaymentEventInput,
  intent: CheckoutIntentRow | undefined,
  reason: string,
  outcome: "rejected" | "reconciliation_required",
  providerPaidAt?: string,
): SettlementResult {
  if (outcome === "reconciliation_required" && intent) {
    recordReconciliationPaymentWithinTransaction(db, event, intent, providerPaidAt ?? event.received_at);
  }
  const eventRow = insertEventWithinTransaction(db, { ...event, outcome, reason });
  if (intent) {
    const nextStatus = isTerminalCheckoutIntentStatus(intent.status)
      ? intent.status
      : outcome === "reconciliation_required" ? "needs_reconciliation" : outcome;
    const nextReason = isTerminalCheckoutIntentStatus(intent.status) ? intent.reason : reason;
    db.sqlite
      .prepare("UPDATE checkout_intents SET status = ?, reason = ?, updated_at = ? WHERE id = ?")
      .run(nextStatus, nextReason, new Date().toISOString(), intent.id);
  }
  return { status: outcome, reason, intentId: intent?.id };
}

function recordReconciliationPaymentWithinTransaction(
  db: AppDb,
  event: PaymentEventInput,
  intent: CheckoutIntentRow,
  providerPaidAt: string,
): void {
  const providerCheckoutId = event.provider_checkout_id;
  const compatibilitySession = providerCheckoutId ?? `intent_${intent.id}`;
  const payment: PaymentRow = {
    id: `pay_${intent.id}`,
    listing_id: null,
    polar_session: compatibilitySession,
    provider_checkout_id: providerCheckoutId,
    provider_order_id: event.provider_order_id ?? null,
    provider_payment_id: event.provider_payment_id ?? null,
    intent_id: intent.id,
    amount_usd: intent.charge_cents / 100,
    amount_cents: intent.charge_cents,
    kind: intent.kind,
    target_bid_cents: intent.target_bid_cents,
    quote_base_bid_cents: intent.quote_base_bid_cents,
    currency: intent.currency,
    product_id: intent.product_id,
    facts_fingerprint: incomingPaymentFingerprint({
      sessionId: compatibilitySession,
      intentId: intent.id,
      amountUsd: intent.charge_cents / 100,
      amountCents: intent.charge_cents,
      kind: intent.kind,
      paidAt: providerPaidAt,
      providerCheckoutId,
      providerOrderId: event.provider_order_id,
      providerPaymentId: event.provider_payment_id,
      targetBidUsd: intent.target_bid_cents / 100,
      quoteBaseBidUsd: intent.quote_base_bid_cents === null ? null : intent.quote_base_bid_cents / 100,
      currency: intent.currency,
      productId: intent.product_id,
    }, intent.id, providerCheckoutId),
    status: "reconciliation_required",
    reason: "captured_payment_requires_reconciliation",
    provider_paid_at: providerPaidAt,
  };
  const existing = paymentByAnyIdentity(db, payment);
  if (!existing) {
    insertPaymentWithinTransaction(db, payment);
    return;
  }
  if (!paymentFactsEqual(existing, payment) || existing.status !== "reconciliation_required") {
    insertConflictWithinTransaction(
      db,
      "payment",
      paymentIdentity(existing),
      existing.facts_fingerprint,
      payment.facts_fingerprint ?? paymentFactsFingerprint(payment),
      event.payload_json,
    );
  }
}

/**
 * Apply a verified provider event and all ledger/listing changes atomically.
 * There is no process-local pending write or post-transaction reconciliation.
 */
export function settlePaidEvent(db: AppDb, input: PaidSettlementInput): SettlementResult {
  return db.runTransaction(() => {
    // A verified Waffo event may omit checkout/session ID. In that case the
    // immutable local intent and provider order/payment IDs are the
    // correlation boundary; do not alias a local intent or order ID into a
    // fake provider checkout ID. Legacy fixture/domain callers still carry a
    // concrete checkout/session ID and retain that compatibility behavior.
    const providerCheckoutId = input.providerCheckoutId ?? (
      input.payloadJson || input.providerEventId || input.providerOrderId || input.providerPaymentId
        ? null
        : input.sessionId
    );
    const fallbackIdentity = providerCheckoutId ?? input.sessionId;
    const providerEventId = input.providerEventId ?? `delivery_${fallbackIdentity}`;
    const businessEventId = input.businessEventId ?? input.providerPaymentId ?? input.providerOrderId ?? `business_${fallbackIdentity}`;
    const eventType = input.eventType ?? "order.completed";
    const payloadJson = input.payloadJson ?? null;
    const eventInput: PaymentEventInput = {
      provider_event_id: providerEventId,
      provider_checkout_id: providerCheckoutId,
      provider_order_id: input.providerOrderId ?? null,
      provider_payment_id: input.providerPaymentId ?? null,
      business_event_id: businessEventId,
      // Keep the foreign-key column null until the local intent has been
      // looked up.  A provider-supplied unknown intent ID is still recorded in
      // the payload/reason, but must not be inserted as a dangling FK.
      intent_id: null,
      event_type: eventType,
      received_at: new Date().toISOString(),
      payload_json: payloadJson,
      body_hash: payloadJson ? sha256(payloadJson) : input.payloadFingerprint ?? null,
      fingerprint: undefined,
    };
    const knownIntent = input.intentId ? getCheckoutIntent(db, input.intentId) : undefined;
    eventInput.intent_id = knownIntent?.id ?? null;
    const incomingEventFingerprint = settlementEventFingerprint(input, eventInput);
    eventInput.fingerprint = incomingEventFingerprint;
    const incomingEventBodyHash = eventBodyHash(eventInput);

    const existingDeliveryRow = db.sqlite.prepare("SELECT * FROM payment_events WHERE provider_event_id = ?").get(providerEventId) as SqliteRow | undefined;
    if (existingDeliveryRow) {
      const existingDelivery = decodeEvent(existingDeliveryRow);
      if (eventIdentityMatches(existingDelivery, incomingEventFingerprint, incomingEventBodyHash)) return eventResultFromStored(db, existingDelivery);
      insertConflictWithinTransaction(db, "delivery", providerEventId, eventStoredFingerprint(existingDelivery), incomingEventFingerprint, payloadJson);
      return { status: "rejected", reason: "delivery_identity_reuse", intentId: input.intentId ?? undefined };
    }
    const existingBusinessRow = db.sqlite.prepare("SELECT * FROM payment_events WHERE event_type = ? AND business_event_id = ?").get(eventType, businessEventId) as SqliteRow | undefined;
    if (existingBusinessRow) {
      const existingBusiness = decodeEvent(existingBusinessRow);
      if (eventIdentityMatches(existingBusiness, incomingEventFingerprint, incomingEventBodyHash)) return eventResultFromStored(db, existingBusiness);
      insertConflictWithinTransaction(db, "business_event", `${eventType}:${businessEventId}`, eventStoredFingerprint(existingBusiness), incomingEventFingerprint, payloadJson);
      return { status: "rejected", reason: "business_event_identity_reuse", intentId: input.intentId ?? undefined };
    }

    // A provider order, payment, or checkout can only be associated with one
    // immutable event outcome. Check these identities before validation so a
    // malformed or unknown-intent delivery cannot create a second ledger row
    // that bypasses the unique provider identity indexes below.
    const priorProviderIdentity = paymentEventByProviderIdentity(db, eventInput);
    if (priorProviderIdentity) {
      if (eventIdentityMatches(priorProviderIdentity, incomingEventFingerprint, incomingEventBodyHash)) {
        return eventResultFromStored(db, priorProviderIdentity);
      }
      const identity = providerEventIdentity(eventInput);
      insertConflictWithinTransaction(
        db,
        identity.kind,
        identity.value,
        eventStoredFingerprint(priorProviderIdentity),
        incomingEventFingerprint,
        payloadJson,
      );
      return { status: "rejected", reason: "provider_identity_reuse", intentId: input.intentId ?? undefined };
    }

    const intentId = input.intentId ?? undefined;
    const intent = knownIntent;
    if (!intent) return storeRejectedSettlement(db, eventInput, undefined, "unknown_intent", "rejected");
    if (isTerminalCheckoutIntentStatus(intent.status)) {
      return storeRejectedSettlement(db, eventInput, intent, `intent_${intent.status}_terminal`, "rejected");
    }

    const amountCents = input.amountCents ?? Math.round(input.amountUsd * 100);
    const incomingMetadata = input.metadata ?? {};
    const expectedMetadata = parseMetadata(intent.metadata_json);
    const expectedDraft = parseDraft(intent.listing_draft_json);
    const metadataMatches = metadataJson(incomingMetadata) === metadataJson(expectedMetadata);
    const draftMatches = input.listingDraft ? draftJson(input.listingDraft) === intent.listing_draft_json : true;
    const checkoutOwner = providerCheckoutId ? checkoutIntentByProviderCheckout(db, providerCheckoutId) : undefined;
    const providerCheckoutMatches = intent.provider_checkout_id === null
      ? !checkoutOwner || checkoutOwner.id === intent.id
      : intent.provider_checkout_id === providerCheckoutId;
    const factsMatch =
      !input.validationError &&
      eventType === "order.completed" &&
      providerCheckoutMatches &&
      input.kind === intent.kind &&
      input.currency === intent.currency &&
      (input.productId ?? intent.product_id) === intent.product_id &&
      Number.isFinite(input.amountUsd) && Math.round(input.amountUsd * 100) === amountCents &&
      amountCents === intent.charge_cents &&
      Math.round((input.targetBidUsd ?? intent.target_bid_cents / 100) * 100) === intent.target_bid_cents &&
      (input.quoteBaseBidUsd === null || input.quoteBaseBidUsd === undefined || Math.round(input.quoteBaseBidUsd * 100) === intent.quote_base_bid_cents) &&
      (input.intentFingerprint ?? intent.fingerprint) === intent.fingerprint &&
      metadataMatches &&
      draftMatches &&
      (input.providerCheckoutId === null || input.providerCheckoutId === undefined || input.sessionId === providerCheckoutId);
    eventInput.intent_id = intent.id;
    if (!factsMatch) return storeRejectedSettlement(db, eventInput, intent, "immutable_fact_mismatch", "rejected");

    const paymentFingerprint = incomingPaymentFingerprint(input, intent.id, providerCheckoutId);
    const paymentIdentityRow = db.sqlite
      .prepare(`${PAYMENT_SELECT} WHERE provider_checkout_id = ? OR provider_order_id = ? OR provider_payment_id = ? OR intent_id = ? LIMIT 1`)
      .get(providerCheckoutId, input.providerOrderId ?? null, input.providerPaymentId ?? null, intent.id) as SqliteRow | undefined;
    if (paymentIdentityRow) {
      const existingPayment = decodePayment(paymentIdentityRow);
      if (existingPayment.facts_fingerprint === paymentFingerprint && existingPayment.status === "applied") {
        const existingEvent = insertEventWithinTransaction(db, { ...eventInput, outcome: "replayed", listing_id: existingPayment.listing_id });
        return eventResultFromStored(db, existingEvent);
      }
      insertConflictWithinTransaction(db, "payment", paymentIdentity(existingPayment), existingPayment.facts_fingerprint, paymentFingerprint, payloadJson);
      return storeRejectedSettlement(db, eventInput, intent, "payment_identity_reuse", "rejected");
    }

    // The provider event timestamp is the settlement clock. This keeps a
    // delayed webhook from changing which seven-day cycle it belongs to and
    // makes restart/replay deterministic.
    const paidAt = canonicalUtcTimestamp(input.paidAt);
    if (!paidAt) return storeRejectedSettlement(db, eventInput, intent, "invalid_paid_at", "rejected");
    const now = new Date(paidAt);
    const live = findLiveListingByVenueKey(db, venueKey(expectedDraft), now);
    const targetBidUsd = intent.target_bid_cents / 100;
    let listing: Listing;
    if (intent.kind === "create") {
      if (live) return storeRejectedSettlement(db, eventInput, intent, "live_cycle_changed", "reconciliation_required", paidAt);
      listing = createListing({
        id: `lst_${intent.id}`,
        city: expectedDraft.city,
        windowId: expectedDraft.windowId,
        venueName: expectedDraft.venueName,
        bookingUrl: expectedDraft.bookingUrl,
        kind: expectedDraft.kind,
        pitch: expectedDraft.pitch,
        bidUsd: targetBidUsd,
        firstPaidAt: paidAt,
        lastPaidAt: paidAt,
        clicks: 0,
      });
      insertListing(db, listing);
    } else {
      if (!live || intent.quote_base_bid_cents === null || live.bidUsd * 100 !== intent.quote_base_bid_cents || targetBidUsd <= live.bidUsd || intent.charge_cents !== (targetBidUsd - live.bidUsd) * 100) {
        return storeRejectedSettlement(db, eventInput, intent, "stale_raise_requires_reconciliation", "reconciliation_required", paidAt);
      }
      listing = raiseListing(live, {
        targetBidUsd,
        lastPaidAt: paidAt,
        venueName: expectedDraft.venueName,
        bookingUrl: expectedDraft.bookingUrl,
        kind: expectedDraft.kind,
        pitch: expectedDraft.pitch,
      });
      db.sqlite.prepare("UPDATE listings SET bid_usd = ?, last_paid_at = ? WHERE id = ?").run(listing.bidUsd, listing.lastPaidAt, listing.id);
    }

    // A timeout can lose the create response even though Waffo later includes
    // the checkout ID in its signed order event. Claim that immutable provider
    // identity inside this same transaction; never let a checkout owned by a
    // different intent attach to the current listing.
    if (providerCheckoutId && intent.provider_checkout_id === null) {
      db.sqlite
        .prepare("UPDATE checkout_intents SET provider_checkout_id = ?, updated_at = ? WHERE id = ? AND provider_checkout_id IS NULL")
        .run(providerCheckoutId, new Date().toISOString(), intent.id);
    }

    const payment: PaymentRow = {
      id: `pay_${intent.id}`,
      listing_id: listing.id,
      polar_session: providerCheckoutId ?? `intent_${intent.id}`,
      provider_checkout_id: providerCheckoutId,
      provider_order_id: input.providerOrderId ?? null,
      provider_payment_id: input.providerPaymentId ?? null,
      intent_id: intent.id,
      amount_usd: intent.charge_cents / 100,
      amount_cents: intent.charge_cents,
      kind: intent.kind,
      target_bid_cents: intent.target_bid_cents,
      quote_base_bid_cents: intent.quote_base_bid_cents,
      currency: intent.currency,
      product_id: intent.product_id,
      facts_fingerprint: paymentFingerprint,
      status: "applied",
      provider_paid_at: paidAt,
    };
    insertPaymentWithinTransaction(db, payment);
    const appliedEvent = insertEventWithinTransaction(db, { ...eventInput, intent_id: intent.id, outcome: "applied", listing_id: listing.id });
    db.sqlite
      .prepare(
        `UPDATE checkout_intents SET status = 'paid', provider_order_id = ?, provider_payment_id = ?, provider_event_id = ?, business_event_id = ?, paid_at = ?, reason = NULL, updated_at = ? WHERE id = ?`,
      )
      .run(input.providerOrderId ?? null, input.providerPaymentId ?? null, providerEventId, businessEventId, paidAt, new Date().toISOString(), intent.id);
    return { status: "applied", listing, intentId: intent.id };
  });
}

const CURRENT_LISTINGS_TABLE_SQL = `
CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  city TEXT NOT NULL REFERENCES cities(slug),
  window_id TEXT NOT NULL,
  venue_key TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  kind TEXT,
  booking_url TEXT NOT NULL,
  pitch TEXT,
  bid_usd INTEGER NOT NULL,
  first_paid_at TEXT NOT NULL,
  last_paid_at TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0
)`;

const CURRENT_PAYMENTS_TABLE_SQL = `
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  listing_id TEXT REFERENCES listings(id),
  polar_session TEXT NOT NULL,
  provider_checkout_id TEXT,
  provider_order_id TEXT,
  provider_payment_id TEXT,
  intent_id TEXT REFERENCES checkout_intents(id),
  amount_usd INTEGER NOT NULL,
  amount_cents INTEGER,
  kind TEXT NOT NULL CHECK (kind IN ('create', 'raise')),
  target_bid_cents INTEGER,
  quote_base_bid_cents INTEGER,
  currency TEXT,
  product_id TEXT,
  facts_fingerprint TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  reason TEXT,
  provider_paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const CURRENT_PAYMENT_EVENTS_TABLE_SQL = `
CREATE TABLE payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_event_id TEXT NOT NULL UNIQUE,
  provider_checkout_id TEXT,
  provider_order_id TEXT,
  provider_payment_id TEXT,
  business_event_id TEXT,
  intent_id TEXT REFERENCES checkout_intents(id),
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL,
  payload_json TEXT,
  body_hash TEXT,
  fingerprint TEXT,
  outcome TEXT NOT NULL DEFAULT 'rejected',
  reason TEXT,
  listing_id TEXT REFERENCES listings(id)
)`;

function tableExists(sqlite: SqliteDatabase, table: string): boolean {
  return Boolean(
    sqlite
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table),
  );
}

function tableColumns(sqlite: SqliteDatabase, table: string): string[] {
  return (sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name);
}

function quotedIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function listingsHaveVenueUnique(sqlite: SqliteDatabase): boolean {
  if (!tableExists(sqlite, "listings")) return false;
  const indexes = sqlite.prepare("PRAGMA index_list(listings)").all() as Array<{ name: string; unique: number }>;
  return indexes.some((index) => {
    if (Number(index.unique) !== 1) return false;
    const columns = sqlite
      .prepare(`PRAGMA index_info(${quotedIdentifier(index.name)})`)
      .all() as Array<{ name: string | null }>;
    return columns.length === 1 && columns[0]?.name === "venue_key";
  });
}

function copySharedColumns(sqlite: SqliteDatabase, target: string, source: string, columns: readonly string[]): void {
  const sourceColumns = new Set(tableColumns(sqlite, source));
  const shared = columns.filter((column) => sourceColumns.has(column));
  if (shared.length === 0) return;
  const quoted = shared.map(quotedIdentifier).join(", ");
  sqlite.exec(`INSERT INTO ${quotedIdentifier(target)} (${quoted}) SELECT ${quoted} FROM ${quotedIdentifier(source)}`);
}

function repairListingHistorySchema(sqlite: SqliteDatabase): void {
  if (!listingsHaveVenueUnique(sqlite)) return;

  const hasPayments = tableExists(sqlite, "payments");
  const hasPaymentEvents = tableExists(sqlite, "payment_events");
  const oldListings = "listings_before_history_rebuild";
  const oldPayments = "payments_before_history_rebuild";
  const oldPaymentEvents = "payment_events_before_history_rebuild";
  const foreignKeysWereEnabled = Number(sqlite.pragma("foreign_keys", { simple: true })) === 1;
  sqlite.pragma("foreign_keys = OFF");
  try {
    // Drop names that the rebuilt tables will reclaim.  Dropping the old
    // tables also removes their auto-indexes, including UNIQUE(venue_key).
    for (const index of [
      "idx_listings_venue_key",
      "idx_payments_listing",
      "idx_payments_checkout",
      "idx_payments_order",
      "idx_payments_payment",
      "idx_payments_intent_applied",
      "idx_payment_events_checkout",
      "idx_payment_events_order",
      "idx_payment_events_payment",
      "idx_payment_events_business",
    ]) sqlite.exec(`DROP INDEX IF EXISTS ${quotedIdentifier(index)}`);

    if (hasPayments) sqlite.exec(`ALTER TABLE payments RENAME TO ${quotedIdentifier(oldPayments)}`);
    if (hasPaymentEvents) sqlite.exec(`ALTER TABLE payment_events RENAME TO ${quotedIdentifier(oldPaymentEvents)}`);
    sqlite.exec(`ALTER TABLE listings RENAME TO ${quotedIdentifier(oldListings)}`);

    sqlite.exec(CURRENT_LISTINGS_TABLE_SQL);
    copySharedColumns(sqlite, "listings", oldListings, LISTING_COLUMNS);
    if (hasPayments) {
      sqlite.exec(CURRENT_PAYMENTS_TABLE_SQL);
      copySharedColumns(sqlite, "payments", oldPayments, PAYMENT_COLUMNS);
    }
    if (hasPaymentEvents) {
      sqlite.exec(CURRENT_PAYMENT_EVENTS_TABLE_SQL);
      copySharedColumns(sqlite, "payment_events", oldPaymentEvents, [
        "id",
        "provider_event_id",
        "provider_checkout_id",
        "provider_order_id",
        "provider_payment_id",
        "business_event_id",
        "intent_id",
        "event_type",
        "received_at",
        "payload_json",
        "body_hash",
        "fingerprint",
        "outcome",
        "reason",
        "listing_id",
      ]);
    }

    if (hasPayments) sqlite.exec(`DROP TABLE ${quotedIdentifier(oldPayments)}`);
    if (hasPaymentEvents) sqlite.exec(`DROP TABLE ${quotedIdentifier(oldPaymentEvents)}`);
    sqlite.exec(`DROP TABLE ${quotedIdentifier(oldListings)}`);
  } finally {
    if (foreignKeysWereEnabled) sqlite.pragma("foreign_keys = ON");
  }
}

function paymentEventsHaveCheckoutNotNull(sqlite: SqliteDatabase): boolean {
  if (!tableExists(sqlite, "payment_events")) return false;
  const column = (sqlite.prepare("PRAGMA table_info(payment_events)").all() as Array<{ name: string; notnull: number }>).find(
    (row) => row.name === "provider_checkout_id",
  );
  return Boolean(column && Number(column.notnull) === 1);
}

/** Upgrade the first R2 schema that made checkout ID mandatory. */
function repairPaymentEventCheckoutSchema(sqlite: SqliteDatabase): void {
  if (!paymentEventsHaveCheckoutNotNull(sqlite)) return;
  const oldPaymentEvents = "payment_events_before_checkout_nullable";
  const foreignKeysWereEnabled = Number(sqlite.pragma("foreign_keys", { simple: true })) === 1;
  sqlite.pragma("foreign_keys = OFF");
  try {
    for (const index of [
      "idx_payment_events_checkout",
      "idx_payment_events_order",
      "idx_payment_events_payment",
      "idx_payment_events_business",
    ]) sqlite.exec(`DROP INDEX IF EXISTS ${quotedIdentifier(index)}`);
    sqlite.exec(`ALTER TABLE payment_events RENAME TO ${quotedIdentifier(oldPaymentEvents)}`);
    sqlite.exec(CURRENT_PAYMENT_EVENTS_TABLE_SQL);
    copySharedColumns(sqlite, "payment_events", oldPaymentEvents, [
      "id",
      "provider_event_id",
      "provider_checkout_id",
      "provider_order_id",
      "provider_payment_id",
      "business_event_id",
      "intent_id",
      "event_type",
      "received_at",
      "payload_json",
      "body_hash",
      "fingerprint",
      "outcome",
      "reason",
      "listing_id",
    ]);
    sqlite.exec(`DROP TABLE ${quotedIdentifier(oldPaymentEvents)}`);
  } finally {
    if (foreignKeysWereEnabled) sqlite.pragma("foreign_keys = ON");
  }
}

function ensurePaymentEventIdentityIndexes(sqlite: SqliteDatabase): void {
  if (!tableExists(sqlite, "payment_events")) return;
  // Older R1/R2 files used ordinary indexes for these columns. Recreate them
  // as partial unique indexes so NULL (an official Waffo event may omit a
  // checkout field) remains allowed while every supplied provider identity is
  // immutable across all event outcomes.
  for (const index of [
    "idx_payment_events_checkout",
    "idx_payment_events_order",
    "idx_payment_events_payment",
  ]) sqlite.exec(`DROP INDEX IF EXISTS ${quotedIdentifier(index)}`);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_checkout
      ON payment_events(provider_checkout_id) WHERE provider_checkout_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_order
      ON payment_events(provider_order_id) WHERE provider_order_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_payment
      ON payment_events(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
  `);
}

function migrateSchema(sqlite: SqliteDatabase, backfillLegacyProviderCheckout = false): void {
  const paymentEventsRequiredCheckout = paymentEventsHaveCheckoutNotNull(sqlite);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS checkout_intents (
      id TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'fixture', city TEXT NOT NULL, window_id TEXT NOT NULL,
      store_id TEXT NOT NULL DEFAULT 'fixture', listing_draft_json TEXT NOT NULL DEFAULT '{}', kind TEXT NOT NULL DEFAULT 'create', target_bid_cents INTEGER NOT NULL DEFAULT 0,
      quote_base_bid_cents INTEGER, charge_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD', product_id TEXT NOT NULL DEFAULT 'fixture',
      tax_category TEXT NOT NULL DEFAULT 'digital_goods', metadata_json TEXT NOT NULL DEFAULT '{}', fingerprint TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'creating',
      provider_checkout_id TEXT, provider_order_id TEXT, provider_payment_id TEXT, provider_event_id TEXT, business_event_id TEXT,
      checkout_url TEXT, expires_at TEXT, reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, paid_at TEXT
    );
    CREATE TABLE IF NOT EXISTS payment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_event_id TEXT NOT NULL UNIQUE,
      provider_checkout_id TEXT,
      provider_order_id TEXT,
      provider_payment_id TEXT,
      business_event_id TEXT,
      intent_id TEXT REFERENCES checkout_intents(id),
      event_type TEXT NOT NULL,
      received_at TEXT NOT NULL,
      payload_json TEXT,
      body_hash TEXT,
      fingerprint TEXT,
      outcome TEXT NOT NULL DEFAULT 'rejected',
      reason TEXT,
      listing_id TEXT REFERENCES listings(id)
    );
    CREATE TABLE IF NOT EXISTS checkout_events (id INTEGER PRIMARY KEY AUTOINCREMENT, intent_id TEXT NOT NULL UNIQUE, provider_checkout_id TEXT NOT NULL UNIQUE, checkout_url TEXT NOT NULL, expires_at TEXT, request_fingerprint TEXT NOT NULL, response_json TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS payment_event_conflicts (id INTEGER PRIMARY KEY AUTOINCREMENT, identity_kind TEXT NOT NULL, identity_value TEXT NOT NULL, existing_fingerprint TEXT, incoming_fingerprint TEXT NOT NULL, payload_json TEXT, created_at TEXT NOT NULL);
  `);
  const addColumns: Array<[string, string]> = [
    ["checkout_intents", "store_id TEXT NOT NULL DEFAULT 'fixture'"], ["checkout_intents", "tax_category TEXT NOT NULL DEFAULT 'digital_goods'"],
    ["payments", "provider_checkout_id TEXT"], ["payments", "provider_order_id TEXT"], ["payments", "provider_payment_id TEXT"], ["payments", "intent_id TEXT"], ["payments", "amount_cents INTEGER"], ["payments", "target_bid_cents INTEGER"], ["payments", "quote_base_bid_cents INTEGER"], ["payments", "currency TEXT"], ["payments", "product_id TEXT"], ["payments", "facts_fingerprint TEXT"], ["payments", "status TEXT NOT NULL DEFAULT 'applied'"], ["payments", "reason TEXT"], ["payments", "provider_paid_at TEXT"], ["payments", "created_at TEXT"],
    ["payment_events", "provider_event_id TEXT"], ["payment_events", "provider_checkout_id TEXT"], ["payment_events", "provider_order_id TEXT"], ["payment_events", "provider_payment_id TEXT"], ["payment_events", "business_event_id TEXT"], ["payment_events", "intent_id TEXT"], ["payment_events", "event_type TEXT"], ["payment_events", "received_at TEXT"], ["payment_events", "body_hash TEXT"], ["payment_events", "fingerprint TEXT"], ["payment_events", "outcome TEXT NOT NULL DEFAULT 'rejected'"], ["payment_events", "reason TEXT"], ["payment_events", "listing_id TEXT"],
  ];
  for (const [table, definition] of addColumns) {
    const column = definition.split(" ", 1)[0];
    const present = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!present.some((row) => row.name === column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
  sqlite.exec(`
    ${backfillLegacyProviderCheckout ? "UPDATE payments SET provider_checkout_id = COALESCE(provider_checkout_id, polar_session) WHERE provider_checkout_id IS NULL;" : ""}
    UPDATE payments SET amount_cents = COALESCE(amount_cents, amount_usd * 100), currency = COALESCE(currency, 'USD'), status = COALESCE(status, 'applied'), created_at = COALESCE(created_at, CURRENT_TIMESTAMP);
    UPDATE payment_events SET provider_event_id = COALESCE(provider_event_id, 'legacy_delivery_' || id), event_type = COALESCE(event_type, 'order.completed'), received_at = COALESCE(received_at, CURRENT_TIMESTAMP), outcome = COALESCE(outcome, 'rejected');
    CREATE INDEX IF NOT EXISTS idx_payment_events_checkout ON payment_events(provider_checkout_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_checkout ON payments(provider_checkout_id) WHERE provider_checkout_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order ON payments(provider_order_id) WHERE provider_order_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_payment ON payments(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_intent_applied ON payments(intent_id) WHERE intent_id IS NOT NULL AND status = 'applied';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_business ON payment_events(event_type, business_event_id) WHERE business_event_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_intents_checkout ON checkout_intents(provider_checkout_id) WHERE provider_checkout_id IS NOT NULL;
  `);
  // The R1 venue uniqueness constraint must not keep blocking a new window
  // cycle.  SQLite represents an inline UNIQUE as an auto-index, so dropping
  // only the old named index is insufficient; rebuild the parent and its
  // ledger children when necessary.
  sqlite.exec("DROP INDEX IF EXISTS idx_listings_venue_key_unique");
  repairListingHistorySchema(sqlite);
  if (paymentEventsRequiredCheckout) repairPaymentEventCheckoutSchema(sqlite);
  ensurePaymentEventIdentityIndexes(sqlite);
}

export function ensureDatabaseDir(path: string): void {
  if (path === ":memory:") return;
  mkdirSync(dirname(path), { recursive: true });
}

function recoverCreatingIntents(sqlite: SqliteDatabase): void {
  // A process can die after the intent commit but before the provider response
  // is attached. On the next process, classify that durable gap as ambiguous;
  // the later signed event can still correlate by external intent ID and
  // metadata fingerprint. This never marks an already-open/paid intent.
  sqlite
    .prepare(
      `UPDATE checkout_intents
       SET status = 'unknown', reason = COALESCE(reason, 'provider_checkout_ambiguous_after_restart'), updated_at = ?
       WHERE status = 'creating'`,
    )
    .run(new Date().toISOString());
}

export function openDatabase(path: string = defaultDatabasePath()): AppDb {
  if (path !== ":memory:") ensureDatabaseDir(path);
  const sqlite = new Database(path);
  try {
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    if (path !== ":memory:") sqlite.pragma("journal_mode = WAL");
    const legacyPayments = sqlite
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'payments'")
      .get();
    const hasProviderCheckoutColumn = legacyPayments
      ? (sqlite.prepare("PRAGMA table_info(payments)").all() as Array<{ name: string }>).some((row) => row.name === "provider_checkout_id")
      : true;
    // The current SCHEMA_SQL contains indexes over the new columns. Upgrade
    // an R1 file's columns first so SQLite can parse those indexes.
    if (legacyPayments && !hasProviderCheckoutColumn) migrateSchema(sqlite, true);
    sqlite.exec(SCHEMA_SQL);
    migrateSchema(sqlite);
    recoverCreatingIntents(sqlite);
    return seedCities(new AppDb(sqlite));
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

let cached: AppDb | undefined;
let cachedPath: string | undefined;

export function getDb(): AppDb {
  const path = defaultDatabasePath();
  if (!cached || cachedPath !== path) {
    cached?.close();
    cached = openDatabase(path);
    cachedPath = path;
  }
  return cached;
}

export function resetDbCache(): void {
  cached?.close();
  cached = undefined;
  cachedPath = undefined;
}
