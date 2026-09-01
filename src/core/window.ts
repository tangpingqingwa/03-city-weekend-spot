import { resolveCity, type City, type CitySlug } from "./cities";

/** Weekly weekend window in the city’s IANA timezone (SPEC §4). */
export const WINDOW_START_WEEKDAY = 4; // Thursday (JS: 0=Sun)
export const WINDOW_START_HOUR = 12;
export const WINDOW_END_WEEKDAY = 0; // Sunday
export const WINDOW_END_HOUR = 23;
export const WINDOW_END_MINUTE = 59;
export const WINDOW_END_SECOND = 59;
export const WINDOW_END_MS = 999;

const DAY_MS = 86_400_000;
/** Inclusive length of the occupied poster window. Not Monday midnight UTC. */
export const ROLLING_WEEK_MS = 7 * DAY_MS;

export type WeekendWindow = {
  id: string;
  city: CitySlug;
  isoWeek: string;
  timezone: string;
  startsAt: Date;
  endsAt: Date;
};

export type WindowErrorCode = "city_unknown" | "city_inactive" | "window_closed";

export type ResolveWindowResult =
  | { ok: true; window: WeekendWindow; city: City }
  | { ok: false; code: WindowErrorCode; http: 400 | 404 };

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const zonedFormatterCache = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = zonedFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    zonedFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function requirePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) {
    throw new Error(`missing ${type} in zoned datetime`);
  }
  return value;
}

/** Calendar parts of `instant` in `timeZone`. Weekday is JS-style (Sun=0). */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = zonedFormatter(timeZone).formatToParts(instant);
  const weekdayLabel = requirePart(parts, "weekday");
  const weekday = WEEKDAY_INDEX[weekdayLabel];
  if (weekday === undefined) {
    throw new Error(`unknown weekday ${JSON.stringify(weekdayLabel)}`);
  }
  return {
    year: Number(requirePart(parts, "year")),
    month: Number(requirePart(parts, "month")),
    day: Number(requirePart(parts, "day")),
    hour: Number(requirePart(parts, "hour")),
    minute: Number(requirePart(parts, "minute")),
    second: Number(requirePart(parts, "second")),
    weekday,
  };
}

/**
 * Instant that displays as `year-month-day hour:minute:second.ms` in `timeZone`.
 * Binary-search UTC so DST transitions do not invent a second clock.
 */
export function zonedLocalInstant(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let lo = target - 36 * 60 * 60 * 1000;
  let hi = target + 36 * 60 * 60 * 1000;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const parts = zonedParts(new Date(mid), timeZone);
    const candidate = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      new Date(mid).getUTCMilliseconds(),
    );
    if (candidate === target) {
      return new Date(mid);
    }
    if (candidate < target) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  throw new Error(
    `could not resolve ${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond} in ${timeZone}`,
  );
}

function addLocalDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/** JS Sunday=0 → ISO Monday=1 … Sunday=7. */
function isoWeekday(jsWeekday: number): number {
  return jsWeekday === 0 ? 7 : jsWeekday;
}

/** Thursday of the ISO week that contains this local calendar date. */
function thursdayOfIsoWeek(parts: Pick<ZonedParts, "year" | "month" | "day" | "weekday">): {
  year: number;
  month: number;
  day: number;
} {
  return addLocalDays(parts.year, parts.month, parts.day, 4 - isoWeekday(parts.weekday));
}

/**
 * ISO week of the local calendar date, Thursday-anchored (ISO-8601).
 * Format `YYYY-Www`. The Thursday of the week decides the ISO year.
 */
export function isoWeekFromParts(
  parts: Pick<ZonedParts, "year" | "month" | "day" | "weekday">,
): string {
  const thursday = thursdayOfIsoWeek(parts);
  const jan4 = new Date(Date.UTC(thursday.year, 0, 4));
  const week1Thursday = thursdayOfIsoWeek({
    year: thursday.year,
    month: 1,
    day: 4,
    weekday: jan4.getUTCDay(),
  });
  const week1Ms = Date.UTC(
    week1Thursday.year,
    week1Thursday.month - 1,
    week1Thursday.day,
  );
  const thisMs = Date.UTC(thursday.year, thursday.month - 1, thursday.day);
  const week = Math.floor((thisMs - week1Ms) / (7 * 86_400_000)) + 1;
  return `${thursday.year}-W${String(week).padStart(2, "0")}`;
}

