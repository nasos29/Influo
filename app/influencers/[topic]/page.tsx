import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DirectoryPageView from "@/components/DirectoryPageView";
import DirectoryTopicLinks from "@/components/DirectoryTopicLinks";
import JsonLdScript from "@/components/JsonLdScript";
import { breadcrumbJsonLd } from "@/lib/breadcrumbJsonLd";
import { loadFilteredDirectoryCards } from "@/lib/directoryCards";
import { DIRECTORY_LANDINGS, landingBySlug } from "@/lib/directoryLandings";
import { pageMetadata } from "@/lib/pageMetadata";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

type Params = Promise<{ topic: string }>;

export function generateStaticParams(): { topic: string }[] {
  return DIRECTORY_LANDINGS.map((landing) => ({ topic: landing.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { topic } = await params;
  const landing = landingBySlug(topic);
  if (!landing) return { robots: { index: false, follow: false } };
  return pageMetadata({
    title: landing.title,
    description: landing.description,
    path: `/influencers/${landing.slug}`,
  });
}

export default async function InfluencerLandingPage({ params }: { params: Params }) {
  const { topic } = await params;
  const landing = landingBySlug(topic);
  if (!landing) notFound();

  const cachedLandingCards = unstable_cache(
    () => loadFilteredDirectoryCards(landing.filters, 40),
    [`influencers-landing-cards-${landing.slug}`],
    { revalidate: 3600, tags: ["directory"] }
  );
  const { influencers, total } = await cachedLandingCards();

  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Αρχική", path: "/" },
    { name: "Κατάλογος Δημιουργών", path: "/directory" },
    { name: landing.h1, path: `/influencers/${landing.slug}` },
  ]);

  return (
    <>
      <JsonLdScript data={breadcrumbLd} />
      <DirectoryPageView
        initialInfluencers={influencers}
        initialTotal={total}
        heading={{ h1: landing.h1, subtitle: landing.subtitle }}
        preset={{
          skills: landing.filters.skills,
          location: landing.filters.location,
          platform: landing.filters.platform,
          category: landing.filters.category,
        }}
      />
      <DirectoryTopicLinks lang="el" />
    </>
  );
}
