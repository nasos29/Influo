"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabaseClient";
import { loadOwnProfiles } from "@/lib/ownProfile";
import { categoryLabel } from "@/lib/categories";
import { notifyBrandOfApplication, submitCampaignApplication } from "@/lib/campaignApply";
import { findContactInfo, filterWorkLinks } from "@/lib/contactFilter";
import { toastError, toastSuccess } from "@/components/Feedback";
import { getStoredLanguage } from "@/lib/language";
import { campaignAudience, type CampaignAudience } from "@/lib/campaignAudience";

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
  starts_on?: string | null;
  location?: string | null;
  min_followers?: number | null;
  platforms?: string[] | null;
  compensation_type?: string | null;
  status: string;
  brands: { brand_name: string; logo_url: string | null } | { brand_name: string; logo_url: string | null }[] | null;
};

function brandOf(row: Campaign) {
  const value = row.brands;
  return Array.isArray(value) ? value[0] : value;
}

export default function CampaignPublicView({ id }: { id: string }) {
  const pathname = usePathname();
  const lang = pathname?.startsWith("/en") || getStoredLanguage() === "en" ? "en" : "el";
  const el = lang === "el";
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
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
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(false);
      setMissing(false);
      setApplied(false);
      setInfluencerId(null);
      setApproved(false);
      setAudience({ kind: "anonymous" });
      let timedOut = false;
      const nowIso = new Date().toISOString();
      const query = supabase
        .from("brand_campaigns")
        .select("id, brand_id, title, description, budget, category, deliverables, deadline, starts_on, location, min_followers, platforms, compensation_type, status, brands(brand_name, logo_url)")
        .eq("id", id)
        .eq("status", "open")
        .or(`deadline.is.null,deadline.gt.${nowIso}`)
        .maybeSingle();
      const timeout = new Promise<null>((resolve) => setTimeout(() => {
        timedOut = true;
        resolve(null);
      }, 10000));
      const result = await Promise.race([query, timeout]);
      if (cancelled) return;
      if (!result) {
        if (timedOut) setLoadError(true);
        else setMissing(true);
        setLoading(false);
        return;
      }
      const { data, error } = result;
      let loadedRow: Campaign | null = null;
      if (error && /column|schema cache/i.test(error.message || "")) {
        const basic = await supabase
          .from("brand_campaigns")
          .select("id, brand_id, title, description, budget, category, deliverables, deadline, status, brands(brand_name, logo_url)")
          .eq("id", id)
          .eq("status", "open")
          .or(`deadline.is.null,deadline.gt.${nowIso}`)
          .maybeSingle();
        if (!basic.error && basic.data && (basic.data as Campaign).status === "open") {
          loadedRow = basic.data as Campaign;
          setCampaign(loadedRow);
        } else setMissing(true);
      } else if (error || !data || data.status !== "open") {
        setMissing(true);
      } else {
        loadedRow = data;
        setCampaign(data);
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
  }, [id]);

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
  const comp =
    campaign?.compensation_type === "money"
      ? el ? "Χρήματα" : "Money"
      : campaign?.compensation_type === "product"
        ? el ? "Προϊόν" : "Product"
        : campaign?.compensation_type === "both"
          ? el ? "Χρήματα και προϊόν" : "Money and product"
          : "";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 w-full">
        <Link href={lang === "en" ? "/en/campaigns" : "/campaigns"} className="text-sm text-blue-600 hover:underline">
          {el ? "← Ανοιχτές καμπάνιες" : "← Open campaigns"}
        </Link>
        {loading ? (
          <div className="mt-6 h-64 rounded-xl bg-white border border-slate-200 animate-pulse" />
        ) : loadError ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8">
            <h1 className="text-2xl font-bold text-slate-900">{el ? "Η καμπάνια άργησε να φορτώσει" : "This campaign took too long to load"}</h1>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm">
              {el ? "Δοκιμάστε ξανά" : "Try again"}
            </button>
          </div>
        ) : missing || !campaign ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8">
            <h1 className="text-2xl font-bold text-slate-900">{el ? "Η καμπάνια δεν είναι διαθέσιμη" : "This campaign is not available"}</h1>
            <p className="text-slate-600 mt-2">{el ? "Τα πρόχειρα και οι κλειστές καμπάνιες δεν είναι δημόσιες." : "Draft and closed campaigns are not public."}</p>
          </div>
        ) : (
          <article className="mt-6 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <p className="text-sm text-slate-500">{brand?.brand_name}</p>
            <h1 className="text-3xl font-bold text-slate-900 mt-1">{campaign.title}</h1>
            <p className="text-slate-700 mt-4 whitespace-pre-wrap">{campaign.description}</p>
            <ul className="mt-4 text-sm text-slate-800 space-y-1">
              <li>Budget: €{Number(campaign.budget).toLocaleString(el ? "el-GR" : "en-GB")}</li>
              {campaign.category && <li>{el ? "Κατηγορία" : "Category"}: {categoryLabel(campaign.category, lang)}</li>}
              {comp && <li>{el ? "Αμοιβή" : "Compensation"}: {comp}</li>}
              {Array.isArray(campaign.platforms) && campaign.platforms.length > 0 && (
                <li>{el ? "Πλατφόρμες" : "Platforms"}: {campaign.platforms.join(", ")}</li>
              )}
              {campaign.min_followers ? <li>{el ? "Ελάχιστοι ακόλουθοι" : "Minimum followers"}: {campaign.min_followers}</li> : null}
              {campaign.location ? <li>{el ? "Περιοχή" : "Area"}: {campaign.location}</li> : null}
              {campaign.starts_on ? <li>{el ? "Έναρξη" : "Starts"}: {new Date(campaign.starts_on).toLocaleDateString(el ? "el-GR" : "en-GB")}</li> : null}
              {campaign.deadline ? <li>{el ? "Προθεσμία" : "Deadline"}: {new Date(campaign.deadline).toLocaleDateString(el ? "el-GR" : "en-GB")}</li> : null}
              {campaign.deliverables ? <li>{el ? "Παράδοση" : "Deliverables"}: {campaign.deliverables}</li> : null}
            </ul>

            <div className="mt-8 border-t border-slate-100 pt-6">
              {audience.kind === "anonymous" && (
                <Link href={`/login?redirect=${encodeURIComponent(`/campaigns/${id}`)}`} className="inline-flex px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium">
                  {el ? "Σύνδεση για αίτηση" : "Sign in to apply"}
                </Link>
              )}
              {audience.kind === "brand" && audience.owns && (
                <Link href="/brand/dashboard?tab=campaigns" className="inline-flex px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium">
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
                  <button type="submit" disabled={submitting || !available} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
                    {submitting ? "…" : el ? "Αίτηση" : "Apply"}
                  </button>
                </form>
              )}
            </div>
          </article>
        )}
      </main>
      <Footer lang={lang === "en" ? "en" : "el"} />
    </div>
  );
}
