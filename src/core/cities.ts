export const CITY_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

export const MIN_BID_USD = 5;

export type CitySlug = string;

export type VenueKind = "restaurant" | "bar" | "show";

export type City = {
  slug: CitySlug;
  name: string;
  timezone: string;
  active: boolean;
};

export type CityErrorCode = "city_unknown" | "city_inactive";

export type ResolveCityResult =
  | { ok: true; city: City }
  | { ok: false; code: CityErrorCode };

export type BoardListing = {
  id: string;
  city: CitySlug;
  venueName: string;
  kind: VenueKind | null;
  bookingUrl: string;
  pitch: string | null;
  bidUsd: number;
  clicks: number;
  rank: number;
  /** Polar paid instant. Occupied #1 chrome only when this is set. */
  firstPaidAt?: string;
};

/** Catalog. Ranking is keyed by city slug; NYC is a row, not a special case. */
export const CITIES: readonly City[] = [
  {
    slug: "nyc",
    name: "New York City",
    timezone: "America/New_York",
    active: true,
  },
];

export function isCitySlug(value: string): boolean {
  return CITY_SLUG_PATTERN.test(value);
}

export function getCity(slug: string): City | undefined {
  return CITIES.find((city) => city.slug === slug);
}

export function activeCities(): readonly City[] {
  return CITIES.filter((city) => city.active);
}

export function cityError(city: City | undefined): CityErrorCode | null {
  if (!city) return "city_unknown";
  if (!city.active) return "city_inactive";
  return null;
}

export function resolveCity(slug: string): ResolveCityResult {
  if (!isCitySlug(slug)) {
    return { ok: false, code: "city_unknown" };
  }
  const city = getCity(slug);
  if (!city) return { ok: false, code: "city_unknown" };
  if (!city.active) return { ok: false, code: "city_inactive" };
  return { ok: true, city };
}

/** `/` sends here while exactly one city is active. */
export function defaultBoardPath(): string {
  const active = activeCities();
  const only = active[0];
  if (active.length === 1 && only) {
    return `/${only.slug}`;
  }
  return "/";
}

/** Live board has no paid rows until checkout lands. Never invent venues. */
export function getBoardListings(_city: CitySlug): BoardListing[] {
  return [];
}
