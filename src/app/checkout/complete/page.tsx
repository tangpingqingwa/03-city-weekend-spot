import React from "react";
import { getCheckoutIntent, getDb, type CheckoutIntentRow } from "../../../db";
import { resolveCity } from "../../../core/cities";

export const dynamic = "force-dynamic";

type CompletePageProps = {
  searchParams?: Promise<{
    intent?: string | string[];
  }>;
};

type CompleteState = "paid" | "pending" | "failed" | "unknown";

function firstQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function stateForIntent(intent: CheckoutIntentRow | undefined): CompleteState {
  if (!intent) return "unknown";
  if (intent.status === "paid") return "paid";
  if (intent.status === "rejected" || intent.status === "abandoned") return "failed";
  if (intent.status === "unknown" || intent.status === "reconciliation_required" || intent.status === "needs_reconciliation") return "unknown";
  return "pending";
}

export default async function CheckoutCompletePage({ searchParams }: CompletePageProps) {
  const query = (await searchParams) ?? {};
  const intentId = firstQuery(query.intent)?.trim() || undefined;
  const intent = intentId ? getCheckoutIntent(getDb(), intentId) : undefined;
  const state = stateForIntent(intent);
  const city = intent ? resolveCity(intent.city) : undefined;
  const boardHref = city?.ok ? `/${city.city.slug}` : "/";

  if (state === "paid") {
    return (
      <main className="doc-page" data-checkout-complete="true" data-checkout-state="paid">
        <h1>Payment complete</h1>
        <p>
          Your payment is recorded. The board uses the verified payment event
          and the immutable bid, not this URL, to update rank.
        </p>
        <p><a href={boardHref}>Back to the board</a></p>
      </main>
    );
  }

  if (state === "failed") {
    return (
      <main className="doc-page" data-checkout-complete="true" data-checkout-state="failed">
        <h1>Payment not completed</h1>
        <p>This checkout did not produce a paid event, so it did not change the board.</p>
        <p><a href={boardHref}>Back to the board</a></p>
      </main>
    );
  }

  if (state === "unknown") {
    return (
      <main className="doc-page" data-checkout-complete="true" data-checkout-state="unknown">
        <h1>Payment status unknown</h1>
        <p>
          We have not confirmed this payment yet. No rank is claimed from the
          return URL; a verified provider event can still reconcile it.
        </p>
        <p><a href={boardHref}>Back to the board</a></p>
      </main>
    );
  }

  return (
    <main className="doc-page" data-checkout-complete="true" data-checkout-state="pending">
      <h1>Payment pending</h1>
      <p>
        Checkout is still waiting for a verified payment event. No rank is
        claimed until the provider confirms payment.
      </p>
      <p><a href={boardHref}>Back to the board</a></p>
    </main>
  );
}
