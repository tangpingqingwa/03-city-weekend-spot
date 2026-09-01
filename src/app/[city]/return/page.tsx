import React from "react";
import { notFound } from "next/navigation";
import { resolveCity } from "../../../core/cities";
import { getBoardListings } from "../../../core/rank";
import { resolveReturn, type ReturnQuery } from "../../../core/return";

export const dynamic = "force-dynamic";

type ReturnPageProps = {
  params: Promise<{
    city: string;
  }>;
  searchParams?: Promise<{
    sessionId?: string | string[];
    checkoutId?: string | string[];
    intent?: string | string[];
    status?: string | string[];
  }>;
};

export default async function ReturnPage({
  params,
  searchParams,
}: ReturnPageProps) {
  const { city: slug } = await params;
  const resolved = resolveCity(slug);
  if (!resolved.ok) {
    notFound();
  }

  const query: ReturnQuery = (await searchParams) ?? {};
  const result = await resolveReturn(query);
  const listings = getBoardListings(resolved.city.slug);
  const listing = listings.find((row) => row.id === result.listingId);
  const boardHref = `/${resolved.city.slug}`;

  if (result.status === "pending") {
    return (
      <main className="doc-page" data-return="pending">
        <h1>Payment pending</h1>
        <p>
          Checkout abandoned or not yet paid. Rank updates only after a
          completed payment. We do not invent this weekend’s #1.
        </p>
        <p>
          <a href={boardHref}>Back to {resolved.city.name}</a>
        </p>
      </main>
    );
  }

  return (
    <main className="doc-page" data-return="paid">
      <h1>You&apos;re on the poster</h1>
      <p>
        {listing
          ? `${listing.venueName} is listed at $${listing.bidUsd}.`
          : "Payment completed. Rank updates only after paid."}
      </p>
      <p>
        <a href={boardHref}>Back to {resolved.city.name}</a>
      </p>
    </main>
  );
}
