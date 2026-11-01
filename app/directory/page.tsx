import type { Metadata } from "next";
import DirectoryPageView from "@/components/DirectoryPageView";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

const cachedDirectory = unstable_cache(
  () => loadPublicDirectoryCards(40),
  ["directory-cards-page"],
  { revalidate: 3600, tags: ["directory"] }
);

type Search = Promise<{ q?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const params = await searchParams;
  if ((params.q || "").trim()) {
    return { robots: { index: false, follow: true } };
  }
  return {};
}

export default async function DirectoryPage() {
  const { influencers, total } = await cachedDirectory();
  return <DirectoryPageView initialInfluencers={influencers} initialTotal={total} />;
}
