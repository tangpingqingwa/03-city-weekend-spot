import React from "react";
import { notFound } from "next/navigation";
import {
  getPaymentPort,
  listingForSession,
  applyPaidEvent,
} from "../../../billing/port";
import { resolveCity } from "../../../core/cities";
import { getBoardListings } from "../../../core/rank";

export const dynamic = "force-dynamic";

type ReturnPageProps = {
  params: Promise<{
    city: string;
  }>;
  searchParams?: Promise<{
    sessionId?: string | string[];
    checkoutId?: string | string[];
    status?: string | string[];
  }>;
};

function firstQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function resolveReturn(params: {
  sessionId?: string | string[];
  checkoutId?: string | string[];
  status?: string | string[];
}): Promise<{ status: "paid" | "pending"; listingId?: string }> {
  const sessionId = firstQuery(params.sessionId) ?? firstQuery(params.checkoutId);
  const rawStatus = firstQuery(params.status);
  const canceled =
    rawStatus === "cancel" ||
    rawStatus === "canceled" ||
    rawStatus === "abandoned";
  const port = getPaymentPort();

  if (!sessionId) {
    return { status: "pending" };
  }

  if (canceled) {
    await port.abandonCheckout(sessionId);
    return { status: "pending" };
  }

  const already = listingForSession(sessionId);
  if (already) {
    return { status: "paid", listingId: already.id };
  }

  try {
    const paid = await port.completeCheckout(sessionId);
    const listing = applyPaidEvent(paid);
    return { status: "paid", listingId: listing.id };
  } catch {
    return { status: "pending" };
  }
}

export default async function ReturnPage({
  params,
  searchParams,
}: ReturnPageProps) {
  const { city: slug } = await params;
  const resolved = resolveCity(slug);
  if (!resolved.ok) {
    notFound();
  }

  const query = (await searchParams) ?? {};
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
