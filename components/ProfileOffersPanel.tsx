"use client";

import { useEffect, useState } from "react";
import {
  EXTRA_HINT,
  EXTRA_LABEL,
  PACKAGE_PLATFORMS,
  USAGE_RIGHTS_LABEL,
  extraPriceSuffix,
  isUgcPackageType,
  packagePriceSuffix,
  packageTitle,
  type PackagePlatform,
  type PublicExtraView,
  type PublicPackageView,
  type UsageRights,
} from "@/lib/servicePackages";
import { formatListedPrice, formatPriceSpan } from "@/lib/parsePrice";
import { formatFromPriceLabel } from "@/lib/publicInfluencer";

const PLATFORM_TAB_LABEL: Record<PackagePlatform, { el: string; en: string }> = {
  instagram: { el: "Instagram", en: "Instagram" },
  tiktok: { el: "TikTok", en: "TikTok" },
  youtube: { el: "YouTube", en: "YouTube" },
  facebook: { el: "Facebook", en: "Facebook" },
  ugc: { el: "UGC", en: "UGC" },
};

const SECTION_COPY = {
  social: { el: "Αναρτήσεις σε social", en: "Social posts" },
  ugc: { el: "UGC", en: "UGC" },
  ugcBody: {
    el: "Το brand το χρησιμοποιεί όπου θέλει. Ο creator δεν το ποστάρει.",
    en: "The brand uses it wherever they want. The creator does not post it.",
  },
  extras: { el: "Extras", en: "Extras" },
  extrasBody: {
    el: "Προαιρετικά add-ons πάνω στην συνεργασία.",
    en: "Optional add-ons on top of a collaboration.",
  },
  quote: { el: "Ζήτα προσφορά", en: "Request quote" },
  days: { el: "ημέρες", en: "days" },
} as const;

function OfferPrice({
  revealPrices,
  price,
  fromPrice,
  priceMax,
  suffix,
  lang,
}: {
  revealPrices: boolean;
  price?: string;
  fromPrice?: number | null;
  priceMax?: number | null;
  suffix: string | null;
  lang: "el" | "en";
}) {
  const range =
    fromPrice != null && priceMax != null && priceMax > fromPrice
      ? formatPriceSpan(fromPrice, priceMax, lang)
      : "";
  const exact = revealPrices && price ? formatListedPrice(price, lang) : "";
  const label = exact || range || formatFromPriceLabel(fromPrice, lang);
  if (!label) return null;
  const prominent = Boolean(exact || range);
  return (
    <p
      className={
        prominent
          ? "text-2xl font-extrabold tabular-nums text-blue-700"
          : "text-xl font-bold tabular-nums text-slate-800"
      }
    >
      {suffix ? `${label} ${suffix}` : label}
    </p>
  );
}

