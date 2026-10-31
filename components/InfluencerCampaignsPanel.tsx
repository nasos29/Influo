"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { getStoredLanguage } from "@/lib/language";
import { notifyBrandOfApplication, submitCampaignApplication } from "@/lib/campaignApply";
import { findContactInfo, filterWorkLinks } from "@/lib/contactFilter";
import CampaignCard from "@/components/CampaignCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ToastViewport, { useToasts } from "@/components/ui/Toast";
import { formatDate, formatTime } from "@/lib/formatDateTime";
import { isTimeoutError, withTimeout } from "@/lib/withTimeout";

const CONTACT_BLOCKED = {
  el: "Για την ασφάλειά σας δεν επιτρέπονται links, email ή τηλέφωνα. Η επικοινωνία γίνεται μέσα από το Influo.",
  en: "For your safety, links, emails and phone numbers aren't allowed. Communication happens inside Influo.",
};
const WORK_LINK_HINT = {
  el: "Επιτρέπονται μόνο links από Instagram, TikTok, YouTube, Facebook και άλλα social.",
  en: "Only Instagram, TikTok, YouTube, Facebook and other social links are allowed.",
};

type CampaignWithBrand = {
  id: string;
  title: string;
  description: string;
  budget: number;
  category: string | null;
  deliverables: string | null;
  deadline: string | null;
  status: string;
  created_at: string;
  brands: { brand_name: string; logo_url: string | null } | null;
};

type MyApplication = {
  id: string;
  campaign_id: string;
  status: string;
  message: string | null;
  created_at: string;
  deliverable_url?: string | null;
  deliverable_note?: string | null;
  deliverable_status?: string | null;
  deliverable_review_note?: string | null;
  brand_campaigns: {
    title: string;
    status: string;
    brands: { brand_name: string } | null;
  } | null;
};

const pendingCopy = {
  el: {
    modal_title: "Απαιτείται έγκριση προφίλ",
    modal_body:
      "Για να βλέπετε και να κάνετε αίτηση σε καμπάνιες brands, το προφίλ σας πρέπει να έχει εγκριθεί από την ομάδα μας. Θα ενημερωθείτε όταν ολοκληρωθεί ο έλεγχος.",
    modal_ok: "Κατάλαβα",
    banner:
      "Μόλις εγκριθεί το προφίλ σας, θα εμφανίζονται εδώ οι διαθέσιμες καμπάνιες και θα μπορείτε να υποβάλετε αίτηση ενδιαφέροντος.",
  },
  en: {
    modal_title: "Profile approval required",
    modal_body:
      "To browse and apply to brand campaigns, your profile must be approved by our team. We will notify you when the review is complete.",
    modal_ok: "Got it",
    banner:
      "Once your profile is approved, available campaigns will appear here and you can submit your interest.",
  },
};

const applicationStatusUi = {
  el: {
    pending: "Εκκρεμεί",
    shortlisted: "Σε λίστα",
    rejected: "Απόρριψη",
    withdrawn: "Αποσύρθηκε",
    accepted: "Αποδεκτή",
  },
  en: {
    pending: "Pending",
    shortlisted: "Shortlisted",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
    accepted: "Accepted",
  },
};

const deliverableStatusUi = {
  el: {
    none: "Χωρίς παράδοση",
    submitted: "Υποβλήθηκε — αναμονή έγκρισης",
    approved: "Εγκρίθηκε",
    changes_requested: "Ζητήθηκαν αλλαγές",
  },
  en: {
    none: "No deliverable",
    submitted: "Submitted — awaiting review",
    approved: "Approved",
    changes_requested: "Changes requested",
  },
};

