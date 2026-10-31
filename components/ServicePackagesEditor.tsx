"use client";

import type { ReactNode } from "react";
import {
  EXTRA_HINT,
  EXTRA_LABEL,
  PACKAGE_PLATFORMS,
  PACKAGE_TYPE_HINT,
  RATE_CARD_EXTRA_KEYS,
  SOCIAL_PACKAGE_TYPES,
  UGC_PACKAGE_TYPES,
  USAGE_RIGHTS,
  USAGE_RIGHTS_LABEL,
  defaultPackages,
  emptyExtras,
  extraPriceSuffix,
  extrasFromRateCard,
  FIXED_PRICE_MESSAGE,
  isPositivePriceInput,
  isUgcPackageType,
  newPackageId,
  normalizeServicePackages,
  packagePriceSuffix,
  packageTitle,
  platformForPackageType,
  type PackagePlatform,
  type PackageType,
  type RateCardExtraKey,
  type ServiceExtras,
  type ServicePackage,
  type UsageRights,
} from "@/lib/servicePackages";
import { formatEuroAmount } from "@/lib/formatEuro";
import InfoTooltip from "@/components/InfoTooltip";

type Lang = "el" | "en";

const SOCIAL_PLATFORMS = PACKAGE_PLATFORMS.filter((p) => p !== "ugc");

const PLATFORM_CHIP: Record<PackagePlatform, { el: string; en: string }> = {
  instagram: { el: "Instagram", en: "Instagram" },
  tiktok: { el: "TikTok", en: "TikTok" },
  youtube: { el: "YouTube", en: "YouTube" },
  facebook: { el: "Facebook", en: "Facebook" },
  ugc: { el: "UGC", en: "UGC" },
};

const TYPE_CHIP: Record<PackageType, { el: string; en: string }> = {
  reel: { el: "Reel", en: "Reel" },
  story: { el: "Story", en: "Story" },
  post: { el: "Post", en: "Post" },
  video: { el: "Video", en: "Video" },
  short: { el: "Short", en: "Short" },
  carousel: { el: "Carousel", en: "Carousel" },
  ugc_video: { el: "UGC βίντεο", en: "UGC video" },
  ugc_photo: { el: "UGC φωτογραφίες", en: "UGC photos" },
};

const GROUP_COPY = {
  social: {
    title: { el: "Αναρτήσεις σε social", en: "Social posts" },
    body: {
      el: "Reel, story, post, carousel και video που ανεβαίνουν σε πλατφόρμα.",
      en: "Reels, stories, posts, carousels, and videos published on a platform.",
    },
  },
  ugc: {
    title: { el: "UGC", en: "UGC" },
    body: {
      el: "Περιεχόμενο που παραδίδεις στο brand. Δεν το ποστάρεις εσύ.",
      en: "Content you deliver to the brand. You do not post it.",
    },
  },
  extras: {
    title: { el: "Extras", en: "Extras" },
    body: {
      el: "Προαιρετικά add-ons. Δεν μπαίνουν στην ελάχιστη χρέωση.",
      en: "Optional add-ons. They are not part of the minimum rate.",
    },
  },
} as const;

function emptySocialPackage(): ServicePackage {
  return {
    id: newPackageId(),
    platform: "instagram",
    type: "reel",
    quantity: 1,
    price: "",
    delivery_days: 7,
    usage_rights: "none",
    description: "",
  };
}

function emptyUgcPackage(): ServicePackage {
  return {
    id: newPackageId(),
    platform: "ugc",
    type: "ugc_video",
    quantity: 1,
    price: "",
    delivery_days: 7,
    usage_rights: "none",
    description: "",
  };
}

