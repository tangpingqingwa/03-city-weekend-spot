import React from "react";
import {
  MIN_BID_USD,
  getCity,
  type BoardListing,
  type City,
} from "../../core/cities";
import { isPaidListing } from "../../core/listing";
import { listingClickPath } from "../../core/click";
import { getCheckoutIntent, getDb } from "../../db";
import type { BoardPeriod } from "../period-tabs-state";
import { BidForm } from "./bid-form";

type CityBoardProps = {
  city: City;
  listings: readonly BoardListing[];
  period?: BoardPeriod;
  weekendLabel?: string;
  checkoutError?: string;
  now?: Date;
};

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export function formatClicks(clicks: number): string {
  return `${clicks} ${clicks === 1 ? "click" : "clicks"}`;
}

function kindLabel(kind: BoardListing["kind"]): string | null {
  if (!kind) return null;
  if (kind === "restaurant") return "Restaurant";
  if (kind === "bar") return "Bar";
  return "Show";
}

function BookingHop({
  listing,
  className,
  primary,
  guestFirst,
}: {
  listing: BoardListing;
  className: string;
  primary?: boolean;
  guestFirst?: boolean;
}) {
  return (
    <a
      className={className}
      href={listingClickPath(listing.id)}
      rel="noreferrer"
      data-booking-url={listing.bookingUrl}
      {...(primary ? { "data-book-number-one": "" } : {})}
      {...(guestFirst ? { "data-guest-first": "" } : {})}
      aria-label={`Book ${listing.venueName}`}
    >
      Book
    </a>
  );
}

function paidAtMs(listing: BoardListing): number | undefined {
  if (listing.firstPaidAt === undefined) return 1;
  return isPaidListing({ firstPaidAt: listing.firstPaidAt })
    ? Date.parse(listing.firstPaidAt)
    : undefined;
}

function validPaidTimestampMs(listing: BoardListing): number | undefined {
  if (!listing.firstPaidAt) return undefined;
  const timestamp = Date.parse(listing.firstPaidAt);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined;
}

function formatPaidTimestamp(listing: BoardListing, city: City): string | null {
  const timestamp = validPaidTimestampMs(listing);
  if (timestamp === undefined) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: city.timezone,
  }).format(new Date(timestamp));
}

function PaidAtFact({ listing }: { listing: BoardListing }) {
  const city = getCity(listing.city);
  const paidAt = city ? formatPaidTimestamp(listing, city) : null;
  if (!paidAt || !listing.firstPaidAt) return null;

  return (
    <time className="paid-at" data-paid-at-fact="" dateTime={listing.firstPaidAt}>
      Paid {paidAt}
    </time>
  );
}

function NumberOnePlace({ listing }: { listing: BoardListing }) {
  const kind = kindLabel(listing.kind);
  const paidAt = paidAtMs(listing);
  return (
    <li
      className="number-one"
      data-listing-card=""
      data-rank={listing.rank}
      data-listing-id={listing.id}
      data-book-one-first=""
      data-guest-first=""
      data-weekend-answer=""
      data-prize-before-price=""
      data-top-rank=""
      data-poster-answer=""
      {...(paidAt !== undefined
        ? { "data-paid-at": listing.firstPaidAt ?? "paid" }
        : {})}
      data-slot="paid-card"
    >
      <h2 className="weekend-answer" data-venue="" data-prize="">
        {listing.venueName}
      </h2>
      <span className="rank">#{listing.rank}</span>
      <div className="card-summary" data-card-summary="">
        {kind ? (
          <p className="kind" data-kind="">
            {kind}
          </p>
        ) : null}
        {listing.pitch ? <p className="pitch">{listing.pitch}</p> : null}
      </div>
      <BookingHop
        listing={listing}
        className="book-one"
        primary
        guestFirst
      />
      <footer className="later-facts" data-later-fact="">
        <span className="bid" data-bid="">
          {formatUsd(listing.bidUsd)}
        </span>
        <PaidAtFact listing={listing} />
        <span className="clicks" data-clicks="">
          {formatClicks(listing.clicks)}
        </span>
      </footer>
    </li>
  );
}

export function ListingCard({ listing }: { listing: BoardListing }) {
  if (listing.rank === 1) {
    return <NumberOnePlace listing={listing} />;
  }

  const kind = kindLabel(listing.kind);
  return (
    <li
      className="place"
      data-listing-card=""
      data-rank={listing.rank}
      data-listing-id={listing.id}
      data-later-book=""
      data-later-rank=""
      data-poster-entry=""
      data-slot="paid-card"
      {...(listing.rank <= 3 ? { "data-top-rank": "" } : {})}
    >
      <span className="rank">#{listing.rank}</span>
      <p className="rest-name" data-venue="">
        {listing.venueName}
      </p>
      <div className="card-summary" data-card-summary="">
        {kind ? (
          <p className="kind" data-kind="">
            {kind}
          </p>
        ) : null}
        {listing.pitch ? <p className="pitch">{listing.pitch}</p> : null}
      </div>
      <p className="bid" data-bid="">
        {formatUsd(listing.bidUsd)}
      </p>
      <footer className="place-foot" data-later-book-foot="">
        <LaterBookFoot listing={listing} />
        <PaidAtFact listing={listing} />
        <span className="clicks" data-clicks="">
          {formatClicks(listing.clicks)}
        </span>
      </footer>
    </li>
  );
}

