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
  later,
  afterList,
  afterListHop,
  afterListOne,
  afterListTwo,
  afterListThree,
  afterListFour,
  afterListFive,
  afterListSix,
  afterListSeven,
}: {
  listing: BoardListing;
  className: string;
  primary?: boolean;
  later?: boolean;
  afterList?: boolean;
  afterListHop?: boolean;
  afterListOne?: boolean;
  afterListTwo?: boolean;
  afterListThree?: boolean;
  afterListFour?: boolean;
  afterListFive?: boolean;
  afterListSix?: boolean;
  afterListSeven?: boolean;
}) {
  return (
    <a
      className={className}
      href={listingClickPath(listing.id)}
      rel="noreferrer"
      data-booking-url={listing.bookingUrl}
      {...(primary ? { "data-book-number-one": "" } : {})}
      {...(later ? { "data-book-later": "" } : {})}
      {...(afterList ? { "data-book-after-list": "" } : {})}
      {...(afterListHop ? { "data-book-after-list-hop": "" } : {})}
      {...(afterListOne ? { "data-book-after-list-one": "" } : {})}
      {...(afterListTwo ? { "data-book-after-list-two": "" } : {})}
      {...(afterListThree ? { "data-book-after-list-three": "" } : {})}
      {...(afterListFour ? { "data-book-after-list-four": "" } : {})}
      {...(afterListFive ? { "data-book-after-list-five": "" } : {})}
      {...(afterListSix ? { "data-book-after-list-six": "" } : {})}
      {...(afterListSeven ? { "data-book-after-list-seven": "" } : {})}
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
      data-book-one-first=""
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
      <BookingHop
        listing={listing}
        className="book-one"
        primary
        afterListOne
        afterListTwo
        afterListThree
        afterListFour
        afterListFive
        afterListSix
        afterListSeven
      />
      <p className="bid" data-bid="">
        {formatUsd(listing.bidUsd)}
      </p>
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
      data-later-book=""
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
      <BookingHop listing={listing} className="book-later" later />
      <p className="bid" data-bid="">
        {formatUsd(listing.bidUsd)}
      </p>
      <footer className="place-foot">
        <span className="clicks" data-clicks="">
          {formatClicks(listing.clicks)}
        </span>
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

  const hasLater = listings.some((listing) => listing.rank > 1);

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
      {hasLater ? (
        <p className="list-after-book-line">
          <a className="list-after-book" href="#claim" data-list-after-book="">
            List a venue
          </a>{" "}
          after later Books. Paying less than #1 still lists.
        </p>
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
  const numberOne = listings.find((listing) => listing.rank === 1);

  return (
    <main className="poster" data-board="" data-city={city.slug}>
      <header className="masthead">
        <p className="edition">One city · one weekend</p>
        <h1 className="city-name">{city.name}</h1>
        <p className="weekend-slot">{weekendLabel}</p>
        <p className="period-meta">
          This weekend, #1 is whoever paid the most. Rank is money, not stars.
        </p>
        {occupied && numberOne ? (
          <>
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
              >
                List a venue
              </a>
            </p>
            <p className="book-after-list-line">
              <BookingHop
                listing={numberOne}
                className="book-after-list"
                afterList
              />{" "}
              after the list hop.
            </p>
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
            <p className="book-after-list-hop-line">
              <BookingHop
                listing={numberOne}
                className="book-after-list-hop"
                afterListHop
              />{" "}
              after List follows Book.
            </p>
          </>
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
