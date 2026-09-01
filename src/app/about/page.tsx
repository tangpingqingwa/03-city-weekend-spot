import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "About · City Weekend Spot",
  description:
    "A public New York weekend board where venues are ranked only by bid.",
};

export default function AboutPage() {
  return (
    <main className="doc-page" data-page="about">
      <h1>About</h1>
      <p>
        City Weekend Spot is a public board for the first place New Yorkers
        look when deciding where to eat, drink, or see a show this Friday or
        Saturday. Venues bid whole US dollars for the #1 position.
      </p>
      <p>
        <strong>Rank is money, not stars.</strong> Rank is the bid and nothing
        else. A bid below #1 still appears at the rank it can take. When bids
        are equal, the listing placed first stays higher.
      </p>
      <p>
        A listing includes the venue, city, booking link, and an optional
        one-line pitch and category. Those details help people choose where to
        go, but they never affect ranking.
      </p>
      <p>
        The board does not use star ratings, review scores, or invented quotes.
        Public clicks on the booking link are the only counter, and clicks are
        not a rating.
      </p>
      <p>
        New York listings follow <strong>America/New_York</strong> local time.
        The board is in <strong>English</strong> and bids use{" "}
        <strong>USD</strong>.
      </p>
      <p>
        Anyone can read the board without an account. A venue appears only
        after payment is confirmed. A canceled or abandoned checkout never
        creates a listing.
      </p>
      <p>
        <a href="/rules">Read the rules</a> for the $5 minimum, ties, raises,
        weekend timing, review policy, and booking-link standards.
      </p>
    </main>
  );
}
