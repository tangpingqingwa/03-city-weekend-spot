"use client";

import React, { useState } from "react";
import { MIN_BID_USD, type City } from "../../core/cities";

type BidFormProps = {
  city: City;
  defaultAmount: number;
  notice?: string | null;
  occupied?: boolean;
};

function clampAmount(value: number): number {
  if (!Number.isFinite(value)) return MIN_BID_USD;
  return Math.max(MIN_BID_USD, Math.trunc(value));
}

export function BidForm({
  city,
  defaultAmount,
  notice,
  occupied = false,
}: BidFormProps) {
  const [amount, setAmount] = useState(() => clampAmount(defaultAmount));
  const [venue, setVenue] = useState("");

  function bump(delta: number) {
    setAmount((current) => clampAmount(current + delta));
  }

  return (
    <section className="claim" id="claim">
      <p className="claim-kicker">
        {occupied ? "List a venue this weekend" : "Print this weekend"}
      </p>
      <form
        method="post"
        action="/api/checkout"
        data-bid-form=""
        data-city={city.slug}
      >
        <input type="hidden" name="city" value={city.slug} />
        <h2>
          <span>Claim #1 for</span>
          <span className="amount-stepper">
            <button
              type="button"
              className="step"
              aria-label="Decrease bid by one dollar"
              onClick={() => bump(-1)}
            >
              −
            </button>
            <label className="amount-field">
              <span className="sr-only">Amount in whole US dollars</span>
              $
              <input
                name="amountUsd"
                inputMode="numeric"
                pattern="[0-9]*"
                value={amount}
                onChange={(event) => {
                  const next = Number(event.target.value.replace(/[^\d]/g, ""));
                  setAmount(clampAmount(next || MIN_BID_USD));
                }}
              />
            </label>
            <button
              type="button"
              className="step"
              aria-label="Increase bid by one dollar"
              onClick={() => bump(1)}
            >
              +
            </button>
          </span>
        </h2>
        <p className="claim-note">
          New spots start at ${MIN_BID_USD}. Paying less than #1 still lists at
          the rank that bid can take.
        </p>
        <div className="bid-row">
          <input
            id="venue"
            name="venue"
            value={venue}
            onChange={(event) => setVenue(event.target.value)}
            placeholder="Venue name and https booking URL"
            autoComplete="off"
            spellCheck={false}
            required
          />
          <button type="submit" className="outbid">
            Outbid
          </button>
        </div>
        <p className="raise-hint">
          Already on this board? Enter the same venue or booking URL and raise.
          Rank updates only after Polar checkout is paid.
        </p>
        {notice ? (
          <p className="stub-note" data-checkout-error="true">
            {notice}
          </p>
        ) : null}
      </form>
    </section>
  );
}
