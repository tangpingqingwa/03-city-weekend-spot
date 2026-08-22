import { notFound } from "next/navigation";
import { resolveCity } from "../../core/cities";
import { getBoardListings } from "../../core/rank";
import { CityBoard } from "./board";

export const dynamic = "force-dynamic";

type CityPageProps = {
  params: Promise<{
    city: string;
  }>;
};

export default async function CityPage({ params }: CityPageProps) {
  const { city: slug } = await params;
  const resolved = resolveCity(slug);
  if (!resolved.ok) {
    notFound();
  }

  const listings = getBoardListings(resolved.city.slug);
  return <CityBoard city={resolved.city} listings={listings} />;
}
