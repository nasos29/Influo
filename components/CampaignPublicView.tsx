"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
import { campaignClosesMeta } from "@/components/CampaignCard";
import { supabase } from "@/lib/supabaseClient";
import { loadOwnProfiles } from "@/lib/ownProfile";
import { categoryLabel } from "@/lib/categories";
import { notifyBrandOfApplication, submitCampaignApplication } from "@/lib/campaignApply";
import { findContactInfo, filterWorkLinks } from "@/lib/contactFilter";
import { toastError, toastSuccess } from "@/components/Feedback";
import { getStoredLanguage } from "@/lib/language";
import { formatEuro } from "@/lib/formatEuro";
import { campaignAudience, type CampaignAudience } from "@/lib/campaignAudience";
import { formatFollowerCount } from "@/lib/platformStats";
import { campaignPublicBadgeLabel } from "@/lib/campaignPublicBadge";
import BrandAboutCard from "@/components/BrandAboutCard";
import { CampaignDescriptionText } from "@/lib/campaignDescription";
import { displayLocation } from "@/lib/displayLocation";
import CampaignCover, { PlatformIcon } from "@/components/CampaignCover";
import FastImage from "@/components/FastImage";

const CONTACT_BLOCKED = {
  el: "Για την ασφάλειά σας δεν επιτρέπονται links, email ή τηλέφωνα. Η επικοινωνία γίνεται μέσα από το Influo.",
  en: "For your safety, links, emails and phone numbers aren't allowed. Communication happens inside Influo.",
};
const WORK_LINK_HINT = {
  el: "Επιτρέπονται μόνο links από Instagram, TikTok, YouTube, Facebook και άλλα social.",
  en: "Only Instagram, TikTok, YouTube, Facebook and other social links are allowed.",
};

type Campaign = {
  id: string;
  brand_id?: string | null;
  title: string;
  description: string;
  budget: number;
  category: string | null;
  deliverables: string | null;
  deadline: string | null;
  opened_at?: string | null;
  created_at?: string | null;
  starts_on?: string | null;
  location?: string | null;
  min_followers?: number | null;
  platforms?: string[] | null;
  cover_url?: string | null;
  compensation_type?: string | null;
  status: string;
  applications_count?: number | null;
  brands:
    | {
        brand_name: string;
        logo_url: string | null;
        bio?: string | null;
        city?: string | null;
        website?: string | null;
        instagram?: string | null;
      }
    | {
        brand_name: string;
        logo_url: string | null;
        bio?: string | null;
        city?: string | null;
        website?: string | null;
        instagram?: string | null;
      }[]
    | null;
};

function brandOf(row: Campaign) {
  const value = row.brands;
  return Array.isArray(value) ? value[0] : value;
}

function splitDeliverables(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,;+]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const PLATFORM_LABEL: Record<string, { el: string; en: string }> = {
  instagram: { el: "Instagram", en: "Instagram" },
  tiktok: { el: "TikTok", en: "TikTok" },
  youtube: { el: "YouTube", en: "YouTube" },
  facebook: { el: "Facebook", en: "Facebook" },
};

