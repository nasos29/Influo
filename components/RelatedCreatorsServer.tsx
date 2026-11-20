import { loadSimilarInfluencersForProfile } from "@/lib/loadSimilarInfluencersForProfile";
import { publicProfilePath } from "@/lib/profileSlug";
import { platformsFromAccounts } from "@/lib/similarInfluencers";

export default async function RelatedCreatorsServer({
  influencerId,
  categories,
  accounts,
}: {
  influencerId: string;
  categories: string[];
  accounts?: unknown;
}) {
  const platforms = platformsFromAccounts(accounts);
  let similar;
  try {
    similar = await loadSimilarInfluencersForProfile({
      excludeId: influencerId,
      categories,
      platforms,
      limit: 6,
    });
  } catch {
    return null;
  }
  if (!similar.length) return null;

  return (
    <nav aria-label="Σχετικοί δημιουργοί" className="max-w-profile mx-auto px-4 sm:px-6 pb-10 pt-2">
      <h2 className="text-lg font-semibold text-slate-900 mb-3">Σχετικοί δημιουργοί</h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {similar.map((row) => {
          const name = row.display_name?.trim() || "Creator";
          const href = publicProfilePath(row.profile_slug, row.id);
          return (
            <li key={row.id}>
              <a href={href} className="text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline">
                {name}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}