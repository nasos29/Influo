"use client";

import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";
import {
  creatorNetworksFromAccounts,
  FIXED_PRICE_MESSAGE,
  isPositivePriceInput,
  type CreatorServicePrices,
} from "@/lib/servicePackages";

type Lang = "el" | "en";

const COPY = {
  el: {
    title: "Τιμές υπηρεσιών",
    body: "Μόνο για τις πλατφόρμες που έχεις δηλώσει. Κενό σημαίνει ότι δεν την προσφέρεις. UGC είναι προαιρετικό.",
    none: "Πρόσθεσε Instagram, TikTok ή YouTube στα social για να ανοίξουν οι αντίστοιχες τιμές.",
    story: "Instagram Story",
    post: "Instagram Post",
    reel: "Instagram Reel",
    tiktok: "TikTok Video",
    youtube: "YouTube Video",
    ugc: "UGC Video",
    ugcHint: "Δεν χρειάζεται λογαριασμό. Το brand το ανεβάζει όπου θέλει.",
  },
  en: {
    title: "Service prices",
    body: "Only for the platforms you added. Leave a field empty to skip it. UGC is optional.",
    none: "Add Instagram, TikTok, or YouTube under socials to open those prices.",
    story: "Instagram Story",
    post: "Instagram Post",
    reel: "Instagram Reel",
    tiktok: "TikTok Video",
    youtube: "YouTube Video",
    ugc: "UGC Video",
    ugcHint: "No account needed. The brand publishes it wherever they want.",
  },
} as const;

function PlatformIcon({ kind }: { kind: "instagram" | "tiktok" | "youtube" | "ugc" }) {
  const box = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white";
  if (kind === "instagram") {
    return (
      <span className={`${box} bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400`}>
        <FaInstagram aria-hidden className="h-4 w-4" />
      </span>
    );
  }
  if (kind === "tiktok") {
    return (
      <span className={`${box} bg-black`}>
        <FaTiktok aria-hidden className="h-4 w-4" />
      </span>
    );
  }
  if (kind === "youtube") {
    return (
      <span className={`${box} bg-red-600`}>
        <FaYoutube aria-hidden className="h-4 w-4" />
      </span>
    );
  }
  return <span className={`${box} bg-blue-600 text-[10px] font-bold tracking-wide`}>UGC</span>;
}

function PriceField({
  kind,
  label,
  hint,
  value,
  invalidText,
  onChange,
}: {
  kind: "instagram" | "tiktok" | "youtube" | "ugc";
  label: string;
  hint?: string;
  value: string;
  invalidText: string;
  onChange: (value: string) => void;
}) {
  const invalid = value.trim() !== "" && !isPositivePriceInput(value);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2.5">
        <PlatformIcon kind={kind} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          {hint ? <p className="text-[11px] leading-snug text-slate-500">{hint}</p> : null}
        </div>
      </div>
      <div className="relative">
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
      </div>
      {invalid ? <p className="mt-1 text-[11px] text-red-600">{invalidText}</p> : null}
    </div>
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
  const set = (key: keyof CreatorServicePrices, value: string) => onChange({ ...prices, [key]: value });
  const invalidText = lang === "en" ? FIXED_PRICE_MESSAGE.en : FIXED_PRICE_MESSAGE.el;

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{copy.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{copy.body}</p>
      {!networks.instagram && !networks.tiktok && !networks.youtube ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{copy.none}</p>
      ) : null}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {networks.instagram ? (
          <>
            <PriceField kind="instagram" label={copy.story} value={prices.story} invalidText={invalidText} onChange={(value) => set("story", value)} />
            <PriceField kind="instagram" label={copy.post} value={prices.post} invalidText={invalidText} onChange={(value) => set("post", value)} />
            <PriceField kind="instagram" label={copy.reel} value={prices.reel} invalidText={invalidText} onChange={(value) => set("reel", value)} />
          </>
        ) : null}
        {networks.tiktok ? (
          <PriceField kind="tiktok" label={copy.tiktok} value={prices.tiktok} invalidText={invalidText} onChange={(value) => set("tiktok", value)} />
        ) : null}
        {networks.youtube ? (
          <PriceField kind="youtube" label={copy.youtube} value={prices.youtube} invalidText={invalidText} onChange={(value) => set("youtube", value)} />
        ) : null}
        <PriceField
          kind="ugc"
          label={copy.ugc}
          hint={copy.ugcHint}
          value={prices.ugc_video}
          invalidText={invalidText}
          onChange={(value) => set("ugc_video", value)}
        />
      </div>
    </div>
  );
}
