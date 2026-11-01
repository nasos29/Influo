import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DirectoryPageView from "@/components/DirectoryPageView";
import { countDirectoryMatches } from "@/lib/directoryPage";
import { landingBySlug } from "@/lib/directoryLandings";
import { pageMetadata } from "@/lib/pageMetadata";

export const revalidate = 3600;

type Params = Promise<{ topic: string }>;

async function creatorCount(topic: string): Promise<number> {
  const landing = landingBySlug(topic);
  if (!landing) return 0;
  try {
    return await countDirectoryMatches(landing.filters);
  } catch {
    return 0;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { topic } = await params;
  const landing = landingBySlug(topic);
  if (!landing) return { robots: { index: false, follow: false } };
  const count = await creatorCount(topic);
  return pageMetadata({
    title: landing.title,
    description: landing.description,
    path: `/influencers/${landing.slug}`,
    index: count >= 3,
  });
}

export default async function InfluencerLandingPage({ params }: { params: Params }) {
  const { topic } = await params;
  const landing = landingBySlug(topic);
  if (!landing) notFound();
  return (
    <DirectoryPageView
      heading={{ h1: landing.h1, subtitle: landing.subtitle }}
      preset={{
        skills: landing.filters.skills,
        location: landing.filters.location,
        platform: landing.filters.platform,
        category: landing.filters.category,
      }}
    />
  );
}
