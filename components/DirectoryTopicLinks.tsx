"use client";

import { DIRECTORY_LANDINGS } from "@/lib/directoryLandings";
import { usePathname } from "next/navigation";

const chipClass =
  "inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50";

const labels: Record<string, string> = Object.fromEntries(
  DIRECTORY_LANDINGS.map((landing) => [landing.slug, landing.h1])
);

export default function DirectoryTopicLinks({ lang = "el" }: { lang?: "el" | "en" }) {
  const pathname = usePathname();
  const heading = lang === "en" ? "Browse creators by topic" : "Αναζήτηση ανά θέμα";
  const directoryLabel = lang === "en" ? "Full directory" : "Όλος ο κατάλογος";
  const directoryHref = lang === "en" ? "/en/directory" : "/directory";

  const onDirectoryPage = pathname === "/directory" || pathname === "/en/directory";
  const landingMatch = pathname?.match(/^\/influencers\/([^/]+)\/?$/);
  const currentTopicSlug = landingMatch?.[1];

  const topicLandings = currentTopicSlug
    ? DIRECTORY_LANDINGS.filter((landing) => landing.slug !== currentTopicSlug)
    : DIRECTORY_LANDINGS;

  return (
    <section className="border-t border-slate-200/80 bg-white/60">
      <div className="max-w-page mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <nav aria-label={heading}>
          <h2 className="text-base font-semibold text-slate-800 mb-4 text-center sm:text-left">{heading}</h2>
          <ul className="flex flex-wrap justify-center gap-2 list-none p-0 m-0 sm:justify-start">
            {topicLandings.map((landing) => (
              <li key={landing.slug}>
                <a href={`/influencers/${landing.slug}`} className={chipClass}>
                  {labels[landing.slug] || landing.h1}
                </a>
              </li>
            ))}
            {!onDirectoryPage && (
              <li>
                <a href={directoryHref} className={chipClass}>
                  {directoryLabel}
                </a>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </section>
  );
}