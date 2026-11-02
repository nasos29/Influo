"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Influencer } from "@/components/Directory";
import { useDirectoryTypewriter } from "@/components/directoryTypewriter";
import { publicProfilePath } from "@/lib/profileSlug";
import { isProtectedTestAccount } from "@/lib/protectedAccount";

type Lang = "el" | "en";

const COPY = {
  el: {
    title: "Βρες τον κατάλληλο Έλληνα influencer για το brand σου",
    subtitle: "Αναζήτησε ανά κατηγορία, πλατφόρμα και τιμή. Δες πραγματικά στατιστικά και κλείσε συνεργασία απευθείας.",
    search: "Αναζήτηση",
    searchLabel: "Αναζήτηση creators",
    creators: "creators",
    trust: "στο Influo",
    creatorCta: "Είσαι creator;",
    creatorLink: "Γράψου δωρεάν",
  },
  en: {
    title: "Find the right Greek influencer for your brand",
    subtitle: "Search by category, platform and price. See real stats and book collaborations directly.",
    search: "Search",
    searchLabel: "Search creators",
    creators: "creators",
    trust: "on Influo",
    creatorCta: "Are you a creator?",
    creatorLink: "Join for free",
  },
} as const;

/** «358» → «350+». Small totals stay exact. */
export function roundedCreatorCount(total: number): string {
  if (total < 20) return String(total);
  return `${Math.floor(total / 10) * 10}+`;
}

export default function HomeHeroSearch({
  lang,
  influencers,
  total,
  onCreatorSignup,
}: {
  lang: Lang;
  influencers: Influencer[];
  total: number;
  onCreatorSignup: () => void;
}) {
  const t = COPY[lang];
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const placeholder = useDirectoryTypewriter(
    lang,
    !focused && !query.trim(),
    influencers.map((inf) => inf.name)
  );

  const faces = influencers
    .filter((inf) => inf.avatar && !isProtectedTestAccount({ display_name: inf.name }))
    .slice(0, 6);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/directory?q=${encodeURIComponent(q)}` : "/directory");
  };

  return (
    <div className="flex h-full min-w-0 flex-col justify-center text-center lg:text-left">
      <h1 className="!text-[34px] sm:!text-[44px] lg:!text-[52px] font-extrabold !leading-[1.08] tracking-tight text-slate-900">
        {t.title}
      </h1>
      <p className="mt-5 text-base md:text-lg text-slate-600 leading-relaxed max-w-xl mx-auto lg:mx-0">
        {t.subtitle}
      </p>

      <form
        onSubmit={submit}
        role="search"
        className="mt-8 flex w-full min-w-0 max-w-xl mx-auto lg:mx-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_8px_30px_rgba(15,23,42,0.08)] focus-within:border-slate-400"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="ml-2 h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          size={1}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label={t.searchLabel}
          className="min-w-0 flex-1 bg-transparent px-1 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {t.search}
        </button>
      </form>

      {faces.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3">
          <div className="flex -space-x-2.5">
            {faces.map((inf) => (
              <Link
                key={String(inf.id)}
                href={publicProfilePath(inf.profile_slug ?? null, String(inf.id))}
                title={inf.name}
                className="relative inline-block h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-sm transition hover:z-10 hover:scale-110"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={inf.avatar} alt={inf.name} className="h-full w-full object-cover" loading="lazy" />
              </Link>
            ))}
          </div>
          <p className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{roundedCreatorCount(total)} {t.creators}</span> {t.trust}
          </p>
        </div>
      ) : null}

      <p className="mt-6 text-sm text-slate-500">
        {t.creatorCta}{" "}
        <button type="button" onClick={onCreatorSignup} className="font-semibold text-slate-900 underline underline-offset-4 hover:text-blue-600">
          {t.creatorLink}
        </button>
      </p>
    </div>
  );
}
