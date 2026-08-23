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

export function ListingCard({ listing }: { listing: BoardListing }) {
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
        <a
          className="booking"
          href={listingClickPath(listing.id)}
          rel="noreferrer"
          data-booking-url={listing.bookingUrl}
        >
          Book
        </a>
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
          <p className="empty-kicker">This weekend is unpublished.</p>
          <p>
            No venue has paid to print on the {city.name} poster. Rank is the
            bid — nothing is invented here. Rank is money, not stars.
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
          <li key={listing.id}>
            <ListingCard listing={listing} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function CityBoard({
  city,
  listings,
  weekendLabel = "This Friday / Saturday",
}: CityBoardProps) {
  const topBid = listings[0]?.bidUsd ?? 0;
  const defaultAmount = topBid > 0 ? topBid + 1 : MIN_BID_USD;

  return (
    <main className="poster" data-board="" data-city={city.slug}>
      <header className="masthead">
        <p className="edition">One city · one weekend</p>
        <h1 className="city-name">{city.name}</h1>
        <p className="weekend-slot">{weekendLabel}</p>
        <p className="period-meta">
          This weekend, #1 is whoever paid the most. Rank is money, not stars.
        </p>
      </header>
      <BidForm city={city} defaultAmount={defaultAmount} />
      <Leaderboard city={city} listings={listings} />
    </main>
  );
}
