import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Rules · City Weekend Spot",
  description:
    "Minimum $5, older listings win ties, raises pay the difference, and reviews are never used for ranking.",
};

export default function RulesPage() {
  return (
    <main className="doc-page" data-page="rules">
      <h1>Rules</h1>
      <p>
        The board follows the published rules below.{" "}
        <strong>Rank is the bid</strong>, and reviews never influence position.
      </p>

      <h2>Ranking</h2>
      <table>
        <tbody>
          <tr>
            <th>Rank is the bid</th>
            <td>
              Venues are ordered by bid from highest to lowest. There is no
              recency boost, editorial pick, or star-rating factor.
            </td>
          </tr>
          <tr>
            <th>Whole dollars</th>
            <td>Bids use whole US dollars. The step is $1.</td>
          </tr>
          <tr>
            <th>Minimum</th>
            <td>
              A new venue starts at <strong>$5</strong> or more.
            </td>
          </tr>
          <tr>
            <th>Below #1 still lists</th>
            <td>
              A bid below the current leader still appears at the rank that
              amount can take.
            </td>
          </tr>
          <tr>
            <th>Equal bids</th>
            <td>The venue placed first keeps the higher rank.</td>
          </tr>
          <tr>
            <th>Raise</th>
            <td>
              The same venue may raise by at least $1 while its placement is
              active. The original payer is charged only the difference between
              the current and new bid.
            </td>
          </tr>
          <tr>
            <th>Listing ownership</th>
            <td>
              Another venue cannot take over an existing listing for the raise
              amount. It submits a new listing and pays the full bid.
            </td>
          </tr>
          <tr>
            <th>Payment claims rank</th>
            <td>
              Rank changes only after payment is confirmed. An incomplete or
              abandoned checkout never appears on the board.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Weekend timing</h2>
      <table>
        <tbody>
          <tr>
            <th>Local time</th>
            <td>New York listings follow America/New_York local time.</td>
          </tr>
          <tr>
            <th>Active placement</th>
            <td>
              Paid listings remain eligible for seven days from placement. The
              board does not reset for everyone at Monday midnight.
            </td>
          </tr>
          <tr>
            <th>New bids</th>
            <td>
              New claims open Thursday at noon and close Sunday at the end of
              the day, New York time.
            </td>
          </tr>
          <tr>
            <th>Weekend slot</th>
            <td>The board highlights places for this Friday and Saturday.</td>
          </tr>
          <tr>
            <th>Expiry</th>
            <td>
              A placement leaves the live ranking after seven days. To return,
              the venue places a new full bid.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        If nobody has paid for a placement, the board has no #1 venue.
      </p>

      <h2>Review policy</h2>
      <p>
        Listings cannot include star ratings, review scores, or unattributed
        review claims. Public clicks on the booking link are the only counter,
        and clicks are not a rating.
      </p>

      <h2>Booking links</h2>
      <ol>
        <li>Use a secure, public booking or venue link.</li>
        <li>Tracking, referral, and affiliate parameters are removed.</li>
        <li>Link shorteners, chat invitations, and adult content are rejected.</li>
        <li>
          Private, local-only, credentialed, or otherwise unsafe destinations
          are rejected before checkout.
        </li>
      </ol>
    </main>
  );
}
