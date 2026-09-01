export const PERIODS = ["weekend", "rolling"] as const;

export type BoardPeriod = (typeof PERIODS)[number];

export function periodFromQuery(
  value: string | string[] | undefined,
): BoardPeriod {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "rolling" ? "rolling" : "weekend";
}

export function periodHref(
  pathname: string,
  query: string,
  period: BoardPeriod,
): string {
  const next = new URLSearchParams(query);
  if (period === "rolling") {
    next.set("period", "rolling");
  } else {
    next.delete("period");
  }
  const serialized = next.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

export function periodFromKey(
  current: BoardPeriod,
  key: string,
): BoardPeriod | null {
  if (key === "Home") return PERIODS[0];
  if (key === "End") return PERIODS[PERIODS.length - 1];
  const index = PERIODS.indexOf(current);
  if (key === "ArrowRight" || key === "ArrowDown") {
    return PERIODS[(index + 1) % PERIODS.length];
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return PERIODS[(index - 1 + PERIODS.length) % PERIODS.length];
  }
  return null;
}
