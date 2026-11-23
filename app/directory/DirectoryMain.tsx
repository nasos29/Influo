import DirectoryPageView from "@/components/DirectoryPageView";
import JsonLdScript from "@/components/JsonLdScript";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";
import { directoryItemListJsonLd } from "@/lib/directoryItemListJsonLd";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

const cachedDirectory = unstable_cache(
  () => loadPublicDirectoryCards(40),
  ["directory-cards-page"],
  { revalidate: 3600, tags: ["directory"] }
);

export default async function DirectoryMain({ lang = "el" }: { lang?: "el" | "en" }) {
  const { influencers, total } = await cachedDirectory();
  const listPath = lang === "en" ? "/en/directory" : "/directory";
  const listName = lang === "en" ? "Influencer Directory" : "Κατάλογος Δημιουργών";
  const itemListLd = directoryItemListJsonLd(influencers, listPath, listName);

  return (
    <>
      <JsonLdScript data={itemListLd} />
      <DirectoryPageView initialInfluencers={influencers} initialTotal={total} />
    </>
  );
}