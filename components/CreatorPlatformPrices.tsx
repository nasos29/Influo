"use client";

import { useState } from "react";
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";
import {
  creatorNetworksFromAccounts,
  FIXED_PRICE_MESSAGE,
  isPositivePriceInput,
  SERVICE_CATALOG,
  type CreatorServicePrices,
  type ServiceCatalogItem,
  type ServiceGroup,
} from "@/lib/servicePackages";

type Lang = "el" | "en";

const COPY = {
  el: {
    title: "Τιμές υπηρεσιών",
    body: "Όλα προαιρετικά. Κενό σημαίνει ότι δεν την προσφέρεις. Η τιμή είναι ένας ακέραιος σε ευρώ.",
    none: "Πρόσθεσε Instagram, TikTok ή YouTube στα social για να ανοίξουν οι αντίστοιχες τιμές. UGC και Άλλα μένουν διαθέσιμα.",
    more: "Περισσότερες υπηρεσίες",
    less: "Λιγότερες υπηρεσίες",
    addonsHint: "Σταθερή τιμή. Δεν μπαίνουν στο «Από».",
    groups: {
      instagram: "Instagram",
      tiktok: "TikTok",
      youtube: "YouTube",
      ugc: "UGC",
      other: "Άλλα",
      addon: "Επιπλέον χρεώσεις",
    },
  },
  en: {
    title: "Service prices",
    body: "All optional. Leave a field empty to skip it. The price is one whole number in euros.",
    none: "Add Instagram, TikTok, or YouTube under socials to open those prices. UGC and Other stay available.",
    more: "More services",
    less: "Fewer services",
    addonsHint: "A fixed price. They are not part of the “from” amount.",
    groups: {
      instagram: "Instagram",
      tiktok: "TikTok",
      youtube: "YouTube",
      ugc: "UGC",
      other: "Other",
      addon: "Extra charges",
    },
  },
} as const;

const GROUP_ORDER: ServiceGroup[] = ["instagram", "tiktok", "youtube", "ugc", "other", "addon"];

function GroupIcon({ group }: { group: ServiceGroup }) {
  const box = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white";
  if (group === "instagram") {
    return (
      <span className={`${box} bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400`}>
        <FaInstagram aria-hidden className="h-4 w-4" />
      </span>
    );
  }
  if (group === "tiktok") {
    return (
      <span className={`${box} bg-black`}>
        <FaTiktok aria-hidden className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (group === "youtube") {
    return (
      <span className={`${box} bg-red-600`}>
        <FaYoutube aria-hidden className="h-4 w-4" />
      </span>
    );
  }
  if (group === "ugc") return <span className={`${box} bg-blue-600 text-[10px] font-bold tracking-wide`}>UGC</span>;
  if (group === "other") return <span className={`${box} bg-slate-700 text-[10px] font-bold`}>+</span>;
  return <span className={`${box} bg-slate-900 text-sm font-bold`}>+</span>;
}

function PriceField({
  item,
  lang,
  value,
  invalidText,
  onChange,
}: {
  item: ServiceCatalogItem;
  lang: Lang;
  value: string;
  invalidText: string;
  onChange: (value: string) => void;
}) {
  const invalid = value.trim() !== "" && !isPositivePriceInput(value);
  return (
    <label className="block rounded-xl border border-slate-200 bg-white p-2.5">
      <span className="block text-sm font-semibold text-slate-900">{item.title[lang]}</span>
      <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{item.description[lang]}</span>
      <span className="relative mt-2 block">
        <input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="150"
          aria-invalid={invalid}
          className={`w-full rounded-lg border bg-white px-3 py-2 pr-8 text-sm text-slate-900 ${
            invalid ? "border-red-400" : "border-slate-300"
          }`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-slate-500">
          €
        </span>
      </span>
      {invalid ? <span className="mt-1 block text-[11px] text-red-600">{invalidText}</span> : null}
    </label>
  );
}

export default function CreatorPlatformPrices({
  lang,
  accounts,
  prices,
  onChange,
}: {
  lang: Lang;
  accounts: Array<{ platform?: string | null }>;
  prices: CreatorServicePrices;
  onChange: (next: CreatorServicePrices) => void;
}) {
  const copy = COPY[lang];
  const networks = creatorNetworksFromAccounts(accounts);
  const invalidText = lang === "en" ? FIXED_PRICE_MESSAGE.en : FIXED_PRICE_MESSAGE.el;
  const [more, setMore] = useState(() =>
    SERVICE_CATALOG.some((item) => {
      if (item.basic) return false;
      if (item.requires && !networks[item.requires]) return false;
      return String(prices[item.key] ?? "").trim() !== "";
    })
  );

  const set = (key: ServiceCatalogItem["key"], value: string) => onChange({ ...prices, [key]: value });

  const groups = GROUP_ORDER.map((group) => {
    const items = SERVICE_CATALOG.filter((item) => {
      if (item.group !== group) return false;
      if (item.requires && !networks[item.requires]) return false;
      if (!item.basic && !more) return false;
      return true;
    });
    return { group, items };
  }).filter((group) => group.items.length > 0);

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{copy.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{copy.body}</p>
      {!networks.instagram && !networks.tiktok && !networks.youtube ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{copy.none}</p>
      ) : null}
      <div className="mt-3 space-y-4">
        {groups.map(({ group, items }) => (
          <section key={group}>
            <div className="mb-2 flex items-center gap-2">
              <GroupIcon group={group} />
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-slate-900">{copy.groups[group]}</h4>
                {group === "addon" ? <p className="text-[11px] leading-snug text-slate-500">{copy.addonsHint}</p> : null}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <PriceField
                  key={item.key}
                  item={item}
                  lang={lang}
                  value={String(prices[item.key] ?? "")}
                  invalidText={invalidText}
                  onChange={(value) => set(item.key, value)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <button
        type="button"
        aria-expanded={more}
        onClick={() => setMore((open) => !open)}
        className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-800"
      >
        {more ? copy.less : copy.more}
      </button>
    </div>
  );
}
