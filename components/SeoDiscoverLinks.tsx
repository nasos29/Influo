import { unstable_cache } from "next/cache";
import { DIRECTORY_LANDINGS } from "@/lib/directoryLandings";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";
import { publicProfilePath } from "@/lib/profileSlug";

const cachedFeatured = unstable_cache(
  () => loadPublicDirectoryCards(4),
  ["seo-discover-featured-profiles"],
  { revalidate: 3600, tags: ["directory"] }
);

const LANDING_PICKS = ["athina", "instagram", "ugc"] as const;

export default async function SeoDiscoverLinks({ lang = "el" }: { lang?: "el" | "en" }) {
  const { influencers } = await cachedFeatured();
  const directoryHref = lang === "en" ? "/en/directory" : "/directory";
  const heading = lang === "en" ? "Discover creators on Influo" : "Ανακάλυψε δημιουργούς στο Influo";
  const directoryLabel = lang === "en" ? "Influencer directory" : "Κατάλογος δημιουργών";

  return (
    <nav
      aria-label={heading}
      className="border-t border-slate-200/80 bg-slate-50/60 px-4 sm:px-6 py-8"
    >
      <div className="max-w-page mx-auto">
        <h2 className="text-base font-semibold text-slate-900 mb-3">{heading}</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm mb-4">
          <li>
            <a href={directoryHref} className="text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline">
              {directoryLabel}
            </a>
          </li>
          {LANDING_PICKS.map((slug) => {
            const landing = DIRECTORY_LANDINGS.find((l) => l.slug === slug);
            if (!landing) return null;
            return (
              <li key={slug}>
                <a
                  href={`/influencers/${slug}`}
                  className="text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
                >
                  {landing.h1}
                </a>
              </li>
            );
          })}
        </ul>
        {influencers.length > 0 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-700">
            {influencers.map((card) => (
              <li key={card.id}>
                <a
                  href={publicProfilePath(card.profile_slug, card.id)}
                  className="text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
                >
                  {card.name}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </nav>
  );
}