function PackageCard({
  pkg,
  lang,
  revealPrices,
  onRequestQuote,
}: {
  pkg: PublicPackageView;
  lang: "el" | "en";
  revealPrices: boolean;
  onRequestQuote: (label: string) => void;
}) {
  const title =
    pkg.platform && pkg.type
      ? packageTitle(pkg.platform, pkg.type, pkg.quantity || 1, lang)
      : pkg.title;
  const rights =
    pkg.usage_rights && USAGE_RIGHTS_LABEL[pkg.usage_rights as UsageRights]
      ? USAGE_RIGHTS_LABEL[pkg.usage_rights as UsageRights][lang]
      : null;
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      <h4 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h4>
      {pkg.description ? <p className="mt-1 text-sm text-slate-600">{pkg.description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        {pkg.delivery_days != null ? (
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
            {pkg.delivery_days} {SECTION_COPY.days[lang]}
          </span>
        ) : null}
        {rights ? (
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">{rights}</span>
        ) : null}
      </div>
      <div className="mt-4 flex-1">
        <OfferPrice
          revealPrices={revealPrices}
          price={pkg.price}
          fromPrice={pkg.from_price}
          priceMax={pkg.price_max}
          suffix={pkg.type ? packagePriceSuffix(pkg.type, lang) : null}
          lang={lang}
        />
      </div>
      <button
        type="button"
        onClick={() => onRequestQuote(title)}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white transition-colors hover:bg-blue-700"
      >
        {SECTION_COPY.quote[lang]}
      </button>
    </div>
  );
}

export default function ProfileOffersPanel({
  packages,
  extras,
  lang,
  revealPrices,
  onRequestQuote,
}: {
  packages: PublicPackageView[];
  extras: PublicExtraView[];
  lang: "el" | "en";
  revealPrices: boolean;
  onRequestQuote: (label: string) => void;
}) {
  const social = packages.filter((pkg) => pkg.type && !isUgcPackageType(pkg.type) && pkg.platform !== "ugc");
  const ugc = packages.filter((pkg) => (pkg.type && isUgcPackageType(pkg.type)) || pkg.platform === "ugc");
  const platforms = PACKAGE_PLATFORMS.filter(
    (platform) => platform !== "ugc" && social.some((pkg) => pkg.platform === platform)
  );
  const platformKey = platforms.join("|");
  const [tab, setTab] = useState<PackagePlatform>(platforms[0] || "instagram");

  useEffect(() => {
    const list = platformKey ? (platformKey.split("|") as PackagePlatform[]) : [];
    if (list.length && !list.includes(tab)) setTab(list[0]!);
  }, [platformKey, tab]);

  const visibleSocial = platforms.length ? social.filter((pkg) => pkg.platform === tab) : social;
  const pricedExtras = extras.filter((extra) => extra.has_price);

  if (!social.length && !ugc.length && !pricedExtras.length) {
    return (
      <p className="mb-6 text-sm text-slate-500">
        {lang === "el" ? "Δεν υπάρχουν δημοσιευμένα πακέτα ακόμα." : "No published packages yet."}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {social.length ? (
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">
            {SECTION_COPY.social[lang]}
          </h3>
          {platforms.length > 1 ? (
            <div className="relative mb-4 min-w-0">
              <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:snap-none sm:pb-0 [&::-webkit-scrollbar]:hidden">
                {platforms.map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => setTab(platform)}
                    className={`inline-flex min-h-11 shrink-0 snap-start items-center rounded-full px-3 text-xs font-semibold transition-colors sm:min-h-0 sm:py-1.5 ${
                      tab === platform
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {PLATFORM_TAB_LABEL[platform][lang]}
                  </button>
                ))}
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent sm:hidden"
                aria-hidden
              />
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visibleSocial.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                lang={lang}
                revealPrices={revealPrices}
                onRequestQuote={onRequestQuote}
              />
            ))}
          </div>
        </section>
      ) : null}

      {ugc.length ? (
        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">{SECTION_COPY.ugc[lang]}</h3>
          <p className="mb-3 mt-1 text-xs leading-relaxed text-slate-500">{SECTION_COPY.ugcBody[lang]}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ugc.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                lang={lang}
                revealPrices={revealPrices}
                onRequestQuote={onRequestQuote}
              />
            ))}
          </div>
        </section>
      ) : null}

      {pricedExtras.length ? (
        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            {SECTION_COPY.extras[lang]}
          </h3>
          <p className="mb-3 mt-1 text-xs leading-relaxed text-slate-500">{SECTION_COPY.extrasBody[lang]}</p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {pricedExtras.map((extra) => (
              <div key={extra.key} className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-bold text-slate-900">{EXTRA_LABEL[extra.key][lang]}</h4>
                <p className="mt-1 text-xs leading-snug text-slate-500">{EXTRA_HINT[extra.key][lang]}</p>
                <div className="mt-3">
                  <OfferPrice
                    revealPrices={revealPrices}
                    price={extra.price}
                    fromPrice={extra.from_price}
                    priceMax={extra.price_max}
                    suffix={extraPriceSuffix(extra.key, lang)}
                    lang={lang}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onRequestQuote(EXTRA_LABEL[extra.key][lang])}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-900 hover:bg-slate-50"
                >
                  {SECTION_COPY.quote[lang]}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