export default function CampaignPublicView({
  id,
  applicationsCount = 0,
  initialCampaign = null,
}: {
  id: string;
  /** Non-withdrawn application count only — no applicant details. */
  applicationsCount?: number;
  /** Server-loaded with the same visibility rule as /campaigns list. */
  initialCampaign?: Campaign | null;
}) {
  const pathname = usePathname();
  const [lang, setLang] = useState<"el" | "en">(pathname?.startsWith("/en") ? "en" : getStoredLanguage() === "en" ? "en" : "el");
  const el = lang === "el";
  const [campaign, setCampaign] = useState<Campaign | null>(initialCampaign);
  const [missing, setMissing] = useState(!initialCampaign);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(!initialCampaign);
  const [audience, setAudience] = useState<CampaignAudience>({ kind: "anonymous" });
  const [influencerId, setInfluencerId] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [available, setAvailable] = useState(true);
  const [applied, setApplied] = useState(false);
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState("");
  const [links, setLinks] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [workLinksError, setWorkLinksError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage() === "en" ? "en" : "el");
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadError(false);
      setApplied(false);
      setInfluencerId(null);
      setApproved(false);
      setAudience({ kind: "anonymous" });
      // Prefer server-loaded row (same visibility as /campaigns). Avoid RLS drift on client.
      let loadedRow: Campaign | null = initialCampaign;
      if (loadedRow) {
        setCampaign(loadedRow);
        setMissing(false);
        setLoading(false);
      } else {
        setMissing(true);
        setCampaign(null);
        setLoading(false);
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const signedIn = !!sessionData.session;
      let nextInfluencerId: string | null = null;
      let nextBrandId: string | null = null;
      if (signedIn) {
        const profiles = await loadOwnProfiles(supabase);
        if (profiles.ok && profiles.brand && typeof profiles.brand.id === "string") {
          nextBrandId = profiles.brand.id;
        }
        if (profiles.ok && profiles.influencer) {
          const inf = profiles.influencer;
          const rawId = inf.id;
          nextInfluencerId = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : "";
          setInfluencerId(nextInfluencerId);
          setApproved(!!inf.approved);
          setAvailable(!inf.availability_status || inf.availability_status === "available");
          if (nextInfluencerId) {
            const { data: mine } = await supabase
              .from("campaign_applications")
              .select("id, status")
              .eq("campaign_id", id)
              .eq("influencer_id", nextInfluencerId)
              .maybeSingle();
            if (mine && mine.status !== "withdrawn") setApplied(true);
          }
        }
      }
      const campaignBrandId = loadedRow && typeof loadedRow.brand_id === "string" ? loadedRow.brand_id : null;
      setAudience(campaignAudience({
        signedIn,
        influencerId: nextInfluencerId,
        brandId: nextBrandId,
        campaignBrandId,
      }));
      setLoading(false);
    };
    load().catch(() => {
      if (cancelled) return;
      setLoadError(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, initialCampaign]);

  const markAvailable = async () => {
    if (!influencerId) return;
    const { error } = await supabase.from("influencers").update({ availability_status: "available" }).eq("id", influencerId);
    if (error) {
      toastError(error.message);
      return;
    }
    setAvailable(true);
  };

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!influencerId || !approved || applied) return;
    if (!available) {
      toastError(el ? "Είστε προσωρινά μη διαθέσιμος. Σημειώστε διαθεσιμότητα για να κάνετε αίτηση." : "You are temporarily unavailable. Mark yourself available to apply.");
      return;
    }
    setMessageError(null);
    setWorkLinksError(null);
    if (findContactInfo(message)) {
      const msg = CONTACT_BLOCKED[el ? "el" : "en"];
      setMessageError(msg);
      toastError(msg);
      return;
    }
    const filtered = filterWorkLinks(links);
    if (filtered.rejected.length > 0) {
      const msg = WORK_LINK_HINT[el ? "el" : "en"];
      setWorkLinksError(msg);
      toastError(msg);
      return;
    }
    setSubmitting(true);
    const result = await submitCampaignApplication({
      campaignId: id,
      influencerId,
      message,
      proposedPrice: price,
      workLinks: filtered.ok.join("\n"),
    });
    setSubmitting(false);
    if (result.duplicate) {
      setApplied(true);
      toastError(el ? "Έχετε ήδη κάνει αίτηση." : "You already applied.");
      return;
    }
    if (result.error === "contact_info_not_allowed") {
      const msg = CONTACT_BLOCKED[el ? "el" : "en"];
      setMessageError(msg);
      toastError(msg);
      return;
    }
    if (result.error === "work_link_not_allowed") {
      const msg = WORK_LINK_HINT[el ? "el" : "en"];
      setWorkLinksError(msg);
      toastError(msg);
      return;
    }
    if (result.error || !result.id) {
      toastError(result.error || "Error");
      return;
    }
    if (result.migration) toastError(el ? "Η αίτηση στάλθηκε. Τρέξτε το docs/CAMPAIGN_WORKFLOW_2026.sql για τιμή και δείγματα." : "Applied. Run docs/CAMPAIGN_WORKFLOW_2026.sql to store price and samples.");
    await notifyBrandOfApplication(result.id);
    setApplied(true);
    toastSuccess(el ? "Η αίτηση στάλθηκε." : "Application sent.");
  };

  const brand = campaign ? brandOf(campaign) : null;
  const deliverables = campaign ? splitDeliverables(campaign.deliverables) : [];
  const platforms = campaign && Array.isArray(campaign.platforms) ? campaign.platforms : [];
  const closes = campaign
    ? campaignClosesMeta(
        {
          deadline: campaign.deadline,
          opened_at: campaign.opened_at,
          created_at: campaign.created_at,
        },
        lang === "en" ? "en" : "el"
      )
    : null;
  const locale = el ? "el-GR" : "en-GB";
  const appsCount = campaign?.applications_count ?? applicationsCount;
  const publicBadge = campaign
    ? campaignPublicBadgeLabel(appsCount, campaign.opened_at, lang === "en" ? "en" : "el")
    : null;

  const compensationText =
    campaign?.compensation_type === "money"
      ? el ? "Χρήματα" : "Money"
      : campaign?.compensation_type === "product"
        ? el ? "Προϊόν" : "Product"
        : campaign?.compensation_type === "both"
          ? el ? "Χρήματα και προϊόν" : "Money & product"
          : null;

  const scrollToApply = () => {
    const anchors = Array.from(document.querySelectorAll<HTMLElement>("[data-apply-anchor]"));
    const target = anchors.find((node) => node.offsetParent !== null) || anchors[0];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = target.querySelector<HTMLElement>("textarea, input, select, a[href], button:not([disabled])");
    window.setTimeout(() => focusable?.focus({ preventScroll: true }), 350);
  };
  const applyBlock = (
    <div className="space-y-3">
      {audience.kind === "anonymous" && (
        <Link href={`/login?redirect=${encodeURIComponent(`/campaigns/${id}`)}`} className="inline-flex w-full justify-center px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium">
          {el ? "Σύνδεση για αίτηση" : "Sign in to apply"}
        </Link>
      )}
      {audience.kind === "brand" && audience.owns && (
        <Link href="/brand/dashboard?tab=campaigns" className="inline-flex w-full justify-center px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium">
          {el ? "Διαχείριση καμπάνιας" : "Manage campaign"}
        </Link>
      )}
      {audience.kind === "influencer" && !approved && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
          {el
            ? "Το προφίλ σας είναι σε εκκρεμότητα. Μέχρι την έγκριση δεν μπορείτε να δείτε ή να κάνετε αίτηση σε καμπάνιες."
            : "Your profile is pending. You cannot view or apply to campaigns until it is approved."}
        </p>
      )}
      {audience.kind === "influencer" && approved && applied && (
        <p className="text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          {el ? "Έχετε ήδη κάνει αίτηση σε αυτή την καμπάνια." : "You have already applied to this campaign."}
        </p>
      )}
      {audience.kind === "influencer" && approved && !applied && (
        <form onSubmit={apply} className="space-y-3">
          {!available && (
            <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p>{el ? "Εμφανίζεστε ως μη διαθέσιμος προσωρινά, οπότε η αίτηση είναι κλειστή." : "You are marked temporarily unavailable, so applications are closed."}</p>
              <button type="button" onClick={markAvailable} className="mt-2 text-sm font-medium text-blue-700 underline">
                {el ? "Σήμανση ως διαθέσιμος" : "Mark as available"}
              </button>
            </div>
          )}
          <label className="block text-sm font-medium text-slate-700">
            {el ? "Μήνυμα" : "Message"}
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setMessageError(null);
              }}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
            <span className="block text-xs text-slate-500 mt-1 font-normal">{CONTACT_BLOCKED[el ? "el" : "en"]}</span>
            {messageError && <span className="block text-xs text-red-600 mt-1 font-normal">{messageError}</span>}
          </label>
          <label className="block text-sm font-medium text-slate-700">
            {el ? "Προτεινόμενη τιμή (προαιρετικό)" : "Proposed price (optional)"}
            <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            {el ? "Σύνδεσμοι προηγούμενης δουλειάς (προαιρετικό)" : "Links to past work (optional)"}
            <textarea
              rows={2}
              value={links}
              onChange={(e) => {
                setLinks(e.target.value);
                setWorkLinksError(null);
              }}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              placeholder="https://"
            />
            <span className="block text-xs text-slate-500 mt-1 font-normal">{WORK_LINK_HINT[el ? "el" : "en"]}</span>
            {workLinksError && <span className="block text-xs text-red-600 mt-1 font-normal">{workLinksError}</span>}
          </label>
          <button type="submit" disabled={submitting || !available} className="w-full px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
            {submitting ? "…" : el ? "Αίτηση" : "Apply"}
          </button>
        </form>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20">
      <SiteHeader lang={lang === "en" ? "en" : "el"} onLangChange={setLang} />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-10 w-full">
        <Link href={lang === "en" ? "/en/campaigns" : "/campaigns"} className="text-sm text-blue-600 hover:underline">
          {el ? "← Ανοιχτές καμπάνιες" : "← Open campaigns"}
        </Link>
        {loading ? (
          <div className="mt-6 h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        ) : loadError ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8">
            <h1 className="text-2xl font-bold text-slate-900">{el ? "Η καμπάνια άργησε να φορτώσει" : "This campaign took too long to load"}</h1>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm">
              {el ? "Δοκιμάστε ξανά" : "Try again"}
            </button>
          </div>
        ) : missing || !campaign ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8">
            <h1 className="text-2xl font-bold text-slate-900">{el ? "Η καμπάνια δεν είναι διαθέσιμη" : "This campaign is not available"}</h1>
            <p className="text-slate-600 mt-2">{el ? "Τα πρόχειρα και οι κλειστές καμπάνιες δεν είναι δημόσιες." : "Draft and closed campaigns are not public."}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
              <CampaignCover
                coverUrl={campaign.cover_url}
                title={campaign.title}
                brandName={brand?.brand_name}
                logoUrl={brand?.logo_url}
                category={campaign.category}
                platforms={platforms}
                aspect="16/9"
                sizes="(max-width: 1024px) 100vw, 1024px"
                priority
              />
            </div>

            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
              <article className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-wrap items-start gap-3">
                  <h1 className="text-3xl font-bold text-slate-900 flex-1 min-w-0">{campaign.title}</h1>
                  {publicBadge ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 text-sm font-medium shrink-0">
                      {publicBadge}
                    </span>
                  ) : null}
                </div>

                {brand?.brand_name ? (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center">
                      {brand.logo_url ? (
                        <FastImage src={brand.logo_url} alt={brand.brand_name} fill className="object-cover" sizes="44px" />
                      ) : (
                        <span className="text-lg font-semibold text-slate-600">{brand.brand_name.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">{el ? "Από" : "By"}</p>
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {brand.brand_name}
                        {brand.city ? <span className="font-normal text-slate-500"> · {brand.city}</span> : null}
                      </p>
                    </div>
                  </div>
                ) : null}

                <section className="mt-8">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                    {el ? "Περιγραφή" : "Description"}
                  </h2>
                  <p className="text-slate-700 mt-3 whitespace-pre-wrap">
                    <CampaignDescriptionText text={campaign.description} />
                  </p>
                </section>

                {(deliverables.length > 0 || platforms.length > 0) && (
                  <section className="mt-8">
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                      {el ? "Παραδοτέα" : "Deliverables"}
                    </h2>
                    {platforms.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {platforms.map((p) => (
                          <span key={p} className="inline-flex min-h-[44px] items-center gap-1.5 px-3 py-2 sm:min-h-0 sm:px-2.5 sm:py-1 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-800">
                            <PlatformIcon platform={p} />
                            {PLATFORM_LABEL[p]?.[lang === "en" ? "en" : "el"] || p}
                          </span>
                        ))}
                      </div>
                    )}
                    {deliverables.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {deliverables.map((d) => (
                          <li key={d} className="flex gap-2 text-sm text-slate-700">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                            <span>
                              <CampaignDescriptionText text={d} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                <section className="mt-8">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                    {el ? "Απαιτήσεις" : "Requirements"}
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm text-slate-800">
                    {campaign.category ? (
                      <li>
                        <span className="text-slate-500">{el ? "Κατηγορία" : "Category"}: </span>
                        {categoryLabel(campaign.category, lang) || campaign.category}
                      </li>
                    ) : null}
                    {campaign.min_followers ? (
                      <li>
                        <span className="text-slate-500">{el ? "Ελάχιστοι ακόλουθοι" : "Minimum followers"}: </span>
                        {formatFollowerCount(campaign.min_followers)}
                      </li>
                    ) : null}
                    {campaign.location ? (
                      <li>
                        <span className="text-slate-500">{el ? "Τοποθεσία" : "Location"}: </span>
                        {displayLocation(campaign.location, el ? "el" : "en")}
                      </li>
                    ) : null}
                    {!campaign.category && !campaign.min_followers && !campaign.location ? (
                      <li className="text-slate-500">—</li>
                    ) : null}
                  </ul>
                </section>

                <section className="mt-8">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                    {el ? "Αμοιβή" : "Compensation"}
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm text-slate-800">
                    {compensationText ? (
                      <li>
                        <span className="text-slate-500">{el ? "Τύπος" : "Type"}: </span>
                        {compensationText}
                      </li>
                    ) : null}
                    {Number(campaign.budget) > 0 ? (
                      <li>
                        <span className="text-slate-500">Budget: </span>
                        <span className="font-semibold">{formatEuro(Number(campaign.budget), el ? "el" : "en")}</span>
                      </li>
                    ) : null}
                    {!compensationText && !(Number(campaign.budget) > 0) ? <li className="text-slate-500">—</li> : null}
                  </ul>
                </section>

                <section className="mt-8">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                    {el ? "Ημερομηνίες" : "Dates"}
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm text-slate-800">
                    {campaign.starts_on ? (
                      <li>
                        <span className="text-slate-500">{el ? "Έναρξη" : "Starts"}: </span>
                        {new Date(campaign.starts_on).toLocaleDateString(locale)}
                      </li>
                    ) : null}
                    {closes ? (
                      <li>
                        <span className="text-slate-500">{el ? "Προθεσμία" : "Deadline"}: </span>
                        {closes.dateLabel ? `${closes.dateLabel} · ` : ""}
                        <span className={closes.urgent ? "font-semibold text-red-700" : ""}>{closes.text}</span>
                      </li>
                    ) : null}
                    {!campaign.starts_on && !closes ? <li className="text-slate-500">—</li> : null}
                  </ul>
                </section>

                <div data-apply-anchor className="mt-8 md:hidden border-t border-slate-100 pt-6 scroll-mt-4">{applyBlock}</div>
              </article>

              <aside className="space-y-4 md:sticky md:top-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{el ? "Budget" : "Budget"}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {formatEuro(Number(campaign.budget), el ? "el" : "en")}
                  </p>
                  {closes && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {el ? "Προθεσμία" : "Deadline"}
                      </p>
                      <p className={`mt-1 text-sm font-semibold ${closes.urgent ? "text-red-700" : "text-slate-800"}`}>
                        {closes.text}
                      </p>
                      {closes.dateLabel && <p className="text-xs text-slate-500 mt-0.5">{closes.dateLabel}</p>}
                    </div>
                  )}
                  <div data-apply-anchor className="mt-5 hidden md:block scroll-mt-24">{applyBlock}</div>
                </div>

                <BrandAboutCard brand={brand} lang={lang === "en" ? "en" : "el"} />
              </aside>
            </div>
          </div>
        )}
      </main>
      {campaign && !loading && !missing && !loadError && audience.kind !== "brand" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)]">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <div className="min-w-0 flex-1 hidden sm:block">
              <p className="text-sm font-semibold text-slate-900 truncate">{campaign.title}</p>
              {closes && <p className={`text-xs ${closes.urgent ? "text-red-700" : "text-slate-500"}`}>{closes.text}</p>}
            </div>
            <button
              type="button"
              onClick={scrollToApply}
              disabled={audience.kind === "influencer" && approved && applied}
              className="w-full sm:w-auto sm:min-w-[200px] px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:bg-emerald-600 disabled:opacity-90"
            >
              {audience.kind === "influencer" && approved && applied
                ? el ? "Έχετε κάνει αίτηση" : "Applied"
                : el ? "Κάνε αίτηση" : "Apply"}
            </button>
          </div>
        </div>
      )}
      <Footer lang={lang === "en" ? "en" : "el"} />
    </div>
  );
}
