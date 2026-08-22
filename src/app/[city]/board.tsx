import React from "react";
import {
  MIN_BID_USD,
  type BoardListing,
  type City,
} from "../../core/cities";
import { BidForm } from "./bid-form";

type CityBoardProps = {
  city: City;
  listings: readonly BoardListing[];
};

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export function formatClicks(clicks: number): string {
  return `${clicks} ${clicks === 1 ? "click" : "clicks"}`;
}

export function ListingCard({ listing }: { listing: BoardListing }) {
  return (
    <article
      className="card"
      data-listing-card=""
      data-rank={listing.rank}
      data-listing-id={listing.id}
    >
      <span className="rank">#{listing.rank}</span>
      <div className="card-body">
        <div className="card-top">
          <h3 className="title" data-venue="">
            {listing.venueName}
          </h3>
          <p className="bid" data-bid="">
            {formatUsd(listing.bidUsd)}
          </p>
        </div>
        {listing.kind ? (
          <p className="kind" data-kind="">
            {listing.kind}
          </p>
        ) : null}
        {listing.pitch ? <p className="pitch">{listing.pitch}</p> : null}
        <p className="meta">
          <span className="clicks" data-clicks="">
            {formatClicks(listing.clicks)}
          </span>
          <a
            className="booking"
            href={listing.bookingUrl}
            rel="noreferrer"
            data-booking-url={listing.bookingUrl}
          >
            Book
          </a>
        </p>
      </div>
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
      <p className="empty-board" data-empty-board="true">
        No venues on the {city.name} weekend board yet. Rank is the bid —
        nothing is invented here.
      </p>
    );
  }

  return (
    <ol className="leaderboard" data-leaderboard="">
      {listings.map((listing) => (
        <li key={listing.id}>
          <ListingCard listing={listing} />
        </li>
      ))}
    </ol>
  );
}

export function CityBoard({ city, listings }: CityBoardProps) {
  const topBid = listings[0]?.bidUsd ?? 0;
  const defaultAmount = topBid > 0 ? topBid + 1 : MIN_BID_USD;

  return (
    <main className="board" data-board="" data-city={city.slug}>
      <p className="city-kicker">{city.name}</p>
      <p className="period-meta">
        This weekend, #1 is whoever paid the most. Rank is money, not stars.
      </p>
      <BidForm city={city} defaultAmount={defaultAmount} />
      <Leaderboard city={city} listings={listings} />
    </main>
  );
}
