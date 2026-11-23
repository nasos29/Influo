import type { Influencer } from "@/components/Directory";
import { publicProfilePath } from "@/lib/profileSlug";
import { absoluteUrl } from "@/lib/site";

export function directoryItemListJsonLd(
  influencers: Influencer[],
  listPath: string,
  listName: string
): Record<string, unknown> {
  const items = influencers
    .map((inf, index) => {
      const path = publicProfilePath(inf.profile_slug, inf.id);
      if (!inf.name?.trim()) return null;
      return {
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(path),
        name: inf.name.trim(),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    url: absoluteUrl(listPath),
    numberOfItems: items.length,
    itemListElement: items,
  };
}