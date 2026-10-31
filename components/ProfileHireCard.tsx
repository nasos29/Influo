"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { NegotiateDialog } from "@/components/ProfileOffersPanel";
import { formatEuroAmount } from "@/lib/formatEuro";
import { offerPriceLabel } from "@/lib/offerPriceLabel";
import { listedPriceMin } from "@/lib/parsePrice";
import {
  EXTRA_HINT,
  EXTRA_LABEL,
  extraPriceSuffix,
  packagePriceSuffix,
  packageRowTitle,
  type PackagePlatform,
  type PackageType,
  type PublicExtraView,
  type PublicPackageView,
  type RateCardExtraKey,
} from "@/lib/servicePackages";

const COPY = {
  el: {
    from: "Από",
    package: "Πακέτο",
    negotiate: "Διαπραγμάτευση πακέτου",
    fee: "Το Influo δεν παίρνει προμήθεια",
    custom: "Προσαρμοσμένο πακέτο",
  },
  en: {
    from: "From",
    package: "Package",
    negotiate: "Negotiate a package",
    fee: "Influo takes no commission",
    custom: "Custom package",
  },
} as const;

type HireChoice = {
  id: string;
  title: string;
  description: string;
  priceLabel: string | null;
  budget?: string;
  quantity?: number;
  platform?: PackagePlatform;
  type?: PackageType;
  extraKey?: RateCardExtraKey;
};

function choiceBudget(
  price: string | undefined,
  fromPrice: number | null | undefined,
  priceMax: number | null | undefined,
  suffix: string | null,
  lang: "el" | "en"
): { label: string | null; budget?: string } {
  const label = offerPriceLabel({ price, fromPrice, priceMax, suffix, lang });
  if (price && formatEuroAmount(price, lang)) return { label, budget: price };
  const floor = price ? listedPriceMin(price) : fromPrice != null && fromPrice > 0 ? fromPrice : null;
  if (floor != null && label) return { label, budget: String(floor) };
  return { label };
}

function hireChoices(
  packages: PublicPackageView[],
  extras: PublicExtraView[],
  lang: "el" | "en"
): HireChoice[] {
  const fromPackages = packages.map((pkg) => {
    const title =
      pkg.platform && pkg.type
        ? packageRowTitle(pkg.platform, pkg.type, pkg.quantity || 1, lang)
        : pkg.title;
    const priced = choiceBudget(
      pkg.price,
      pkg.from_price,
      pkg.price_max,
      pkg.type ? packagePriceSuffix(pkg.type, lang) : null,
      lang
    );
    return {
      id: pkg.id,
      title,
      description: pkg.description || "",
      priceLabel: priced.label,
      budget: priced.budget,
      quantity: pkg.quantity || 1,
      platform: pkg.platform,
      type: pkg.type,
    };
  });
  const fromExtras = extras
    .filter((extra) => extra.has_price)
    .map((extra) => {
      const priced = choiceBudget(
        extra.price,
        extra.from_price,
        extra.price_max,
        extraPriceSuffix(extra.key, lang),
        lang
      );
      return {
        id: `extra:${extra.key}`,
        title: EXTRA_LABEL[extra.key][lang],
        description: EXTRA_HINT[extra.key][lang],
        priceLabel: priced.label,
        budget: priced.budget,
        extraKey: extra.key,
      };
    });
  return [...fromPackages, ...fromExtras];
}

export default function ProfileHireCard({
  variant,
  lang,
  packages,
  extras,
  amountLabel,
  creatorName,
  gender,
  isBrand,
  influencerId,
  collaborateLabel,
  messageLabel,
  onCollaborate,
  onMessage,
  onNeedBrand,
}: {
  variant: "desktop" | "bar";
  lang: "el" | "en";
  packages: PublicPackageView[];
  extras: PublicExtraView[];
  /** Formatted amount only, e.g. "40 €". The «Από» word is separate. */
  amountLabel: string | null;
  creatorName: string;
  gender?: string | null;
  isBrand: boolean;
  influencerId: string;
  collaborateLabel: string;
  messageLabel: string;
  onCollaborate: (choice?: { label: string; budget?: string }) => void;
  onMessage: () => void;
  onNeedBrand: () => void;
}) {
  const copy = COPY[lang];
  const choices = useMemo(() => hireChoices(packages, extras, lang), [packages, extras, lang]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [negotiateOpen, setNegotiateOpen] = useState(false);
  const selected = choices.find((choice) => choice.id === selectedId) ?? choices[0] ?? null;

  const collaborate = () => {
    onCollaborate(selected ? { label: selected.title, budget: selected.budget } : undefined);
  };

  const openNegotiate = () => {
    if (!isBrand) {
      onNeedBrand();
      return;
    }
    setNegotiateOpen(true);
  };

  const negotiateOptions = choices.length
    ? choices
    : [{ id: "custom", title: copy.custom, description: "", priceLabel: null }];

  if (variant === "bar") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] lg:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          {amountLabel ? (
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{copy.from}</p>
              <p className="text-lg font-extrabold leading-none text-slate-900">{amountLabel}</p>
            </div>
          ) : (
            <div className="min-w-0" />
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onMessage}
              aria-label={messageLabel}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900"
            >
              <MessageCircle className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={collaborate}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 text-sm font-bold text-white"
            >
              {collaborateLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white px-[18px] pb-3.5 pt-[18px] shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        {amountLabel ? (
          <>
            <p className="text-[13px] text-slate-500">{copy.from}</p>
            <p className="mb-3.5 mt-0.5 text-3xl font-extrabold leading-none text-slate-900">{amountLabel}</p>
          </>
        ) : null}
        {choices.length > 0 ? (
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">{copy.package}</span>
            <select
              value={selected?.id || ""}
              onChange={(event) => setSelectedId(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
            >
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          onClick={collaborate}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-sm font-bold text-white hover:from-blue-700 hover:to-purple-700"
        >
          {collaborateLabel}
        </button>
        <button
          type="button"
          onClick={onMessage}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          {messageLabel}
        </button>
        <button
          type="button"
          onClick={openNegotiate}
          className="mt-2.5 block w-full text-center text-[13px] text-slate-500 underline underline-offset-[3px]"
        >
          {copy.negotiate}
        </button>
        <p className="mt-3 border-t border-slate-100 pt-3 text-center text-xs text-slate-500">{copy.fee}</p>
      </div>
      {negotiateOpen ? (
        <NegotiateDialog
          open
          onClose={() => setNegotiateOpen(false)}
          lang={lang}
          creatorName={creatorName}
          gender={gender}
          options={negotiateOptions}
          influencerId={influencerId}
        />
      ) : null}
    </>
  );
}
