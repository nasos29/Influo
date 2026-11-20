import { DIRECTORY_LANDINGS } from "@/lib/directoryLandings";

const labels: Record<string, string> = Object.fromEntries(
  DIRECTORY_LANDINGS.map((landing) => [landing.slug, landing.h1])
);

export default function DirectoryTopicLinks({ lang = "el" }: { lang?: "el" | "en" }) {
  const heading = lang === "en" ? "Browse creators by topic" : "Αναζήτηση ανά θέμα";
  const directoryLabel = lang === "en" ? "Full directory" : "Όλος ο κατάλογος";

  return (
    <nav aria-label={heading} className="max-w-page mx-auto px-4 sm:px-6 pb-6 -mt-2">
      <h2 className="text-base font-semibold text-slate-800 mb-2">{heading}</h2>
      <ul className="flex flex-wrap gap-x-3 gap-y-2 text-sm text-slate-700">
        {DIRECTORY_LANDINGS.map((landing) => (
          <li key={landing.slug}>
            <a
              href={`/influencers/${landing.slug}`}
              className="text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
            >
              {labels[landing.slug] || landing.h1}
            </a>
          </li>
        ))}
        <li>
          <a href={lang === "en" ? "/en/directory" : "/directory"} className="text-slate-600 hover:text-slate-900">
            {directoryLabel}
          </a>
        </li>
      </ul>
    </nav>
  );
}