function LaterBookFoot({ listing }: { listing: BoardListing }) {
  return (
    <a
      className="book-later"
      href={listingClickPath(listing.id)}
      rel="noreferrer"
      data-booking-url={listing.bookingUrl}
      data-book-later=""
      data-later-book-foot=""
      aria-label={`Book ${listing.venueName}`}
    >
      Book
    </a>
  );
}

function UnpublishedWeekend({
  city,
}: {
  city: City;
}) {
  return (
    <section
      className="unpublished-weekend"
      aria-label={`${city.name} weekend listings`}
      data-empty-board="true"
      data-empty-unpublished=""
      data-poster-empty=""
    >
      <p className="empty-answer">No #1</p>
      <p className="empty-note">
        This weekend is still open for claims. No venue has purchased the #1
        position on the {city.name} poster yet.
      </p>
      <p className="empty-window">
        Paid placements remain eligible for seven days.
      </p>
      <p className="empty-bid-open">
        Claim rank is available any time. The board stays empty until a
        completed Waffo payment is confirmed.
      </p>
    </section>
  );
}

export function Leaderboard({
  city,
  listings,
}: {
  city: City;
  listings: readonly BoardListing[];
}) {
  const paid = listings.filter((listing) => paidAtMs(listing) !== undefined);
  if (paid.length === 0) {
    return null;
  }

  const numberOne = paid.find((listing) => listing.rank === 1);
  const later = paid.filter((listing) => listing.rank > 1);
  const topThreeLater = later.filter((listing) => listing.rank <= 3);
  const remainingLater = later.filter((listing) => listing.rank > 3);
  const topThree = [
    ...(numberOne ? [numberOne] : []),
    ...topThreeLater,
  ].sort((a, b) => a.rank - b.rank);

  return (
    <section
      className="fold"
      aria-label={`${city.name} weekend listings`}
      data-slot="paid-board"
      data-poster-list=""
    >
      <p className="fold-rule" aria-hidden="true">
        this friday / saturday
      </p>
      <ol
        className="leaderboard top-three-list"
        data-leaderboard=""
        data-slot="top-three"
        aria-label="Top three paid venues"
      >
        {topThree.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </ol>
      {later.length > 0 ? (
        <section
          className={`later-stack${remainingLater.length > 0 ? " has-later-rows" : ""}`}
          data-later-stack=""
          data-poster-later-list=""
          aria-label={`Later venues in ${city.name}`}
        >
          <p className="later-stack-kicker later-stack-also">
            Also this weekend
          </p>
          <p className="later-stack-dek">
            <span className="later-stack-lists">
              Paying less than #1 still lists.{" "}
            </span>
            These venues are not this weekend&apos;s #1.
          </p>
          {remainingLater.length > 0 ? (
            <ol
              className="later-board"
              data-slot="later-rows"
            >
              {remainingLater.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

const CHECKOUT_ERROR_COPY: Record<string, string> = {
  bid_below_min: "First bid must be at least $5. No charge and no rank claimed.",
  bid_not_whole: "Bids are whole US dollars only. No charge and no rank claimed.",
  bid_not_higher: "A raise must beat the current bid. No charge and no rank claimed.",
  listing_invalid: "Need a venue name and a booking URL. No rank claimed.",
  url_insecure: "Booking URL must be https. No charge and no rank claimed.",
  url_forbidden: "That booking URL is not allowed. No charge and no rank claimed.",
  reviews_forbidden: "No star scores or review-speak. No charge and no rank claimed.",
  window_closed: "Claims are available any time. No charge and no rank claimed.",
  payment_incomplete: "Checkout was not paid. The poster is unchanged.",
  waffo_unavailable: "Checkout is unavailable or still awaiting confirmation. No rank is claimed until payment is confirmed.",
  polar_unavailable: "Checkout is unavailable. No charge and no rank claimed.",
};

const RECOVERABLE_CHECKOUT_ERROR_PREFIX = "waffo_unavailable:";
const LOCAL_INTENT_ID = /^int_[A-Za-z0-9_-]{1,128}$/;
const RECOVERABLE_INTENT_STATUSES = new Set(["creating", "open", "unknown"]);
const WAFFO_RECOVERY_COPY =
  CHECKOUT_ERROR_COPY.waffo_unavailable;

function checkoutErrorCode(code: string | undefined): string | undefined {
  if (!code?.startsWith(RECOVERABLE_CHECKOUT_ERROR_PREFIX)) return code;
  return "waffo_unavailable";
}

/** Only a durable, still-recoverable local intent may become a completion link. */
function checkoutRecoveryIntentId(code: string | undefined): string | undefined {
  if (!code?.startsWith(RECOVERABLE_CHECKOUT_ERROR_PREFIX)) return undefined;
  const candidate = code.slice(RECOVERABLE_CHECKOUT_ERROR_PREFIX.length).trim();
  if (!LOCAL_INTENT_ID.test(candidate)) return undefined;
  try {
    const intent = getCheckoutIntent(getDb(), candidate);
    return intent && RECOVERABLE_INTENT_STATUSES.has(intent.status) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

export function checkoutErrorCopy(
  code: string | undefined,
  _state?: { occupied: boolean; [key: string]: unknown },
): string | null {
  const normalizedCode = checkoutErrorCode(code);
  if (!normalizedCode) return null;
  return CHECKOUT_ERROR_COPY[normalizedCode] ?? "Checkout did not start. No rank claimed.";
}

function checkoutErrorNotice(
  code: string | undefined,
  state: { occupied: boolean },
): React.ReactNode {
  const copy = checkoutErrorCopy(code, state);
  if (!copy) return null;
  const intentId = checkoutRecoveryIntentId(code);
  if (!intentId) return copy;
  return (
    <>
      {WAFFO_RECOVERY_COPY}{" "}
      <a
        href={`/checkout/complete?intent=${encodeURIComponent(intentId)}`}
        data-checkout-recovery=""
      >
        Check payment status
      </a>
      .
    </>
  );
}

export function CityBoard({
  city,
  listings,
  period = "weekend",
  weekendLabel = "This Friday / Saturday",
  checkoutError,
  now: nowProp,
}: CityBoardProps) {
  const paid = listings.filter(
    (listing) => paidAtMs(listing) !== undefined,
  );
  const topBid = paid[0]?.bidUsd ?? 0;
  const defaultAmount = topBid > 0 ? topBid + 1 : MIN_BID_USD;
  const occupied = paid.length > 0;
  const numberOne = paid.find((listing) => listing.rank === 1);
  // `now` remains an injectable prop for deterministic view tests and callers;
  // claims no longer depend on the historical Thursday–Sunday interval.
  void nowProp;
  const errorState = { occupied };
  const errorNotice = checkoutErrorNotice(checkoutError, errorState);

  return (
    <main
      className="poster"
      data-board=""
      data-city={city.slug}
      data-occupied={occupied ? "true" : "false"}
      data-period={period}
      data-slot="home-shell"
      data-identity="city-weekend-poster"
    >
      <section className="board-context" data-slot="context" data-poster-masthead="">
        <a
          className="context-pill"
          href="/rules"
          data-context-pill=""
          data-slot="stats-pill"
          data-poster-edition=""
          aria-label={`${city.name} weekly board rules`}
        >
          <span>{city.name} weekend board</span>
          <span className="context-detail">Paid spots only. See rules.</span>
        </a>
        <header className="masthead" data-slot="context-copy" data-poster-masthead-copy="">
          <p className="edition">One city · one weekend</p>
          <h1 className="city-name">{city.name}</h1>
          <p className="weekend-slot">{weekendLabel}</p>
          {occupied ? (
            <p className="period-meta week-window" data-rolling-week="">
              Rolling last 7 days. Not Monday 00:00 UTC.
            </p>
          ) : (
            <p className="period-meta">
              This weekend, #1 is whoever paid the most. Rank is money, not stars.
            </p>
          )}
        </header>
      </section>
      {occupied ? (
        <>
          <BidForm
            city={city}
            defaultAmount={defaultAmount}
            occupied={occupied}
            notice={errorNotice}
          />
          <Leaderboard
            city={city}
            listings={paid}
          />
          {occupied && numberOne ? (
            <details className="board-details" data-board-details="">
              <summary>Weekend details</summary>
              <p className="occupied-bid-close">
                Claims are available any time. Paid placements remain eligible
                for seven days after their first payment.
              </p>
              <p className="list-venue-line">
                <a
                  className="list-venue"
                  href="#claim"
                  data-list-venue=""
                  aria-label="List a venue"
                >
                  List a venue
                </a>
              </p>
            </details>
          ) : null}
        </>
      ) : (
        <>
          <UnpublishedWeekend city={city} />
          <BidForm
            city={city}
            defaultAmount={defaultAmount}
            occupied={occupied}
            notice={errorNotice}
          />
        </>
      )}
    </main>
  );
}
