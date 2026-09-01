"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, type KeyboardEvent } from "react";
import {
  PERIODS,
  periodFromKey,
  periodHref,
  type BoardPeriod,
} from "./period-tabs-state";

const PERIOD_LABELS: Record<BoardPeriod, string> = {
  weekend: "Weekend",
  rolling: "Rolling 7 days",
};

export default function PeriodTabs() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const activePeriod: BoardPeriod =
    searchParams.get("period") === "rolling" ? "rolling" : "weekend";
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectPeriod(period: BoardPeriod) {
    router.replace(periodHref(pathname, searchParams.toString(), period), {
      scroll: false,
    });
  }

  function onTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    current: BoardPeriod,
  ) {
    const next = periodFromKey(current, event.key);
    if (!next) return;
    event.preventDefault();
    const nextIndex = PERIODS.indexOf(next);
    tabRefs.current[nextIndex]?.focus();
    selectPeriod(next);
  }

  return (
    <div
      className="period-pill"
      role="tablist"
      aria-label="Ranking period"
      data-slot="period-tabs"
      data-period-active={activePeriod}
    >
      {PERIODS.map((period, index) => {
        const active = activePeriod === period;
        return (
          <button
            key={period}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            className={`period-pill-item${active ? " is-active" : ""}`}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-period-option={
              period === "rolling" ? "rolling-7-days" : "weekend"
            }
            onClick={() => selectPeriod(period)}
            onKeyDown={(event) => onTabKeyDown(event, period)}
          >
            {PERIOD_LABELS[period]}
          </button>
        );
      })}
    </div>
  );
}
