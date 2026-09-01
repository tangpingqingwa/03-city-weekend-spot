import { notFound } from "next/navigation";
import { resolveCity } from "../../core/cities";
import { getBoardListings } from "../../core/rank";
import { periodFromQuery } from "../period-tabs-state";
import { CityBoard } from "./board";

export const dynamic = "force-dynamic";

type CityPageProps = {
  params: Promise<{
    city: string;
  }>;
  searchParams?: Promise<{
    error?: string | string[];
    period?: string | string[];
  }>;
};

function firstQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CityPage({ params, searchParams }: CityPageProps) {
  const [{ city: slug }, query = {}] = await Promise.all([
    params,
    searchParams,
  ]);
  const resolved = resolveCity(slug);
  if (!resolved.ok) {
    notFound();
  }

  const listings = getBoardListings(resolved.city.slug);
  return (
    <CityBoard
      city={resolved.city}
      listings={listings}
      period={periodFromQuery(query.period)}
      checkoutError={firstQuery(query.error)}
    />
  );
}
