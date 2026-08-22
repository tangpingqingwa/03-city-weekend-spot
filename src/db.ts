import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { CITIES, type City } from "./core/cities";
import type { Listing } from "./core/listing";
import type { WeekendWindow } from "./core/window";

export type AppDb = {
  cities: Map<string, CityRow>;
  windows: Map<string, WindowRow>;
  listings: Map<string, ListingRow>;
  payments: Map<string, PaymentRow>;
};

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

export type PaymentRow = {
  id: string;
  listing_id: string;
  polar_session: string;
  amount_usd: number;
  kind: "create" | "raise";
};

export const DEFAULT_DATABASE_PATH = "./data/city-weekend-spot.sqlite";

export function defaultDatabasePath(): string {
  return process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
}

function emptyDb(): AppDb {
  return {
    cities: new Map(),
    windows: new Map(),
    listings: new Map(),
    payments: new Map(),
  };
}

/** Ensure the on-disk directory exists. Tests use `:memory:` and skip this. */
export function ensureDatabaseDir(path: string): void {
  if (path === ":memory:") {
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
}

export function cityToRow(city: City): CityRow {
  return {
    slug: city.slug,
    name: city.name,
    timezone: city.timezone,
    active: city.active ? 1 : 0,
  };
}

export function windowToRow(window: WeekendWindow): WindowRow {
  return {
    id: window.id,
    city: window.city,
    starts_at: window.startsAt.toISOString(),
    ends_at: window.endsAt.toISOString(),
  };
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

function kindFromRow(kind: string | null): Listing["kind"] {
  if (kind === "restaurant" || kind === "bar" || kind === "show") {
    return kind;
  }
  return null;
}

export function listingFromRow(row: ListingRow): Listing {
  return {
    id: row.id,
    city: row.city,
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

/**
 * Schema for cities, windows, listings, payments.
 * SQLite via better-sqlite3 lands when checkout writes rows.
 * Tests and the live board stay empty until a paid event exists.
 */
export const SCHEMA_SQL = `
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
  window_id TEXT NOT NULL REFERENCES windows(id),
  venue_key TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  kind TEXT,
  booking_url TEXT NOT NULL,
  pitch TEXT,
  bid_usd INTEGER NOT NULL,
  first_paid_at TEXT NOT NULL,
  last_paid_at TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  UNIQUE (venue_key)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  polar_session TEXT NOT NULL,
  amount_usd INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('create', 'raise'))
);
`.trim();

export function seedCities(db: AppDb, cities: readonly City[] = CITIES): AppDb {
  for (const city of cities) {
    db.cities.set(city.slug, cityToRow(city));
  }
  return db;
}

export function upsertWindow(db: AppDb, window: WeekendWindow): WindowRow {
  const row = windowToRow(window);
  db.windows.set(row.id, row);
  return row;
}

export function insertListing(db: AppDb, listing: Listing): ListingRow {
  const row = listingToRow(listing);
  db.listings.set(row.id, row);
  return row;
}

export function listingsForCityWindow(
  db: AppDb,
  city: string,
  windowId: string,
): Listing[] {
  const rows: Listing[] = [];
  for (const row of db.listings.values()) {
    if (row.city === city && row.window_id === windowId) {
      rows.push(listingFromRow(row));
    }
  }
  return rows;
}

export function findListingByVenueKey(
  db: AppDb,
  venueKey: string,
): Listing | undefined {
  for (const row of db.listings.values()) {
    if (row.venue_key === venueKey) {
      return listingFromRow(row);
    }
  }
  return undefined;
}

export function updateListing(db: AppDb, listing: Listing): ListingRow {
  const row = listingToRow(listing);
  db.listings.set(row.id, row);
  return row;
}

export function openDatabase(_path: string = defaultDatabasePath()): AppDb {
  if (_path !== ":memory:") {
    ensureDatabaseDir(_path);
  }
  return seedCities(emptyDb());
}

let cached: AppDb | undefined;
let cachedPath: string | undefined;

export function getDb(): AppDb {
  const path = defaultDatabasePath();
  if (!cached || cachedPath !== path) {
    cached = openDatabase(path);
    cachedPath = path;
  }
  return cached;
}

export function resetDbCache(): void {
  cached = undefined;
  cachedPath = undefined;
}