export function initialPackagesFromUser(
  servicePackages: unknown,
  rateCard?: Record<string, string | null | undefined> | null
): ServicePackage[] {
  const fromDb = normalizeServicePackages(servicePackages);
  if (fromDb.length) return fromDb;
  if (rateCard) {
    const seeded: ServicePackage[] = [];
    const push = (
      price: string | null | undefined,
      platform: PackagePlatform,
      type: PackageType,
      days: number
    ) => {
      if (!price) return;
      seeded.push({
        id: newPackageId(),
        platform,
        type,
        quantity: 1,
        price: String(price),
        delivery_days: days,
        usage_rights: "none",
        description: "",
      });
    };
    push(rateCard.reel, "instagram", "reel", 7);
    push(rateCard.story, "instagram", "story", 3);
    push(rateCard.post, "instagram", "post", 5);
    push(rateCard.carousel, "instagram", "carousel", 5);
    push(rateCard.youtube, "youtube", "video", 14);
    push(rateCard.ugc_video, "ugc", "ugc_video", 7);
    push(rateCard.ugc_photo, "ugc", "ugc_photo", 7);
    if (seeded.length) return seeded.slice(0, 6);
  }
  return defaultPackages();
}

export function initialExtrasFromUser(rateCard: unknown): ServiceExtras {
  return extrasFromRateCard(rateCard);
}

type Props = {
  lang: Lang;
  packages: ServicePackage[];
  extras?: ServiceExtras;
  onChange: (next: ServicePackage[]) => void;
  onExtrasChange?: (next: ServiceExtras) => void;
  className?: string;
};

