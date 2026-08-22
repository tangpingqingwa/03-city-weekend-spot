import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "About · City Weekend Spot",
  description:
    "This weekend in this city, #1 is whoever paid the most. Rank is money, not stars. NYC v1.",
};

export default function AboutPage() {
  return (
    <main className="doc-page" data-page="about">
      <h1>About</h1>
      <p>
        City Weekend Spot is a weekly weekend window auction for the first
        place a local looks when deciding where to eat, drink, or see a show
        this Friday or Saturday. One public board per city. Venues bid whole
        USD for the #1 slot.
      </p>
      <p>
        <strong>Rank is money, not stars.</strong> Rank is the bid. Nothing
        else. Paying less than #1 still lists at the rank that bid can take.
        Equal bids: the older listing keeps the higher rank.
      </p>
      <p>
        A listing is <strong>venue + city + booking URL</strong>. Optional
        one-line pitch. Optional kind (restaurant, bar, or show). Kind and
        pitch never sort the board.
      </p>
      <p>
        There are <strong>no fake reviews</strong>. We do not scrape or display
        stars, review scores, invented quotes, or “people say…” blurbs. Public{" "}
        <strong>clicks</strong> on the booking URL are the only counter. Clicks
        are not a rating.
      </p>
      <p>
        No ads, no API keys, no revenue share with booking platforms. Copy is{" "}
        <strong>English</strong>. Currency is <strong>USD</strong>. The market
        is <strong>global English</strong> — there is no China-city default.
        v1 ships the <strong>NYC</strong> lane (
        <code>nyc</code>, <code>America/New_York</code>). Adding another city
        is a catalog row, not a rewrite of ranking. This is the{" "}
        <strong>city-weekend-spot</strong> vertical, a clone of{" "}
        <a href="https://outbid.lol">outbid.lol</a> pay-to-rank mechanics.
      </p>
      <p>
        Anyone can read the board without an account. Payment is the only write
        path. Live money is Polar Checkout. Tests use a fixture so they never
        call live Polar. Abandoned checkout does not invent a #1 venue.
      </p>
      <p>
        <a href="/rules">Read the rules</a> for the $5 minimum, older-wins
        ties, raise-pays-difference, no fake reviews, and banned chat / NSFW
        URLs.
      </p>
    </main>
  );
}
