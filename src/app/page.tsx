import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBoardListings } from "../core/rank";
import { resolveCity } from "../core/cities";
import { periodFromQuery } from "./period-tabs-state";
import { CityBoard } from "./[city]/board";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New York City Weekend Board",
  description:
    "Find where to eat, drink and go in New York City this weekend. Paid placements are transparent and rank is the bid.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "New York City Weekend Board",
    description:
      "Find where to eat, drink and go in New York City this weekend. Paid placements are transparent and rank is the bid.",
    url: "/",
    images: [{ url: "/brand-mark.png", width: 512, height: 512, alt: "City Weekend poster" }],
  },
  twitter: {
    card: "summary",
    title: "New York City Weekend Board",
    description:
      "Find where to eat, drink and go in New York City this weekend. Paid placements are transparent and rank is the bid.",
    images: ["/brand-mark.png"],
  },
};

type HomePageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    period?: string | string[];
  }>;
};

function firstQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomePageProps = {}) {
  const resolved = resolveCity("nyc");
  if (!resolved.ok) notFound();
  const query = (await searchParams) ?? {};
  return (
    <CityBoard
      city={resolved.city}
      listings={getBoardListings(resolved.city.slug)}
      period={periodFromQuery(query.period)}
      checkoutError={firstQuery(query.error)}
    />
  );
}
