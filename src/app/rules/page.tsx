import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Rules · City Weekend Spot",
  description:
    "min $5, older wins ties, raise pays difference, no fake reviews, no NSFW.",
};

export default function RulesPage() {
  return (
    <main className="doc-page" data-page="rules">
      <h1>Rules</h1>
      <p>
        These rules are the product. A bidder can predict rank from this page
        alone. Rank is the bid. There are no fake reviews.
      </p>

      <h2>Ranking</h2>
      <table>
        <tbody>
          <tr>
            <th>Rank is the bid</th>
            <td>
              Sort by <code>bidUsd</code> descending. Nothing else — no recency
              boost, no editorial pick, no star average.
            </td>
          </tr>
          <tr>
            <th>Whole dollars</th>
            <td>USD only. Integers. No cents. Step is $1.</td>
          </tr>
          <tr>
            <th>Minimum</th>
            <td>
              First bid for a listing in this window must be{" "}
              <strong>min $5</strong>.
            </td>
          </tr>
          <tr>
            <th>Below #1 still lists</th>
            <td>
              Paying less than #1 still appears at the rank that bid can take.
              Those venues are not this weekend’s #1.
            </td>
          </tr>
          <tr>
            <th>Equal bids</th>
            <td>
              <strong>older wins ties</strong>. Compare{" "}
              <code>firstPaidAt</code> ascending, then listing id.
            </td>
          </tr>
          <tr>
            <th>Raise</th>
            <td>
              Same venue key in the same city + weekend window raises.{" "}
              <strong>raise pays difference</strong> only (
              <code>new − current</code>). New amount must be a whole dollar ≥
              current + $1 and ≥ $5.
            </td>
          </tr>
          <tr>
            <th>Cannot steal the difference</th>
            <td>
              A different listing that wants that rank must pay the{" "}
              <strong>full</strong> target amount, not the incumbent’s
              difference.
            </td>
          </tr>
          <tr>
            <th>Payment claims rank</th>
            <td>
              A completed payment claims the rank. Unpaid checkout does not. We
              do not invent a paid #1 venue.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Weekly weekend window</h2>
      <table>
        <tbody>
          <tr>
            <th>Timezone</th>
            <td>
              Each city’s IANA timezone. NYC is{" "}
              <code>America/New_York</code>.
            </td>
          </tr>
          <tr>
            <th>Opens</th>
            <td>
              Thursday 12:00 (noon) local.
            </td>
          </tr>
          <tr>
            <th>Closes</th>
            <td>Sunday 23:59:59.999 local.</td>
          </tr>
          <tr>
            <th>Slot</th>
            <td>This Friday / Saturday.</td>
          </tr>
          <tr>
            <th>
              <code>windowId</code>
            </th>
            <td>
              Deterministic <code>{"{city}:{iso_week}"}</code> in that city’s
              timezone (ISO week, Thursday-anchored).
            </td>
          </tr>
          <tr>
            <th>What does not carry</th>
            <td>
              Previous-week bids never reappear on the live board. Want next
              weekend’s #1? Pay again.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        An empty window is valid. There is no #1 venue until someone pays. Do
        not invent a listing.
      </p>

      <h2>No fake reviews</h2>
      <p>
        We never display stars, review scores, or invented quotes. Pitch or
        venue name with star/review claims is{" "}
        <code>reviews_forbidden</code>. There are <strong>no fake reviews</strong>
        . Public clicks on the booking URL are the only counter. Clicks are
        not a rating.
      </p>

      <h2>Booking URL hygiene</h2>
      <ol>
        <li>
          Require <code>https:</code>. <code>http:</code> is{" "}
          <code>url_insecure</code>.
        </li>
        <li>
          Strip tracking and affiliate query keys: <code>utm_*</code>,{" "}
          <code>fbclid</code>, <code>gclid</code>, <code>gbraid</code>,{" "}
          <code>wbraid</code>, <code>msclkid</code>, <code>ref</code>,{" "}
          <code>ref_</code>, <code>affiliate</code>, <code>aff</code>,{" "}
          <code>irclickid</code>, <code>mc_cid</code>, <code>mc_eid</code>,{" "}
          <code>icid</code>.
        </li>
        <li>Strip fragments. Store and display only the stripped URL.</li>
        <li>
          Reject chat / invite hosts: Telegram, <code>t.me</code>,{" "}
          <code>wa.me</code>, chat.whatsapp, <code>discord.gg</code>.
        </li>
        <li>
          Reject <strong>NSFW</strong> path tokens and adult hosts. Reject{" "}
          <code>javascript:</code>, <code>data:</code>, credentials-in-URL, and
          localhost / link-local hosts.
        </li>
      </ol>
      <p>
        Chat / invite and NSFW fail as <code>url_forbidden</code>. No listing.
        No charge.
      </p>
    </main>
  );
}
