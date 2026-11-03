"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import CreatorPhoto from "@/components/CreatorPhoto";
import InfluencerPresenceDot from "@/components/InfluencerPresenceDot";
import { categoryLabel } from "@/lib/categories";
import { publicProfilePath } from "@/lib/profileSlug";
import { displayNameForLang } from "@/lib/greeklish";
import { filterWorkLinks } from "@/lib/contactFilter";
import { formatEuroAmount } from "@/lib/formatEuro";

export type ApplicantAccount = { platform: string; username: string; followers: unknown; engagement_rate: unknown; url: string | null };
export type ApplicantFull = {
  display_name: string;
  avatar_url: string | null;
  profile_slug: string | null;
  categories: string[];
  accounts: ApplicantAccount[];
  location: string | null;
  verified: boolean;
  avg_rating: number | null;
  total_reviews: number;
  min_rate: string | null;
  videos: string[];
  completed: number;
  past_brands: string[];
};

type Lang = "el" | "en";

export function accountUrl(a: ApplicantAccount): string {
  if (a.url && /^https:\/\//.test(a.url)) return a.url;
  const u = encodeURIComponent(a.username);
  const p = a.platform.toLowerCase();
  if (p.includes("tiktok")) return `https://www.tiktok.com/@${u}`;
  if (p.includes("youtube")) return `https://www.youtube.com/@${u}`;
  if (p.includes("facebook")) return `https://www.facebook.com/${u}`;
  return `https://www.instagram.com/${u}`;
}

const PLATFORM_SHORT: Record<string, string> = { instagram: "IG", tiktok: "TT", youtube: "YT", facebook: "FB" };

function priceLabel(minRate: string | null, lang: Lang): string {
  if (!minRate) return "";
  const n = Number(String(minRate).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return lang === "el" ? `από ${Math.round(n)} €` : `from €${Math.round(n)}`;
}

export default function ApplicantCard({
  lang,
  influencerId,
  profile,
  fallbackName,
  fallbackAvatar,
  status,
  statusText,
  statusClass,
  invite,
  message,
  proposedPrice,
  workLinks,
  canDecide,
  onAccept,
  onReject,
  onShortlist,
  onMessage,
  footer,
}: {
  lang: Lang;
  influencerId: string;
  profile: ApplicantFull | null;
  fallbackName: string;
  fallbackAvatar: string | null;
  status: string;
  statusText: string;
  statusClass: string;
  invite: boolean;
  message: string | null;
  proposedPrice: number | null | undefined;
  workLinks: string | null | undefined;
  canDecide: boolean;
  onAccept: () => void;
  onReject: () => void;
  onShortlist: () => void;
  onMessage: () => void;
  footer?: ReactNode;
}) {
  const el = lang === "el";
  const [zoom, setZoom] = useState(false);
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState(false);
  const name = displayNameForLang(profile?.display_name || fallbackName || "Creator", lang);
  const avatar = profile?.avatar_url ?? fallbackAvatar;
  const work = filterWorkLinks(workLinks || "").ok;
  const samples = [...new Set([...work, ...(profile?.videos || [])])].slice(0, 4);
  const price = priceLabel(profile?.min_rate ?? null, lang);
  const text = message?.trim() || "";
  const long = text.length > 160;

  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex gap-3">
        <button type="button" onClick={() => avatar && setZoom(true)} className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={el ? "Μεγέθυνση φωτογραφίας" : "Enlarge photo"}>
          <CreatorPhoto src={avatar} name={name} className="w-16 h-16" rounded="rounded-full" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <InfluencerPresenceDot influencerId={influencerId} lang={lang} />
            <p className="font-semibold text-slate-900 truncate max-w-full">{name}</p>
            {profile?.verified ? (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px]" title={el ? "Επαληθευμένος" : "Verified"} aria-label={el ? "Επαληθευμένος" : "Verified"}>✓</span>
            ) : null}
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusClass}`}>{statusText}</span>
            {invite ? <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">{el ? "Πρόσκληση" : "Invite"}</span> : null}
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            {[
              profile?.location || "",
              profile && profile.total_reviews > 0 && profile.avg_rating ? `★ ${profile.avg_rating.toFixed(1)} (${profile.total_reviews})` : "",
              profile && profile.completed > 0 ? (el ? `${profile.completed} συνεργασίες` : `${profile.completed} collabs`) : "",
            ].filter(Boolean).join(" · ")}
          </p>
          {profile?.categories?.length ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {profile.categories.map((c) => (
                <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{categoryLabel(c, lang) || c}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {profile?.accounts?.length ? (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {profile.accounts.map((a) => {
            const key = a.platform.toLowerCase();
            const short = PLATFORM_SHORT[Object.keys(PLATFORM_SHORT).find((k) => key.includes(k)) || ""] || a.platform;
            const er = a.engagement_rate != null && String(a.engagement_rate).trim() ? `${String(a.engagement_rate).replace(/%$/, "")}%` : "";
            return (
              <a key={`${a.platform}-${a.username}`} href={accountUrl(a)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 max-w-full">
                <span className="font-semibold">{short}</span>
                <span className="truncate">@{a.username}</span>
                {a.followers != null && String(a.followers) !== "" ? <span className="text-slate-500">· {String(a.followers)}</span> : null}
                {er ? <span className="text-slate-500">· ER {er}</span> : null}
              </a>
            );
          })}
        </div>
      ) : null}

      <p className="text-xs text-slate-700 mt-2">
        {proposedPrice != null ? <><span className="text-slate-500">{el ? "Προτεινόμενη τιμή" : "Proposed price"}:</span> <strong>{formatEuroAmount(proposedPrice, lang)}</strong></> : price ? <><span className="text-slate-500">{el ? "Τιμή" : "Price"}:</span> <strong>{price}</strong></> : null}
      </p>

      {samples.length ? (
        <div className="mt-2">
          <p className="text-xs text-slate-500 mb-1">{el ? "Δείγματα δουλειάς" : "Sample work"}</p>
          <div className="flex flex-wrap gap-1.5">
            {samples.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100">
                ▶ {el ? "Δείγμα" : "Sample"} {i + 1}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {profile?.past_brands?.length ? (
        <div className="flex flex-wrap items-center gap-1 mt-2">
          <span className="text-xs text-slate-500">{el ? "Έχει συνεργαστεί με:" : "Worked with:"}</span>
          {profile.past_brands.map((b) => (
            <span key={b} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">{b}</span>
          ))}
        </div>
      ) : null}

      {text ? (
        <div className="mt-2 text-sm text-slate-700">
          <p className={`whitespace-pre-wrap ${!more && long ? "line-clamp-3" : ""}`}>{text}</p>
          {long ? (
            <button type="button" onClick={() => setMore((v) => !v)} className="text-xs text-blue-600 hover:underline mt-0.5">
              {more ? (el ? "Λιγότερα" : "Less") : el ? "Περισσότερα" : "More"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 sm:flex sm:flex-wrap gap-2 items-center">
        {canDecide ? (
          <>
            <button type="button" onClick={onAccept} className="text-sm px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium">{el ? "Αποδοχή" : "Accept"}</button>
            {status !== "rejected" ? (
              <button type="button" onClick={onReject} className="text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-medium">{el ? "Απόρριψη" : "Reject"}</button>
            ) : <span />}
          </>
        ) : null}
        <button type="button" onClick={onMessage} className="text-sm px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">{el ? "Μήνυμα" : "Message"}</button>
        <Link href={publicProfilePath(profile?.profile_slug, influencerId)} className="text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-medium text-center">{el ? "Προφίλ" : "Profile"}</Link>
        {canDecide && status !== "shortlisted" ? (
          <div className="relative col-span-2 sm:col-span-1">
            <button type="button" onClick={() => setMenu((v) => !v)} className="text-sm px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 w-full sm:w-auto" aria-haspopup="menu" aria-expanded={menu} aria-label={el ? "Περισσότερες ενέργειες" : "More actions"}>⋯</button>
            {menu ? (
              <div role="menu" className="absolute z-10 mt-1 right-0 sm:left-0 sm:right-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[10rem]">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onShortlist(); }} className="block w-full text-left text-sm px-3 py-2 hover:bg-slate-50">{el ? "Στη λίστα επιλογών" : "Shortlist"}</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {footer ? <div className="mt-2 flex flex-wrap items-center gap-2">{footer}</div> : null}

      {zoom && avatar ? (
        <div role="dialog" aria-modal="true" aria-label={name} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setZoom(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar} alt={name} className="max-w-full max-h-[85vh] rounded-2xl object-contain" />
          <button type="button" onClick={() => setZoom(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 text-slate-900 text-xl" aria-label={el ? "Κλείσιμο" : "Close"}>×</button>
        </div>
      ) : null}
    </article>
  );
}
