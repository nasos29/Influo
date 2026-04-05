"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { getStoredLanguage } from "@/lib/language";

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
  },
  en: {
    pending: "Pending",
    shortlisted: "Shortlisted",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
  },
};

export default function InfluencerCampaignsPanel({
  influencerId,
  approved,
  onAttentionCountChange,
}: {
  influencerId: string;
  approved: boolean;
  /** Για badge στο tab «Καμπάνιες»: εκκρεμείς αιτήσεις + ανοιχτές καμπάνιες χωρίς αίτηση. */
  onAttentionCountChange?: (count: number) => void;
}) {
  const [uiLang, setUiLang] = useState<"el" | "en">("el");
  const [dismissApprovalModal, setDismissApprovalModal] = useState(false);
  const showApprovalModal = !approved && !dismissApprovalModal;
  const pc = pendingCopy[uiLang];

  const [campaigns, setCampaigns] = useState<CampaignWithBrand[]>([]);
  const [mine, setMine] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(!!approved);
  const [schemaError, setSchemaError] = useState(false);
  const [applyCampaign, setApplyCampaign] = useState<CampaignWithBrand | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

    const { data: openData, error: openErr } = await supabase
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
        brands ( brand_name, logo_url )
      `
      )
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (openErr) {
      if (openErr.code === "42P01" || openErr.message?.includes("brand_campaigns")) {
        setSchemaError(true);
      }
      console.error(openErr);
      setCampaigns([]);
    } else {
      setCampaigns((openData as unknown as CampaignWithBrand[]) || []);
    }

    const { data: myData, error: myErr } = await supabase
      .from("campaign_applications")
      .select(
        `
        id,
        campaign_id,
        status,
        message,
        created_at,
        brand_campaigns (
          title,
          status,
          brands ( brand_name )
        )
      `
      )
      .eq("influencer_id", influencerId)
      .order("created_at", { ascending: false });

    if (!myErr && myData) {
      setMine((myData as unknown) as MyApplication[]);
    }

    setLoading(false);
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

  useEffect(() => {
    if (!approved) {
      onAttentionCountChange?.(0);
      return;
    }
    const pendingMine = mine.filter((m) => m.status === "pending").length;
    const notAppliedCount = campaigns.filter((c) => !appliedCampaignIds.has(c.id)).length;
    onAttentionCountChange?.(pendingMine + notAppliedCount);
  }, [approved, campaigns, mine, appliedCampaignIds, onAttentionCountChange]);

  const submitApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyCampaign || !approved) return;
    setSubmitting(true);
    try {
      const { data: insertedApp, error } = await supabase
        .from("campaign_applications")
        .insert({
          campaign_id: applyCampaign.id,
          influencer_id: influencerId,
          message: applyMessage.trim() || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") {
          alert(uiLang === "el" ? "Έχετε ήδη κάνει αίτηση σε αυτή την καμπάνια." : "You have already applied to this campaign.");
        } else {
          alert(error.message);
        }
        return;
      }
      if (insertedApp?.id) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            await fetch("/api/push/campaign-application", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ applicationId: insertedApp.id }),
            });
          } catch (e) {
            console.error("[InfluencerCampaigns] campaign-application notify", e);
          }
        }
      }
      setApplyCampaign(null);
      setApplyMessage("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async (appId: string) => {
    if (!confirm(uiLang === "el" ? "Απόσυρση αίτησης;" : "Withdraw application?")) return;
    const { error } = await supabase
      .from("campaign_applications")
      .update({ status: "withdrawn" })
      .eq("id", appId)
      .eq("influencer_id", influencerId);
    if (error) alert(error.message);
    else await load();
  };

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
      <div className="relative">
        {showApprovalModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
            <div
              className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200"
              role="dialog"
              aria-labelledby="approval-modal-title"
            >
              <h3 id="approval-modal-title" className="text-lg font-semibold text-slate-900">
                {pc.modal_title}
              </h3>
              <p className="text-slate-600 text-sm mt-3 leading-relaxed">{pc.modal_body}</p>
              <button
                type="button"
                onClick={() => setDismissApprovalModal(true)}
                className="mt-6 w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
              >
                {pc.modal_ok}
              </button>
            </div>
          </div>
        )}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">{pc.banner}</div>
      </div>
    );
  }

  const campaignsLink = uiLang === "en" ? "/en/campaigns" : "/campaigns";

  return (
    <div className="space-y-8">
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {uiLang === "el" ? "Μήνυμα (προαιρετικό)" : "Message (optional)"}
                </label>
                <textarea
                  rows={4}
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  placeholder={
                    uiLang === "el"
                      ? "Γιατί ταιριάζετε σε αυτή την καμπάνια…"
                      : "Why you are a good fit…"
                  }
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setApplyCampaign(null);
                    setApplyMessage("");
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  {uiLang === "el" ? "Ακύρωση" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-50"
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
          <p className="text-slate-500 text-sm">{uiLang === "el" ? "Φόρτωση…" : "Loading…"}</p>
        ) : campaigns.length === 0 ? (
          <p className="text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl p-8 text-center">
            {uiLang === "el"
              ? "Δεν υπάρχουν ανοιχτές καμπάνιες αυτή τη στιγμή. Ελέγξτε ξανά αργότερα."
              : "No open campaigns right now. Check back later."}
          </p>
        ) : (
          <ul className="space-y-4">
            {campaigns.map((c) => {
              const already = appliedCampaignIds.has(c.id);
              return (
                <li key={c.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{c.title}</h3>
                      <p className="text-sm text-slate-600 mt-1">{c.brands?.brand_name ?? "Brand"}</p>
                      <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{c.description}</p>
                      {c.deliverables && (
                        <p className="text-xs text-slate-500 mt-2">
                          <strong>{uiLang === "el" ? "Παράδοση:" : "Deliverables:"}</strong> {c.deliverables}
                        </p>
                      )}
                      <p className="text-sm font-medium text-slate-900 mt-2">
                        Budget: €{Number(c.budget).toLocaleString(uiLang === "el" ? "el-GR" : "en-GB")}
                        {c.category ? ` · ${c.category}` : ""}
                        {c.deadline
                          ? ` · ${uiLang === "el" ? "Έως" : "Until"} ${new Date(c.deadline).toLocaleDateString(uiLang === "el" ? "el-GR" : "en-GB")}`
                          : ""}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {already ? (
                        <span className="inline-block text-xs font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-800">
                          {uiLang === "el" ? "Έχετε ήδη αίτηση" : "Already applied"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setApplyCampaign(c)}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                        >
                          {uiLang === "el" ? "Αίτηση ενδιαφέροντος" : "Apply"}
                        </button>
                      )}
                    </div>
                  </div>
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
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
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
            {mine.map((m) => (
              <li
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-slate-100 rounded-lg p-3 bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {m.brand_campaigns?.title ?? (uiLang === "el" ? "Καμπάνια" : "Campaign")}{" "}
                    <span className="text-slate-500 font-normal">
                      · {m.brand_campaigns?.brands?.brand_name ?? ""}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(m.created_at).toLocaleString(uiLang === "el" ? "el-GR" : "en-GB")} ·{" "}
                    <span className="font-medium">
                      {(applicationStatusUi[uiLang] as Record<string, string>)[m.status] || m.status}
                    </span>
                  </p>
                </div>
                {m.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => withdraw(m.id)}
                    className="text-sm text-red-600 hover:underline self-start sm:self-center"
                  >
                    {uiLang === "el" ? "Απόσυρση" : "Withdraw"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