export default function InfluencerCampaignsPanel({
  influencerId,
  approved,
  available = true,
  onMarkAvailable,
}: {
  influencerId: string;
  approved: boolean;
  available?: boolean;
  onMarkAvailable?: () => Promise<void> | void;
}) {
  const [uiLang, setUiLang] = useState<"el" | "en">("el");
  const pc = pendingCopy[uiLang];
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const notify = (message: string, tone: "success" | "error" | "info" = "info") => pushToast(message, tone);

  const [campaigns, setCampaigns] = useState<CampaignWithBrand[]>([]);
  const [mine, setMine] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(!!approved);
  const [loadError, setLoadError] = useState<null | "timeout" | "error">(null);
  const [schemaError, setSchemaError] = useState(false);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [applyCampaign, setApplyCampaign] = useState<CampaignWithBrand | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [workLinks, setWorkLinks] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [workLinksError, setWorkLinksError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deliverDraft, setDeliverDraft] = useState<Record<string, { url: string; note: string }>>({});
  const [deliverSaving, setDeliverSaving] = useState<string | null>(null);

  useEffect(() => {
    setUiLang(getStoredLanguage() === "en" ? "en" : "el");
  }, []);

  const appliedCampaignIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of mine) {
      if (m.status !== "withdrawn") s.add(m.campaign_id);
    }
    return s;
  }, [mine]);

  const load = useCallback(async () => {
    setLoading(true);
    setSchemaError(false);
    setLoadError(null);

    try {
      const bundle = await withTimeout(
        (async () => {
          const openRes = await supabase
            .from("brand_campaigns")
            .select(
              `
        id,
        title,
        description,
        budget,
        category,
        deliverables,
        deadline,
        status,
        created_at,
        opened_at,
        brands ( brand_name, logo_url )
      `
            )
            .eq("status", "open")
            .order("created_at", { ascending: false });

          const mineRes = await supabase
            .from("campaign_applications")
            .select(
              `
        id,
        campaign_id,
        status,
        message,
        created_at,
        deliverable_url,
        deliverable_note,
        deliverable_status,
        deliverable_review_note,
        brand_campaigns (
          title,
          status,
          brands ( brand_name )
        )
      `
            )
            .eq("influencer_id", influencerId)
            .order("created_at", { ascending: false });

          return { openRes, mineRes };
        })(),
        20000
      );

      const { openRes, mineRes } = bundle;
      if (openRes.error) {
        if (openRes.error.code === "42P01" || openRes.error.message?.includes("brand_campaigns")) {
          setSchemaError(true);
        }
        console.error(openRes.error);
        setCampaigns([]);
        setLoadError("error");
      } else {
        setCampaigns((openRes.data as unknown as CampaignWithBrand[]) || []);
      }

      if (!mineRes.error && mineRes.data) {
        setMine(mineRes.data as unknown as MyApplication[]);
      } else if (mineRes.error) {
        console.error(mineRes.error);
        setLoadError("error");
      }
    } catch (error) {
      console.error(error);
      setLoadError(isTimeoutError(error) ? "timeout" : "error");
    } finally {
      setLoading(false);
    }
  }, [influencerId]);

  useEffect(() => {
    if (!approved) {
      setLoading(false);
      setCampaigns([]);
      setMine([]);
      return;
    }
    load();
  }, [approved, load]);

  const submitApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyCampaign || !approved) return;
    if (!available) {
      notify(uiLang === "el" ? "Είστε προσωρινά μη διαθέσιμος. Αλλάξτε τη διαθεσιμότητα για να κάνετε αίτηση." : "You are temporarily unavailable. Change availability to apply.", "error");
      return;
    }
    setMessageError(null);
    setWorkLinksError(null);
    if (findContactInfo(applyMessage)) {
      const msg = CONTACT_BLOCKED[uiLang];
      setMessageError(msg);
      notify(msg, "error");
      return;
    }
    const filtered = filterWorkLinks(workLinks);
    if (filtered.rejected.length > 0) {
      const msg = WORK_LINK_HINT[uiLang];
      setWorkLinksError(msg);
      notify(msg, "error");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitCampaignApplication({
        campaignId: applyCampaign.id,
        influencerId,
        message: applyMessage,
        proposedPrice,
        workLinks: filtered.ok.join("\n"),
      });
      if (result.duplicate) {
        notify(uiLang === "el" ? "Έχετε ήδη κάνει αίτηση σε αυτή την καμπάνια." : "You have already applied to this campaign.", "error");
        return;
      }
      if (result.error === "contact_info_not_allowed") {
        const msg = CONTACT_BLOCKED[uiLang];
        setMessageError(msg);
        notify(msg, "error");
        return;
      }
      if (result.error === "work_link_not_allowed") {
        const msg = WORK_LINK_HINT[uiLang];
        setWorkLinksError(msg);
        notify(msg, "error");
        return;
      }
      if (result.error || !result.id) {
        notify(result.error || (uiLang === "el" ? "Κάτι πήγε στραβά. Δοκίμασε ξανά." : "Something went wrong. Try again."), "error");
        return;
      }
      await notifyBrandOfApplication(result.id);
      setApplyCampaign(null);
      setApplyMessage("");
      setProposedPrice("");
      setWorkLinks("");
      setMessageError(null);
      setWorkLinksError(null);
      notify(uiLang === "el" ? "Η αίτηση στάλθηκε." : "Application sent.", "success");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async (appId: string) => {
    setWithdrawId(null);
    const { error } = await supabase
      .from("campaign_applications")
      .update({ status: "withdrawn" })
      .eq("id", appId)
      .eq("influencer_id", influencerId);
    if (error) notify(error.message, "error");
    else {
      notify(uiLang === "el" ? "Η αίτηση αποσύρθηκε." : "Application withdrawn.", "success");
      await load();
    }
  };

  const submitDeliverable = async (appId: string) => {
    const draft = deliverDraft[appId] || { url: "", note: "" };
    const url = draft.url.trim();
    if (!url) {
      notify(uiLang === "el" ? "Βάλε link παράδοσης (URL)." : "Add a deliverable URL.", "error");
      return;
    }
    setDeliverSaving(appId);
    try {
      const { error } = await supabase
        .from("campaign_applications")
        .update({
          deliverable_url: url,
          deliverable_note: draft.note.trim() || null,
          deliverable_status: "submitted",
          delivered_at: new Date().toISOString(),
        })
        .eq("id", appId)
        .eq("influencer_id", influencerId);
      if (error) {
        notify(
          /column|deliverable/i.test(error.message)
            ? uiLang === "el"
              ? "Η παράδοση δεν αποθηκεύτηκε. Δοκίμασε ξανά."
              : "The deliverable was not saved. Try again."
            : error.message,
          "error"
        );
        return;
      }
      await load();
    } finally {
      setDeliverSaving(null);
    }
  };

  const canShowDeliverable = (m: MyApplication) =>
    m.status === "shortlisted" ||
    m.status === "accepted" ||
    (!!m.deliverable_status && m.deliverable_status !== "none");

  if (schemaError) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
        {uiLang === "el" ? (
          <>
            Η λειτουργία καμπανιών δεν είναι ενεργή στη βάση. Ο διαχειριστής πρέπει να εκτελέσει το{" "}
            <code className="bg-amber-100 px-1 rounded">docs/BRAND_CAMPAIGNS_SCHEMA.sql</code> στο Supabase.
          </>
        ) : (
          <>
            Campaigns are not enabled in the database. Run{" "}
            <code className="bg-amber-100 px-1 rounded">docs/BRAND_CAMPAIGNS_SCHEMA.sql</code> in Supabase.
          </>
        )}
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 text-sm space-y-2">
        <p className="font-semibold">{pc.modal_title}</p>
        <p className="leading-relaxed">{pc.modal_body}</p>
        <p className="leading-relaxed">{pc.banner}</p>
      </div>
    );
  }

  const campaignsLink = uiLang === "en" ? "/en/campaigns" : "/campaigns";

  const loadErrorText =
    loadError === "timeout"
      ? uiLang === "el"
        ? "Η φόρτωση άργησε. Δοκίμασε ξανά."
        : "This took too long. Try again."
      : uiLang === "el"
        ? "Οι καμπάνιες δεν φορτώθηκαν."
        : "Campaigns could not be loaded.";

  return (
    <div className="space-y-8">
      <ToastViewport toasts={toasts} onDismiss={dismissToast} dismissLabel={uiLang === "el" ? "Κλείσιμο" : "Dismiss"} />
      <ConfirmDialog
        open={!!withdrawId}
        title={uiLang === "el" ? "Απόσυρση αίτησης;" : "Withdraw this application?"}
        body={uiLang === "el" ? "Η αίτηση θα αφαιρεθεί από την καμπάνια." : "The application will be removed from the campaign."}
        confirmLabel={uiLang === "el" ? "Απόσυρση" : "Withdraw"}
        cancelLabel={uiLang === "el" ? "Ακύρωση" : "Cancel"}
        onConfirm={() => {
          if (withdrawId) void withdraw(withdrawId);
        }}
        onCancel={() => setWithdrawId(null)}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-slate-600 text-sm">
          {uiLang === "el" ? (
            <>
              Δείτε ανοιχτές καμπάνιες από επαληθευμένα brands και δηλώστε ενδιαφέρον.{" "}
              <Link href={campaignsLink} className="text-blue-600 hover:underline font-medium">
                Δημόσια λίστα καμπανιών
              </Link>
            </>
          ) : (
            <>
              Browse open campaigns from verified brands and apply.{" "}
              <Link href={campaignsLink} className="text-blue-600 hover:underline font-medium">
                Public campaigns
              </Link>
            </>
          )}
        </p>
      </div>

      {applyCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              {uiLang === "el" ? "Αίτηση:" : "Apply:"} {applyCampaign.title}
            </h3>
            <p className="text-sm text-slate-500 mb-4">{applyCampaign.brands?.brand_name}</p>
            <form onSubmit={submitApply} className="space-y-4">
              {!available && (
                <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p>{uiLang === "el" ? "Εμφανίζεστε ως μη διαθέσιμος προσωρινά, οπότε η αίτηση είναι κλειστή." : "You are marked temporarily unavailable, so applications are closed."}</p>
                  {onMarkAvailable && (
                    <button type="button" onClick={() => void onMarkAvailable()} className="mt-2 text-sm font-medium text-blue-700 underline">
                      {uiLang === "el" ? "Σήμανση ως διαθέσιμος" : "Mark as available"}
                    </button>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {uiLang === "el" ? "Μήνυμα (προαιρετικό)" : "Message (optional)"}
                </label>
                <textarea
                  rows={4}
                  value={applyMessage}
                  onChange={(e) => {
                    setApplyMessage(e.target.value);
                    setMessageError(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  placeholder={
                    uiLang === "el"
                      ? "Γιατί ταιριάζετε σε αυτή την καμπάνια…"
                      : "Why you are a good fit…"
                  }
                />
                <p className="text-xs text-slate-500 mt-1">{CONTACT_BLOCKED[uiLang]}</p>
                {messageError && <p className="text-xs text-red-600 mt-1">{messageError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {uiLang === "el" ? "Προτεινόμενη τιμή (προαιρετικό)" : "Proposed price (optional)"}
                </label>
                <input type="number" min={0} step="0.01" value={proposedPrice} onChange={(e) => setProposedPrice(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {uiLang === "el" ? "Σύνδεσμοι προηγούμενης δουλειάς (προαιρετικό)" : "Links to past work (optional)"}
                </label>
                <textarea
                  rows={2}
                  value={workLinks}
                  onChange={(e) => {
                    setWorkLinks(e.target.value);
                    setWorkLinksError(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  placeholder="https://"
                />
                <p className="text-xs text-slate-500 mt-1">{WORK_LINK_HINT[uiLang]}</p>
                {workLinksError && <p className="text-xs text-red-600 mt-1">{workLinksError}</p>}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setApplyCampaign(null);
                    setApplyMessage("");
                    setMessageError(null);
                    setWorkLinksError(null);
                  }}
                  className="inline-flex min-h-11 items-center px-4 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-900 hover:bg-slate-50"
                >
                  {uiLang === "el" ? "Ακύρωση" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !available}
                  className="inline-flex min-h-11 items-center px-4 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-50"
                >
                  {uiLang === "el" ? "Υποβολή αίτησης" : "Submit application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section>
        <h2 className="text-xl font-semibold text-slate-900 mb-3">
          {uiLang === "el" ? "Ανοιχτές καμπάνιες" : "Open campaigns"}
        </h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
            <div className="h-40 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-40 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        ) : loadError && campaigns.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-600">{loadErrorText}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 inline-flex min-h-11 items-center justify-center px-5 rounded-xl bg-slate-900 text-white text-sm font-medium"
            >
              {uiLang === "el" ? "Δοκίμασε ξανά" : "Try again"}
            </button>
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl p-8 text-center">
            {uiLang === "el"
              ? "Δεν υπάρχουν ανοιχτές καμπάνιες αυτή τη στιγμή. Ελέγξτε ξανά αργότερα."
              : "No open campaigns right now. Check back later."}
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {campaigns.map((c) => {
              const already = appliedCampaignIds.has(c.id);
              return (
                <li key={c.id}>
                  <CampaignCard
                    campaign={{ ...c, status: c.status || "open" }}
                    lang={uiLang}
                    footer={
                      already ? (
                        <span className="inline-block text-xs font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-800">
                          {uiLang === "el" ? "Έχετε ήδη αίτηση" : "Already applied"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setApplyCampaign(c)}
                          className="inline-flex min-h-11 items-center px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                        >
                          {uiLang === "el" ? "Αίτηση ενδιαφέροντος" : "Apply"}
                        </button>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900 mb-3 flex flex-wrap items-center gap-2">
          {uiLang === "el" ? "Οι αιτήσεις μου" : "My applications"}
          {mine.some((m) => m.status === "pending") && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold">
              {mine.filter((m) => m.status === "pending").length > 99
                ? "99+"
                : mine.filter((m) => m.status === "pending").length}
            </span>
          )}
        </h2>
        {mine.length === 0 ? (
          <p className="text-slate-500 text-sm">
            {uiLang === "el" ? "Δεν έχετε υποβάλει αίτηση ακόμα." : "You have not applied yet."}
          </p>
        ) : (
          <ul className="space-y-2">
            {mine.map((m) => {
              const dStatus = m.deliverable_status || "none";
              const draft = deliverDraft[m.id] || {
                url: m.deliverable_url || "",
                note: m.deliverable_note || "",
              };
              const showDeliver = canShowDeliverable(m);
              return (
              <li
                key={m.id}
                className="flex flex-col gap-3 border border-slate-100 rounded-lg p-3 bg-slate-50"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">
                      {m.brand_campaigns?.title ?? (uiLang === "el" ? "Καμπάνια" : "Campaign")}{" "}
                      <span className="text-slate-500 font-normal">
                        · {m.brand_campaigns?.brands?.brand_name ?? ""}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDate(m.created_at, uiLang)} {formatTime(m.created_at, uiLang)} ·{" "}
                      <span className="font-medium">
                        {(applicationStatusUi[uiLang] as Record<string, string>)[m.status] || m.status}
                      </span>
                      {showDeliver && (
                        <>
                          {" · "}
                          <span className="font-medium text-slate-700">
                            {(deliverableStatusUi[uiLang] as Record<string, string>)[dStatus] || dStatus}
                          </span>
                        </>
                      )}
                    </p>
                    {m.deliverable_review_note && dStatus === "changes_requested" && (
                      <p className="text-xs text-amber-700 mt-1">{m.deliverable_review_note}</p>
                    )}
                  </div>
                  {m.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => setWithdrawId(m.id)}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-red-600 hover:underline self-start sm:self-center"
                    >
                      {uiLang === "el" ? "Απόσυρση" : "Withdraw"}
                    </button>
                  )}
                </div>
                {showDeliver && dStatus !== "approved" && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-700">
                      {uiLang === "el" ? "Παράδοση περιεχομένου" : "Submit deliverable"}
                    </p>
                    <input
                      type="url"
                      value={draft.url}
                      onChange={(e) =>
                        setDeliverDraft((prev) => ({
                          ...prev,
                          [m.id]: { ...draft, url: e.target.value },
                        }))
                      }
                      placeholder="https://…"
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                    />
                    <textarea
                      value={draft.note}
                      onChange={(e) =>
                        setDeliverDraft((prev) => ({
                          ...prev,
                          [m.id]: { ...draft, note: e.target.value },
                        }))
                      }
                      placeholder={uiLang === "el" ? "Σημείωση (προαιρετικό)" : "Note (optional)"}
                      rows={2}
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 resize-none"
                    />
                    <button
                      type="button"
                      disabled={deliverSaving === m.id}
                      onClick={() => submitDeliverable(m.id)}
                      className="inline-flex min-h-11 items-center text-sm px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {deliverSaving === m.id
                        ? "…"
                        : dStatus === "changes_requested"
                          ? uiLang === "el"
                            ? "Επανυποβολή"
                            : "Resubmit"
                          : uiLang === "el"
                            ? "Υποβολή παράδοσης"
                            : "Submit deliverable"}
                    </button>
                  </div>
                )}
                {dStatus === "approved" && m.deliverable_url && (
                  <a
                    href={m.deliverable_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-700 underline"
                  >
                    {m.deliverable_url}
                  </a>
                )}
              </li>
            );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
