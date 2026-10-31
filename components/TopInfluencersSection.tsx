"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import InfluencerCard from "@/components/InfluencerCard";
import InfluencerCardCarousel, {
  INFLUENCER_CAROUSEL_CARD_CLASS,
} from "@/components/InfluencerCardCarousel";
import { SECTION_TITLE_CLASS } from "@/lib/sectionTitle";
import { parseStoredCategories } from "@/lib/categories";
import { displayNameForLang } from "@/lib/greeklish";
import { getVisitorId } from "@/lib/visitorId";
import { publicProfilePath } from "@/lib/profileSlug";
import { parseFollowerString } from "@/lib/parseFollowers";
import { trustChipsFromAccounts } from "@/lib/trustSignals";

type Lang = "el" | "en";

export type TopInfluencer = {
  id: string;
  display_name: string;
  display_name_en?: string | null;
  avatar_url: string | null;
  accounts?: Array<{ platform?: string; username?: string; followers?: string }> | null;
  category?: string | null;
  profile_slug?: string | null;
  location?: string | null;
  price_tier?: string | null;
  verified?: boolean;
  analytics_verified?: boolean;
  availability_status?: string | null;
  clicks: number;
  views: number;
};

function buildSocials(accounts: TopInfluencer["accounts"]): {
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

function buildFollowers(accounts: TopInfluencer["accounts"]): {
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
    title: "Top 10 Influencers",
    subtitle: "Οι πιο δημοφιλείς creators βάσει αλληλεπίδρασης στο Influo",
  },
  en: {
    title: "Top 10 Influencers",
    subtitle: "Most popular creators based on engagement on Influo",
  },
};

export default function TopInfluencersSection({ lang }: { lang: Lang }) {
  const [influencers, setInfluencers] = useState<TopInfluencer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/top-influencers")
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

  const topTen = influencers.slice(0, 10);
  if (!loading && topTen.length === 0) return null;

  const txt = t[lang];

  return (
    <section className="relative py-16 md:py-24 px-6 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto">
        <InfluencerCardCarousel
          lang={lang}
          loading={loading}
          eyebrow={
            <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 rounded-full">
              Trending
            </span>
          }
          title={txt.title}
          subtitle={txt.subtitle}
          titleClassName={SECTION_TITLE_CLASS}
          className=""
        >
          {topTen.map((inf, idx) => {
            if (!inf?.id) return null;
            const name = displayNameForLang(
              (lang === "en" && inf.display_name_en ? inf.display_name_en : inf.display_name) ?? "",
              lang
            );
            const accounts = Array.isArray(inf.accounts) ? inf.accounts : [];
            return (
              <div
                key={String(inf.id)}
                data-carousel-card
                className={`relative ${INFLUENCER_CAROUSEL_CARD_CLASS}`}
              >
                <span
                  className="pointer-events-none absolute top-2 left-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-xs font-bold text-white backdrop-blur-sm"
                  aria-hidden
                >
                  #{idx + 1}
                </span>
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
                        metadata: { source: "top10" },
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
                    trustChips={trustChipsFromAccounts(accounts)}
                    availabilityStatus={inf.availability_status}
                    location={inf.location}
                    price_tier={inf.price_tier || "0"}
                  />
                </Link>
              </div>
            );
          })}
        </InfluencerCardCarousel>
      </div>
    </section>
  );
}