export default function ServicePackagesEditor({
  lang,
  packages,
  extras,
  onChange,
  onExtrasChange,
  className,
}: Props) {
  const L = (el: string, en: string) => (lang === "en" ? en : el);
  const list = packages.length ? packages : defaultPackages();
  const extraValues = extras ?? emptyExtras();
  const social = list.filter((p) => !isUgcPackageType(p.type));
  const ugc = list.filter((p) => isUgcPackageType(p.type));

  const update = (id: string, patch: Partial<ServicePackage>) => {
    onChange(
      list.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };
        const platform = platformForPackageType(next.type, next.platform);
        return platform ? { ...next, platform } : next;
      })
    );
  };

  const remove = (id: string) => {
    if (list.length <= 1) return;
    onChange(list.filter((p) => p.id !== id));
  };

  const add = (kind: "social" | "ugc") => {
    if (list.length >= 6) return;
    onChange([...list, kind === "ugc" ? emptyUgcPackage() : emptySocialPackage()]);
  };

  const setExtra = (key: RateCardExtraKey, value: string) => {
    onExtrasChange?.({ ...extraValues, [key]: value });
  };

  const chipBtn = (active: boolean) =>
    `min-h-9 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:min-h-0 sm:py-1 ${
      active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div className={className}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          {L("Πακέτα", "Packages")}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {L(
            "Έως 6 πακέτα. Ο τίτλος φτιάχνεται μόνος του. Τα extras είναι προαιρετικά και δεν μετράνε στο όριο.",
            "Up to 6 packages. Titles are generated. Extras are optional and do not count toward the limit."
          )}
        </p>
      </div>

      <div className="space-y-6">
        <PackageGroup
          title={GROUP_COPY.social.title[lang]}
          body={GROUP_COPY.social.body[lang]}
          canAdd={list.length < 6}
          addLabel={L("Προσθήκη ανάρτησης", "Add a post")}
          onAdd={() => add("social")}
          emptyLabel={
            social.length
              ? null
              : L("Δεν έχεις προσθέσει ανάρτηση ακόμα.", "No social post yet.")
          }
        >
          {social.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              lang={lang}
              types={[...SOCIAL_PACKAGE_TYPES]}
              showPlatform={pkg.type !== "carousel"}
              lockedPlatform={pkg.type === "carousel" ? L("Μόνο Instagram", "Instagram only") : null}
              canRemove={list.length > 1}
              onUpdate={update}
              onRemove={remove}
              chipBtn={chipBtn}
              L={L}
            />
          ))}
        </PackageGroup>

        <PackageGroup
          title={GROUP_COPY.ugc.title[lang]}
          body={GROUP_COPY.ugc.body[lang]}
          canAdd={list.length < 6}
          addLabel={L("Προσθήκη UGC", "Add UGC")}
          onAdd={() => add("ugc")}
          emptyLabel={ugc.length ? null : L("Δεν έχεις προσθέσει UGC ακόμα.", "No UGC yet.")}
        >
          {ugc.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              lang={lang}
              types={[...UGC_PACKAGE_TYPES]}
              showPlatform={false}
              lockedPlatform={null}
              canRemove={list.length > 1}
              onUpdate={update}
              onRemove={remove}
              chipBtn={chipBtn}
              L={L}
            />
          ))}
        </PackageGroup>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
          <h4 className="text-sm font-bold text-slate-900">{GROUP_COPY.extras.title[lang]}</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{GROUP_COPY.extras.body[lang]}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {RATE_CARD_EXTRA_KEYS.map((key) => {
              const value = String(extraValues[key] ?? "");
              const invalid = value.trim() !== "" && !isPositivePriceInput(value);
              const preview = value.trim() && !invalid ? formatEuroAmount(value, lang) : "";
              const suffix = extraPriceSuffix(key, lang);
              return (
                <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-1 flex items-start gap-1.5">
                    <label className="text-sm font-semibold leading-snug text-slate-900" htmlFor={`extra-${key}`}>
                      {EXTRA_LABEL[key][lang]}
                    </label>
                    <InfoTooltip text={EXTRA_HINT[key][lang]} ariaLabel={L("Τι είναι", "What this is")} />
                  </div>
                  <p className="mb-2 text-[11px] leading-snug text-slate-500">{EXTRA_HINT[key][lang]}</p>
                  <div className="relative">
                    <input
                      id={`extra-${key}`}
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={value}
                      onChange={(e) => setExtra(key, e.target.value)}
                      placeholder="50"
                      aria-invalid={invalid}
                      className={`w-full rounded-lg border bg-white px-3 py-2 pr-8 text-sm text-slate-900 ${
                        invalid ? "border-red-400" : "border-slate-300"
                      }`}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-slate-500">
                      €
                    </span>
                  </div>
                  {invalid ? (
                    <p className="mt-1 text-[11px] text-red-600">
                      {FIXED_PRICE_MESSAGE[lang]}
                    </p>
                  ) : preview ? (
                    <p className="mt-1 text-[11px] font-semibold tabular-nums text-slate-600">
                      {suffix ? `${preview} ${suffix}` : preview}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">{L("Προαιρετικό", "Optional")}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function PackageGroup({
  title,
  body,
  canAdd,
  addLabel,
  onAdd,
  emptyLabel,
  children,
}: {
  title: string;
  body: string;
  canAdd: boolean;
  addLabel: string;
  onAdd: () => void;
  emptyLabel: string | null;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-900">{title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:py-1.5"
        >
          + {addLabel}
        </button>
      </div>
      {emptyLabel ? <p className="text-xs text-slate-400">{emptyLabel}</p> : null}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function PackageCard({
  pkg,
  lang,
  types,
  showPlatform,
  lockedPlatform,
  canRemove,
  onUpdate,
  onRemove,
  chipBtn,
  L,
}: {
  pkg: ServicePackage;
  lang: Lang;
  types: PackageType[];
  showPlatform: boolean;
  lockedPlatform: string | null;
  canRemove: boolean;
  onUpdate: (id: string, patch: Partial<ServicePackage>) => void;
  onRemove: (id: string) => void;
  chipBtn: (active: boolean) => string;
  L: (el: string, en: string) => string;
}) {
  const hint = PACKAGE_TYPE_HINT[pkg.type]?.[lang];
  const priceOk = pkg.price.trim() !== "" && isPositivePriceInput(pkg.price);
  const preview = priceOk ? formatEuroAmount(pkg.price, lang) : "";
  const suffix = packagePriceSuffix(pkg.type, lang);
  const priceLabel =
    pkg.type === "ugc_photo" ? L("Ανά φωτογραφία", "Per photo") : L("Τιμή", "Price");

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">
            {packageTitle(pkg.platform, pkg.type, pkg.quantity, lang)}
          </p>
          {preview ? (
            <p className="mt-0.5 text-sm font-extrabold tabular-nums text-blue-700">
              {suffix ? `${preview} ${suffix}` : preview}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onRemove(pkg.id)}
          disabled={!canRemove}
          className="inline-flex min-h-11 shrink-0 items-center text-xs font-semibold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30 sm:min-h-0"
        >
          {L("Αφαίρεση", "Remove")}
        </button>
      </div>

      {showPlatform ? (
        <div className="mb-2">
          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">
            {L("Πλατφόρμα", "Platform")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SOCIAL_PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                className={chipBtn(pkg.platform === p)}
                onClick={() => onUpdate(pkg.id, { platform: p })}
              >
                {PLATFORM_CHIP[p][lang]}
              </button>
            ))}
          </div>
        </div>
      ) : lockedPlatform ? (
        <p className="mb-2 text-[11px] font-semibold text-slate-500">{lockedPlatform}</p>
      ) : null}

      <div className="mb-2">
        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">{L("Τύπος", "Type")}</p>
        <div className="flex flex-wrap gap-1.5">
          {types.map((t) => {
            const typeHint = PACKAGE_TYPE_HINT[t]?.[lang];
            return (
              <span key={t} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  className={chipBtn(pkg.type === t)}
                  onClick={() => onUpdate(pkg.id, { type: t })}
                >
                  {TYPE_CHIP[t][lang]}
                </button>
                {typeHint ? <InfoTooltip text={typeHint} ariaLabel={L("Τι είναι", "What this is")} /> : null}
              </span>
            );
          })}
        </div>
        {hint ? <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
            {L("Ποσότητα", "Qty")}
          </label>
          <select
            value={pkg.quantity}
            onChange={(e) => onUpdate(pkg.id, { quantity: parseInt(e.target.value, 10) || 1 })}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 sm:py-1.5"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">{priceLabel}</label>
          <div className="relative">
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={pkg.price}
              onChange={(e) => onUpdate(pkg.id, { price: e.target.value })}
              placeholder="150"
              aria-invalid={pkg.price.trim() !== "" && !isPositivePriceInput(pkg.price)}
              className={`w-full rounded-lg border bg-white px-2 py-2 pr-7 text-sm text-slate-900 sm:py-1.5 ${
                pkg.price.trim() && !isPositivePriceInput(pkg.price) ? "border-red-400" : "border-slate-300"
              }`}
            />
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs font-semibold text-slate-500">
              €
            </span>
          </div>
          {pkg.price.trim() && !isPositivePriceInput(pkg.price) ? (
            <p className="mt-1 text-[10px] text-red-600">{FIXED_PRICE_MESSAGE[lang]}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
            {L("Ημέρες", "Days")}
          </label>
          <input
            type="number"
            min={0}
            max={365}
            value={pkg.delivery_days ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onUpdate(pkg.id, {
                delivery_days: v === "" ? null : Math.min(365, Math.max(0, parseInt(v, 10) || 0)),
              });
            }}
            placeholder="7"
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 sm:py-1.5"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
            {L("Δικαιώματα", "Usage")}
          </label>
          <select
            value={pkg.usage_rights || "none"}
            onChange={(e) => onUpdate(pkg.id, { usage_rights: e.target.value as UsageRights })}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 sm:py-1.5"
          >
            {USAGE_RIGHTS.map((u) => (
              <option key={u} value={u}>
                {USAGE_RIGHTS_LABEL[u][lang]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-2">
        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
          {L("Περιγραφή", "Description")}
        </label>
        <textarea
          value={pkg.description || ""}
          onChange={(e) => onUpdate(pkg.id, { description: e.target.value })}
          rows={2}
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
          placeholder={L("Προαιρετικά…", "Optional…")}
        />
      </div>
    </div>
  );
}
