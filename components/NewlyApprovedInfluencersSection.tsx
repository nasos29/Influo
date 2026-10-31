"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import InfluencerCard from "@/components/InfluencerCard";
import InfluencerCardCarousel, {
  INFLUENCER_CAROUSEL_CARD_CLASS,
} from "@/components/InfluencerCardCarousel";
import { parseStoredCategories } from "@/lib/categories";
import { displayNameForLang } from "@/lib/greeklish";
import { getVisitorId } from "@/lib/visitorId";
import { publicProfilePath } from "@/lib/profileSlug";
import { parseFollowerString } from "@/lib/parseFollowers";

type Lang = "el" | "en";

/** Public newly-approved card fields (never min_rate). */
export type NewlyApprovedInfluencer = {
  id: string;
  display_name: string;
  display_name_en?: string | null;
  avatar_url: string | null;
  accounts?: Array<{
    platform?: string;
    username?: string;
    followers?: string | number;
  }> | null;
  category?: string | null;
  verified?: boolean;
  analytics_verified?: boolean;
  location?: string | null;
  price_tier?: string | null;
  profile_slug?: string | null;
};

/** Show 8 after excluding home directory preview ids. */
const DISPLAY_LIMIT = 8;

function buildSocials(accounts: NewlyApprovedInfluencer["accounts"]): {
  [key: string]: string | undefined;
} {
  const out: { [key: string]: string | undefined } = {};
  if (!Array.isArray(accounts)) return out;
  for (const acc of accounts) {
    const platform = String(acc.platform || "")
      .trim()
      .toLowerCase();
    const username = typeof acc.username === "string" ? acc.username.trim() : "";
    if (platform && username) out[platform] = username;
  }
  return out;
}

function buildFollowers(accounts: NewlyApprovedInfluencer["accounts"]): {
  [key: string]: number | undefined;
} {
  const out: { [key: string]: number | undefined } = {};
  if (!Array.isArray(accounts)) return out;
  for (const acc of accounts) {
    const platform = String(acc.platform || "")
      .trim()
      .toLowerCase();
    if (platform) out[platform] = parseFollowerString(acc.followers);
  }
  return out;
}

const t = {
  el: {
    badge: "Νέοι στο δίκτυο",
    title: "Νεοί Εγκεκριμένοι Creators",
    subtitle:
      "Επαληθευμένοι creators που μόλις εντάχθηκαν στην πλατφόρμα. Όλοι έχουν λάβει έγκριση και είναι έτοιμοι για συνεργασίες.",
    viewAll: "Δείτε όλο τον κατάλογο",
    empty:
      "Οι νεοί εγκεκριμένοι creators θα εμφανίζονται εδώ μετά την έγκρισή τους από την πλατφόρμα.",
  },
  en: {
    badge: "New to the network",
    title: "Newly Approved Creators",
    subtitle:
      "Verified creators who just joined the platform. All have been approved and are ready for collaborations.",
    viewAll: "View full directory",
    empty: "Newly approved creators will appear here once they are approved by the platform.",
  },
};

export default function NewlyApprovedInfluencersSection({
  lang,
  excludeIds = [],
}: {
  lang: Lang;
  /** Featured / other home cards — skip these so sections do not overlap. */
  excludeIds?: Array<string | number>;
}) {
  const [influencers, setInfluencers] = useState<NewlyApprovedInfluencer[]>([]);
  const [loading, setLoading] = useState(true);
  const excludeSet = useMemo(
    () => new Set(excludeIds.map((id) => String(id))),
    [excludeIds]
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/influencers/newly-approved")
      .then((r) => {
        if (!r.ok) return { influencers: [] };
        return r.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data?.influencers)) setInfluencers(data.influencers);
      })
      .catch(() => {
        if (!cancelled) setInfluencers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const out: NewlyApprovedInfluencer[] = [];
    const seen = new Set<string>();
    for (const inf of influencers) {
      const id = String(inf?.id || "");
      if (!id || excludeSet.has(id) || seen.has(id)) continue;
      seen.add(id);
      out.push(inf);
      if (out.length >= DISPLAY_LIMIT) break;
    }
    return out;
  }, [influencers, excludeSet]);

  const txt = t[lang];
  const directoryHref = lang === "en" ? "/en/directory" : "/directory";

  const viewAll = (
    <div className="flex justify-center">
      <a
        href={directoryHref}
        className="inline-flex items-center gap-2 rounded-full px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-all shadow-md hover:shadow-lg"
      >
        {txt.viewAll}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 8l4 4m0 0l-4 4m4-4H3"
          />
        </svg>
      </a>
    </div>
  );

  return (
    <section
      className="relative py-16 md:py-20 px-6 bg-gradient-to-br from-slate-50 via-white to-blue-50/20 border-t border-slate-100"
      id="newly-approved"
    >
      <div className="max-w-7xl mx-auto">
        {loading || visible.length > 0 ? (
          <InfluencerCardCarousel
            lang={lang}
            loading={loading}
            centerHeader
            eyebrow={
              <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 rounded-full">
                {txt.badge}
              </span>
            }
            title={txt.title}
            subtitle={txt.subtitle}
            titleClassName="text-3xl md:text-4xl font-bold text-slate-900"
            footer={!loading ? viewAll : null}
          >
            {visible.map((inf) => {
              const name = displayNameForLang(
                (lang === "en" && inf.display_name_en
                  ? inf.display_name_en
                  : inf.display_name) ?? "",
                lang
              );
              return (
                <div
                  key={String(inf.id)}
                  data-carousel-card
                  className={INFLUENCER_CAROUSEL_CARD_CLASS}
                >
                  <Link
                    href={publicProfilePath(inf.profile_slug, inf.id)}
                    className="block group"
                    onClick={() => {
                      fetch("/api/analytics/track", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          influencerId: inf.id,
                          eventType: "profile_click",
                          visitorId: getVisitorId(),
                          metadata: { source: "newly_approved" },
                        }),
                        keepalive: true,
                      }).catch(() => {});
                    }}
                  >
                    <InfluencerCard
                      name={name}
                      avatar={inf.avatar_url || ""}
                      verified={inf.analytics_verified === true || inf.verified === true}
                      socials={buildSocials(inf.accounts)}
                      followers={buildFollowers(inf.accounts)}
                      categories={parseStoredCategories(inf.category)}
                      lang={lang}
                      location={inf.location}
                      price_tier={inf.price_tier || "0"}
                    />
                  </Link>
                </div>
              );
            })}
          </InfluencerCardCarousel>
        ) : (
          <>
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 rounded-full mb-4">
                {txt.badge}
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">{txt.title}</h2>
              <p className="text-slate-600 max-w-2xl mx-auto mb-8">{txt.subtitle}</p>
            </div>
            <div className="text-center py-12 px-6 bg-white/60 rounded-2xl border border-slate-200/80">
              <p className="text-slate-600 max-w-xl mx-auto mb-8">{txt.empty}</p>
              {viewAll}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
