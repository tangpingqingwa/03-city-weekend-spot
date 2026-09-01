import type { Metadata } from "next";
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

export async function generateMetadata({ params }: Pick<CityPageProps, "params">): Promise<Metadata> {
  const { city: slug } = await params;
  const resolved = resolveCity(slug);
  if (!resolved.ok) return { robots: { index: false, follow: false } };
  const title = `${resolved.city.name} Weekend Board`;
  const description = `Find where to eat, drink and go in ${resolved.city.name} this weekend. Paid placements are transparent and rank is the bid.`;
  return {
    title,
    description,
    alternates: { canonical: `/${resolved.city.slug}` },
    openGraph: {
      title,
      description,
      url: `/${resolved.city.slug}`,
      images: [{ url: "/brand-mark.png", width: 512, height: 512, alt: `${resolved.city.name} weekend poster` }],
    },
    twitter: { card: "summary", title, description, images: ["/brand-mark.png"] },
  };
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
