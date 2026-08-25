import React from "react";
import {
  MIN_BID_USD,
  type BoardListing,
  type City,
} from "../../core/cities";
import { isPaidListing } from "../../core/listing";
import { currentWindow, isWindowOpen } from "../../core/window";
import { listingClickPath } from "../api/click/[id]/route";
import { BidForm } from "./bid-form";

type CityBoardProps = {
  city: City;
  listings: readonly BoardListing[];
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
  afterList,
  afterListHop,
  afterListOne,
  afterListTwo,
  afterListThree,
  afterListFour,
  afterListFive,
  afterListSix,
  afterListSeven,
  guestFirst,
}: {
  listing: BoardListing;
  className: string;
  primary?: boolean;
  afterList?: boolean;
  afterListHop?: boolean;
  afterListOne?: boolean;
  afterListTwo?: boolean;
  afterListThree?: boolean;
  afterListFour?: boolean;
  afterListFive?: boolean;
  afterListSix?: boolean;
  afterListSeven?: boolean;
  guestFirst?: boolean;
}) {
  return (
    <a
      className={className}
      href={listingClickPath(listing.id)}
      rel="noreferrer"
      data-booking-url={listing.bookingUrl}
      {...(primary ? { "data-book-number-one": "" } : {})}
      {...(afterList ? { "data-book-after-list": "" } : {})}
      {...(afterListHop ? { "data-book-after-list-hop": "" } : {})}
      {...(afterListOne ? { "data-book-after-list-one": "" } : {})}
      {...(afterListTwo ? { "data-book-after-list-two": "" } : {})}
      {...(afterListThree ? { "data-book-after-list-three": "" } : {})}
      {...(afterListFour ? { "data-book-after-list-four": "" } : {})}
      {...(afterListFive ? { "data-book-after-list-five": "" } : {})}
      {...(afterListSix ? { "data-book-after-list-six": "" } : {})}
      {...(afterListSeven ? { "data-book-after-list-seven": "" } : {})}
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

function NumberOnePlace({ listing }: { listing: BoardListing }) {
  const kind = kindLabel(listing.kind);
  const paidAt = paidAtMs(listing);
  return (
    <article
      className="number-one"
      data-listing-card=""
      data-rank={listing.rank}
      data-listing-id={listing.id}
      data-book-one-first=""
      data-guest-first=""
      data-weekend-answer=""
      data-prize-before-price=""
      {...(paidAt !== undefined
        ? { "data-paid-at": listing.firstPaidAt ?? "paid" }
        : {})}
    >
      <h2 className="weekend-answer" data-venue="" data-prize="">
        {listing.venueName}
      </h2>
      <span className="rank">#{listing.rank}</span>
      {kind ? (
        <p className="kind" data-kind="">
          {kind}
        </p>
      ) : null}
      {listing.pitch ? <p className="pitch">{listing.pitch}</p> : null}
      <BookingHop
        listing={listing}
        className="book-one"
        primary
        guestFirst
        afterListOne
        afterListTwo
        afterListThree
        afterListFour
        afterListFive
        afterListSix
        afterListSeven
      />
      <footer className="later-facts" data-later-fact="">
        <span className="bid" data-bid="">
          {formatUsd(listing.bidUsd)}
        </span>
        <span aria-hidden="true"> · </span>
        <span className="clicks" data-clicks="">
          {formatClicks(listing.clicks)}
        </span>
      </footer>
    </article>
  );
}

export function ListingCard({ listing }: { listing: BoardListing }) {
  if (listing.rank === 1) {
    return <NumberOnePlace listing={listing} />;
  }

  const kind = kindLabel(listing.kind);
  return (
    <article
      className="place"
      data-listing-card=""
      data-rank={listing.rank}
      data-listing-id={listing.id}
      data-later-book=""
      data-later-rank=""
    >
      <span className="rank">#{listing.rank}</span>
      <p className="rest-name" data-venue="">
        {listing.venueName}
      </p>
      {kind ? (
        <p className="kind" data-kind="">
          {kind}
        </p>
      ) : null}
      {listing.pitch ? <p className="pitch">{listing.pitch}</p> : null}
      <p className="bid" data-bid="">
        {formatUsd(listing.bidUsd)}
      </p>
      <footer className="place-foot" data-later-book-foot="">
        <LaterBookFoot listing={listing} />
        <span className="clicks" data-clicks="">
          {formatClicks(listing.clicks)}
        </span>
      </footer>
    </article>
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
  bidsOpen,
}: {
  city: City;
  bidsOpen: boolean;
}) {
  return (
    <section
      className="unpublished-weekend"
      aria-label={`${city.name} weekend listings`}
      data-empty-board="true"
      data-empty-unpublished=""
      {...(!bidsOpen ? { "data-window-closed": "" } : {})}
    >
      <p className="empty-answer">No #1</p>
      <p className="empty-note">
        This weekend is unpublished. No venue has paid to print on the{" "}
        {city.name} poster. Nothing is invented here.
      </p>
      <p className="empty-window">
        Rolling last 7 days from paid createdAt. Not Monday 00:00 UTC.
      </p>
      <p className="empty-bid-open">
        New bids open Thursday noon through Sunday 23:59:59.999 local. Not anytime in the rolling week.
      </p>
      {!bidsOpen ? (
        <p className="empty-window-closed">
          New bids are closed. Not a live claim on Monday. New bids reopen Thursday noon through Sunday 23:59:59.999 local.
        </p>
      ) : null}
    </section>
  );
}

export function Leaderboard({
  city,
  listings,
  bidsOpen,
}: {
  city: City;
  listings: readonly BoardListing[];
  bidsOpen: boolean;
}) {
  const paid = listings.filter((listing) => paidAtMs(listing) !== undefined);
  if (paid.length === 0) {
    return null;
  }

  const numberOne = paid.find((listing) => listing.rank === 1);
  const later = paid.filter((listing) => listing.rank > 1);

  return (
    <section className="fold" aria-label={`${city.name} weekend listings`}>
      <p className="fold-rule" aria-hidden="true">
        this friday / saturday
      </p>
      <ol className="leaderboard" data-leaderboard="">
        {numberOne ? (
          <li className="is-number-one">
            <ListingCard listing={numberOne} />
          </li>
        ) : null}
      </ol>
      {later.length > 0 ? (
        <>
          <section
            className="later-stack"
            data-later-stack=""
            aria-label={`Later venues in ${city.name}`}
          >
            {bidsOpen ? (
              <p className="later-stack-kicker later-stack-also">
                Also this weekend
              </p>
            ) : null}
            {!bidsOpen ? (
              <p className="later-stack-kicker later-stack-closed-kicker">
                Already ranked
              </p>
            ) : null}
            <p className="later-stack-dek">
              {bidsOpen ? (
                <span className="later-stack-lists">
                  Paying less than #1 still lists.{" "}
                </span>
              ) : null}
              These venues are not this weekend&apos;s #1.
            </p>
            <ol className="later-board">
              {later.map((listing) => (
                <li key={listing.id} className="is-rest">
                  <ListingCard listing={listing} />
                </li>
              ))}
            </ol>
          </section>
          {bidsOpen ? (
            <p className="list-after-book-line">
              <a className="list-after-book" href="#claim" data-list-after-book="">
                List a venue
              </a>{" "}
              after later Books. Paying less than #1 still lists.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

const CHECKOUT_ERROR_COPY: Record<string, string> = {
  bid_below_min: "First bid must be at least $5. No charge and no rank claimed.",
  bid_not_whole: "Bids are whole US dollars only. No charge and no rank claimed.",
  bid_not_higher: "A raise must beat the current bid. No charge and no rank claimed.",
  listing_invalid: "Need a venue name and a https booking URL. No rank claimed.",
  url_insecure: "Booking URL must be https. No charge and no rank claimed.",
  url_forbidden: "That booking URL is not allowed. No charge and no rank claimed.",
  reviews_forbidden: "No star scores or review-speak. No charge and no rank claimed.",
  window_closed: "This weekend window is closed. No charge and no rank claimed.",
  payment_incomplete: "Checkout was not paid. The poster is unchanged.",
  polar_unavailable: "Checkout is unavailable. No charge and no rank claimed.",
};

/** Occupied closed leftover `?error=window_closed`. BidForm is hidden, so this path must name reopen. */
const OCCUPIED_CLOSED_WINDOW_CLOSED_COPY =
  "This weekend window is closed. New bids reopen Thursday noon through Sunday 23:59:59.999 local. No charge and no rank claimed.";

/** Empty unpublished leftover `?error=window_closed`. BidForm is hidden, so this path must name reopen. */
const EMPTY_UNPUBLISHED_CLOSED_WINDOW_CLOSED_COPY =
  "This weekend window is closed. New bids reopen Thursday noon through Sunday 23:59:59.999 local. No charge and no rank claimed.";

export function checkoutErrorCopy(
  code: string | undefined,
  state?: { occupied: boolean; bidsOpen: boolean },
): string | null {
  if (!code) return null;
  if (
    code === "window_closed" &&
    state?.occupied === true &&
    state.bidsOpen === false
  ) {
    return OCCUPIED_CLOSED_WINDOW_CLOSED_COPY;
  }
  if (
    code === "window_closed" &&
    state?.occupied === false &&
    state.bidsOpen === false
  ) {
    return EMPTY_UNPUBLISHED_CLOSED_WINDOW_CLOSED_COPY;
  }
  return CHECKOUT_ERROR_COPY[code] ?? "Checkout did not start. No rank claimed.";
}

export function CityBoard({
  city,
  listings,
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
  const now = nowProp ?? new Date();
  const bidsOpen = isWindowOpen(currentWindow(city, now), now);
  const errorCopy = checkoutErrorCopy(checkoutError, { occupied, bidsOpen });
  const occupiedClosedCheckoutError =
    occupied && !bidsOpen && checkoutError === "window_closed"
      ? errorCopy
      : null;
  const emptyUnpublishedClosedCheckoutError =
    !occupied && checkoutError === "window_closed" && !bidsOpen
      ? errorCopy
      : null;

  return (
    <main
      className="poster"
      data-board=""
      data-city={city.slug}
      data-occupied={occupied ? "true" : "false"}
      {...(!bidsOpen ? { "data-window-closed": "" } : {})}
    >
      <header className="masthead">
        <p className="edition">One city · one weekend</p>
        <h1 className="city-name">{city.name}</h1>
        <p className="weekend-slot">{weekendLabel}</p>
        {occupied ? (
          <>
            <p className="period-meta week-window" data-rolling-week="">
              Rolling last 7 days. Not Monday 00:00 UTC.
            </p>
            {!bidsOpen ? (
              <p className="occupied-window-closed">
                New bids are closed. Not a live claim on Monday. New bids reopen Thursday noon through Sunday 23:59:59.999 local.
              </p>
            ) : null}
          </>
        ) : (
          <p className="period-meta">
            This weekend, #1 is whoever paid the most. Rank is money, not stars.
          </p>
        )}
        {occupied && numberOne ? (
          <>
            {bidsOpen ? (
              <p className="list-venue-line">
                <a
                  className="list-venue"
                  href="#claim"
                  data-list-venue=""
                  data-list-after-book-one=""
                  data-list-after-book-two=""
                  data-list-after-book-three=""
                  data-list-after-book-four=""
                  data-list-after-book-five=""
                  data-list-after-book-six=""
                  data-list-after-book-seven=""
                  data-list-after-book-eight=""
                >
                  List a venue
                </a>
              </p>
            ) : null}
            {bidsOpen ? (
              <p className="book-after-list-line">
                <BookingHop
                  listing={numberOne}
                  className="book-after-list"
                  afterList
                />{" "}
                after the list hop.
              </p>
            ) : null}
            {bidsOpen ? (
              <p className="list-after-book-hop-line">
                <a
                  className="list-after-book-hop"
                  href="#claim"
                  data-list-after-book-hop=""
                >
                  List a venue
                </a>{" "}
                after Book follows List.
              </p>
            ) : null}
            {bidsOpen ? (
              <p className="book-after-list-hop-line">
                <BookingHop
                  listing={numberOne}
                  className="book-after-list-hop"
                  afterListHop
                />{" "}
                after List follows Book.
              </p>
            ) : null}
          </>
        ) : null}
      </header>
      {occupied ? (
        <Leaderboard city={city} listings={paid} bidsOpen={bidsOpen} />
      ) : (
        <UnpublishedWeekend city={city} bidsOpen={bidsOpen} />
      )}
      {occupiedClosedCheckoutError ? (
        <p
          className="stub-note occupied-closed-checkout-error"
          data-checkout-error="true"
          data-occupied-closed-checkout-error=""
        >
          {occupiedClosedCheckoutError}
        </p>
      ) : null}
      {emptyUnpublishedClosedCheckoutError ? (
        <p
          className="stub-note empty-unpublished-checkout-error"
          data-checkout-error="true"
          data-empty-unpublished-checkout-error=""
        >
          {emptyUnpublishedClosedCheckoutError}
        </p>
      ) : null}
      {bidsOpen ? (
        <BidForm
          city={city}
          defaultAmount={defaultAmount}
          occupied={occupied}
          notice={errorCopy}
        />
      ) : null}
    </main>
  );
}