export function windowIdFor(city: CitySlug, isoWeek: string): string {
  return `${city}:${isoWeek}`;
}

function thursdayNoon(city: City, year: number, month: number, day: number): Date {
  return zonedLocalInstant(
    city.timezone,
    year,
    month,
    day,
    WINDOW_START_HOUR,
    0,
    0,
    0,
  );
}

function sundayEnd(city: City, thursday: { year: number; month: number; day: number }): Date {
  const daysUntilSunday = (WINDOW_END_WEEKDAY + 7 - WINDOW_START_WEEKDAY) % 7;
  const sunday = addLocalDays(
    thursday.year,
    thursday.month,
    thursday.day,
    daysUntilSunday,
  );
  return zonedLocalInstant(
    city.timezone,
    sunday.year,
    sunday.month,
    sunday.day,
    WINDOW_END_HOUR,
    WINDOW_END_MINUTE,
    WINDOW_END_SECOND,
    WINDOW_END_MS,
  );
}

function windowFromThursday(
  city: City,
  thursday: { year: number; month: number; day: number },
): WeekendWindow {
  const isoWeek = isoWeekFromParts({
    year: thursday.year,
    month: thursday.month,
    day: thursday.day,
    weekday: WINDOW_START_WEEKDAY,
  });
  return {
    id: windowIdFor(city.slug, isoWeek),
    city: city.slug,
    isoWeek,
    timezone: city.timezone,
    startsAt: thursdayNoon(city, thursday.year, thursday.month, thursday.day),
    endsAt: sundayEnd(city, thursday),
  };
}

/**
 * Current weekly weekend window for `city` at `now`.
 * Id is `{city}:{iso_week}` in that city’s timezone (ISO week, Thursday-anchored).
 * Bidding is open Thursday 12:00 through Sunday 23:59:59.999 inclusive.
 * Monday 00:00 is already the next ISO week’s (still closed) window.
 * Occupied poster rank uses rolling last 7 days from paid createdAt, not this
 * civil Monday midnight cut.
 */
export function currentWindow(city: City, now: Date = new Date()): WeekendWindow {
  const parts = zonedParts(now, city.timezone);
  return windowFromThursday(city, thursdayOfIsoWeek(parts));
}

/** Inclusive start of the rolling last-7-days occupancy window. Not civil midnight. */
export function rollingWeekStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - ROLLING_WEEK_MS);
}

/**
 * Waffo-paid placement still occupies the poster if `paidAt` is in `[now − 7d, now]`.
 * Monday 00:00 UTC is not the drop. Not a 24h lock on #1.
 */
export function bidInRollingWeek(
  paidAt: string,
  now: Date = new Date(),
): boolean {
  const paid = Date.parse(paidAt);
  if (!Number.isFinite(paid) || paid <= 0) {
    return false;
  }
  const t = now.getTime();
  return paid >= t - ROLLING_WEEK_MS && paid <= t;
}

export function windowContains(window: WeekendWindow, instant: Date): boolean {
  const t = instant.getTime();
  return t >= window.startsAt.getTime() && t <= window.endsAt.getTime();
}

export function isWindowOpen(window: WeekendWindow, now: Date = new Date()): boolean {
  return windowContains(window, now);
}

export function resolveCurrentWindow(
  slug: string,
  now: Date = new Date(),
): ResolveWindowResult {
  const resolved = resolveCity(slug);
  if (!resolved.ok) {
    return { ok: false, code: resolved.code, http: 404 };
  }
  return { ok: true, city: resolved.city, window: currentWindow(resolved.city, now) };
}

export function assertWindowOpen(
  slug: string,
  now: Date = new Date(),
): ResolveWindowResult {
  const resolved = resolveCurrentWindow(slug, now);
  if (!resolved.ok) {
    return resolved;
  }
  if (!isWindowOpen(resolved.window, now)) {
    return { ok: false, code: "window_closed", http: 400 };
  }
  return resolved;
}
