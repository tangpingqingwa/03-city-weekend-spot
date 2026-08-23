import React from "react";
import {
  MIN_BID_USD,
  type BoardListing,
  type City,
} from "../../core/cities";
import { listingClickPath } from "../api/click/[id]/route";
import { BidForm } from "./bid-form";

type CityBoardProps = {
  city: City;
  listings: readonly BoardListing[];
  weekendLabel?: string;
  checkoutError?: string;
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
}: {
  listing: BoardListing;
  className: string;
  primary?: boolean;
}) {
  return (
    <a
      className={className}
      href={listingClickPath(listing.id)}
      rel="noreferrer"
      data-booking-url={listing.bookingUrl}
      {...(primary ? { "data-book-number-one": "" } : {})}
      aria-label={`Book ${listing.venueName}`}
    >
      Book
    </a>
  );
}

function NumberOnePlace({ listing }: { listing: BoardListing }) {
  const kind = kindLabel(listing.kind);
  return (
    <article
      className="number-one"
      data-listing-card=""
      data-rank={listing.rank}
      data-listing-id={listing.id}
      data-weekend-answer=""
    >
      <span className="rank">#{listing.rank}</span>
      <h2 className="weekend-answer" data-venue="">
        {listing.venueName}
      </h2>
      {kind ? (
        <p className="kind" data-kind="">
          {kind}
        </p>
      ) : null}
      {listing.pitch ? <p className="pitch">{listing.pitch}</p> : null}
      <p className="bid" data-bid="">
        {formatUsd(listing.bidUsd)}
      </p>
      <BookingHop listing={listing} className="book-one" primary />
      <p className="clicks" data-clicks="">
        {formatClicks(listing.clicks)}
      </p>
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
    >
      <span className="rank">#{listing.rank}</span>
      <h3 className="title" data-venue="">
        {listing.venueName}
      </h3>
      {kind ? (
        <p className="kind" data-kind="">
          {kind}
        </p>
      ) : null}
      {listing.pitch ? <p className="pitch">{listing.pitch}</p> : null}
      <p className="bid" data-bid="">
        {formatUsd(listing.bidUsd)}
      </p>
      <footer className="place-foot">
        <span className="clicks" data-clicks="">
          {formatClicks(listing.clicks)}
        </span>
        <BookingHop listing={listing} className="booking" />
      </footer>
    </article>
  );
}

export function Leaderboard({
  city,
  listings,
}: {
  city: City;
  listings: readonly BoardListing[];
}) {
  if (listings.length === 0) {
    return (
      <section className="fold" aria-label={`${city.name} weekend listings`}>
        <p className="fold-rule" aria-hidden="true">
          unpublished
        </p>
        <div className="empty-board" data-empty-board="true">
          <p className="empty-answer">No #1</p>
          <p className="empty-note">
            This weekend is unpublished. No venue has paid to print on the{" "}
            {city.name} poster. Nothing is invented here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="fold" aria-label={`${city.name} weekend listings`}>
      <p className="fold-rule" aria-hidden="true">
        this friday / saturday
      </p>
      <ol className="leaderboard" data-leaderboard="">
        {listings.map((listing) => (
          <li
            key={listing.id}
            className={listing.rank === 1 ? "is-number-one" : "is-rest"}
          >
            <ListingCard listing={listing} />
          </li>
        ))}
      </ol>
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

export function checkoutErrorCopy(code: string | undefined): string | null {
  if (!code) return null;
  return CHECKOUT_ERROR_COPY[code] ?? "Checkout did not start. No rank claimed.";
}

export function CityBoard({
  city,
  listings,
  weekendLabel = "This Friday / Saturday",
  checkoutError,
}: CityBoardProps) {
  const topBid = listings[0]?.bidUsd ?? 0;
  const defaultAmount = topBid > 0 ? topBid + 1 : MIN_BID_USD;
  const errorCopy = checkoutErrorCopy(checkoutError);
  const occupied = listings.length > 0;

  return (
    <main className="poster" data-board="" data-city={city.slug}>
      <header className="masthead">
        <p className="edition">One city · one weekend</p>
        <h1 className="city-name">{city.name}</h1>
        <p className="weekend-slot">{weekendLabel}</p>
        <p className="period-meta">
          This weekend, #1 is whoever paid the most. Rank is money, not stars.
        </p>
        {occupied ? (
          <p className="list-venue-line">
            <a className="list-venue" href="#claim" data-list-venue="">
              List a venue
            </a>
          </p>
        ) : null}
      </header>
      <Leaderboard city={city} listings={listings} />
      <BidForm
        city={city}
        defaultAmount={defaultAmount}
        occupied={occupied}
        notice={errorCopy}
      />
    </main>
  );
}
