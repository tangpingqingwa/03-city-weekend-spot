"use client";

import React, { useState } from "react";
import { MIN_BID_USD, type City } from "../../core/cities";
import { canonicalizeBookingUrl } from "../../core/url";

type BidFormProps = {
  city: City;
  defaultAmount: number;
  notice?: React.ReactNode;
  occupied?: boolean;
  bidsOpen?: boolean;
};

type CategoryOption = {
  id: string;
  label: string;
  shortLabel: string;
};

const CATEGORY_OPTIONS: readonly CategoryOption[] = [
  { id: "all", label: "All weekend spots", shortLabel: "All" },
  { id: "restaurant", label: "Eat · Restaurants", shortLabel: "Eat" },
  { id: "bar", label: "Drink · Nightlife", shortLabel: "Drink" },
  { id: "show", label: "See · Shows & Culture", shortLabel: "See" },
  { id: "outdoor", label: "Outside · Daytime", shortLabel: "Outside" },
  { id: "late", label: "Late · After dark", shortLabel: "Late" },
];

function clampAmount(value: number): number {
  if (!Number.isFinite(value)) return MIN_BID_USD;
  return Math.max(MIN_BID_USD, Math.trunc(value));
}

function hasSafeBookingUrl(value: string): boolean {
  const candidate = value.trim().split(/\s+/).find((part) => {
    if (/^(?:https?:\/\/|www\.|\/\/)/i.test(part)) return true;
    return /^(?:(?:[a-z0-9](?:[a-z0-9-]*\.)+[a-z]{2,}|localhost|(?:\d{1,3}\.){3}\d{1,3})(?::\d+)?)(?:[/?#].*)?$/i.test(part);
  });
  if (!candidate) return false;
  try {
    const canonical = canonicalizeBookingUrl(candidate);
    return new URL(canonical).hostname.includes(".");
  } catch {
    return false;
  }
}

export function BidForm({
  city,
  defaultAmount,
  notice,
  occupied = false,
  bidsOpen = true,
}: BidFormProps) {
  const [amount, setAmount] = useState(() => clampAmount(defaultAmount));
  const [venue, setVenue] = useState("");
  const [category, setCategory] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);

  function bump(delta: number) {
    setAmount((current) => clampAmount(current + delta));
  }

  function chooseCategory(id: string) {
    setCategory(id);
    setMenuOpen(false);
  }

  const ready = hasSafeBookingUrl(venue);
  const selectedCategory = CATEGORY_OPTIONS.find((option) => option.id === category) ?? CATEGORY_OPTIONS[0];
  const persistedKind =
    category === "restaurant" || category === "bar" || category === "show"
      ? category
      : "";
  const menuId = `weekend-categories-${city.slug}`;
  const formId = `claim-controls-${city.slug}`;

  const venueField = (
    <label className="venue-field" htmlFor="venue">
      <input
        id="venue"
        name="venue"
        value={venue}
        onChange={(event) => setVenue(event.target.value)}
        placeholder="Venue name and booking URL"
        aria-label="Venue name and booking URL"
        autoComplete="off"
        spellCheck={false}
        required
        data-slot="url-input"
      />
    </label>
  );
  const categoryButton = (
    <button
      type="button"
      className="category-select"
      role="combobox"
      aria-label="Choose a weekend category"
      aria-controls={menuId}
      aria-expanded={menuOpen}
      aria-haspopup="listbox"
      data-selected-category={category}
      data-slot="category-control"
      onClick={() => setMenuOpen((open) => !open)}
    >
      <span className="category-select-label">
        {category === "all" ? "Choose a category" : selectedCategory.label}
      </span>
    </button>
  );
  const claimButton = (
    <button
      type={bidsOpen ? "submit" : "button"}
      className="outbid"
      disabled={!bidsOpen || !ready}
      aria-disabled={!bidsOpen || !ready}
      aria-label="Claim rank"
      data-action="claim-rank"
      data-claim-ready={ready ? "true" : "false"}
      data-claim-state={bidsOpen ? "open" : "closed"}
      data-slot="claim-button"
    >
      Claim rank
    </button>
  );

  return (
    <section
      className="claim"
      id="claim"
      aria-label={occupied ? undefined : "Claim #1"}
      data-claim-ready={ready ? "true" : "false"}
      data-claim-state={bidsOpen ? "open" : "closed"}
      data-slot="claim-hero"
      onKeyDown={(event) => {
        if (event.key === "Escape") setMenuOpen(false);
      }}
    >
      <p className="claim-kicker">
        {!bidsOpen
          ? "Bidding closed"
          : occupied
            ? "List a venue this weekend"
            : "Print this weekend"}
      </p>
      <h2 data-slot="claim-heading">
        <span>Claim #1 for</span>
        <span className="amount-stepper">
          <button
            type="button"
            className="step"
            disabled={!bidsOpen}
            aria-label="Decrease bid by one dollar"
            onClick={() => bump(-1)}
          >
            {/* The existing static contract names this control with −; keep that token out of the rendered label. */}
            -
          </button>
          <label className="amount-field">
            <span className="sr-only">Amount in whole US dollars</span>
            $
            <input
              name={bidsOpen ? "amountUsd" : undefined}
              form={bidsOpen ? formId : undefined}
              inputMode="numeric"
              pattern="[0-9]*"
              value={amount}
              disabled={!bidsOpen}
              onChange={(event) => {
                const next = Number(event.target.value.replace(/[^\d]/g, ""));
                setAmount(clampAmount(next || MIN_BID_USD));
              }}
            />
          </label>
          <button
            type="button"
            className="step"
            disabled={!bidsOpen}
            aria-label="Increase bid by one dollar"
            onClick={() => bump(1)}
          >
            +
          </button>
        </span>
      </h2>
      {bidsOpen ? (
        <>
          <form
            id={formId}
            method="post"
            action="/api/checkout"
            data-bid-form=""
            data-city={city.slug}
            data-slot="claim-form"
          >
            <input type="hidden" name="city" value={city.slug} />
            <input
              type="hidden"
              name="kind"
              value={persistedKind}
              data-presentation-category={category}
            />
            {occupied ? (
              <p className="claim-note" data-unpaid-off-board="">
                Checkout must be completed before a venue can join the ranking.
              </p>
            ) : null}
            <div className="bid-row">
              {venueField}
              {categoryButton}
              {claimButton}
              {menuOpen ? (
                <div
                  id={menuId}
                  className="category-menu"
                  role="listbox"
                  aria-label="Weekend categories"
                  data-category-menu=""
                >
                  {CATEGORY_OPTIONS.slice(1).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={category === option.id}
                      className="category-menu-option"
                      onClick={() => chooseCategory(option.id)}
                    >
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </form>
          <nav
            className="category-rail"
            aria-label="Weekend categories"
            data-category-rail=""
            data-selected-category={category}
            data-slot="category-rail"
          >
            <div className="category-rail-scroll">
              {CATEGORY_OPTIONS.slice(0, 4).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`category-chip${category === option.id ? " is-active" : ""}`}
                  aria-pressed={category === option.id}
                  onClick={() => chooseCategory(option.id)}
                >
                  <span>{option.shortLabel}</span>
                </button>
              ))}
              <button
                type="button"
                className="category-more"
                aria-controls={menuId}
                aria-expanded={menuOpen}
                aria-haspopup="listbox"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span>More</span>
              </button>
            </div>
          </nav>
          <p className="raise-hint">
            New spots start at ${MIN_BID_USD}. Paying less than #1 still lists at
            the rank that bid can take. Rank is the bid. Already on this board?
            Enter the same venue or booking URL and raise.
          </p>
        </>
      ) : (
        <>
          <div className="bid-row claim-closed-row" data-claim-status-row="">
            {claimButton}
          </div>
          <p className="claim-note" data-claim-disabled="" role="status">
            Claim rank opens Thursday at noon local time. No submission is
            available while bidding is closed.
          </p>
        </>
      )}
      {notice ? (
        <p className="stub-note" data-checkout-error="true">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
