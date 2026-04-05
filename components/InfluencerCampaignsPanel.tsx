"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

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

export default function InfluencerCampaignsPanel({
  influencerId,
  approved,
}: {
  influencerId: string;
  approved: boolean;
}) {
  const [campaigns, setCampaigns] = useState<CampaignWithBrand[]>([]);
  const [mine, setMine] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaError, setSchemaError] = useState(false);
  const [applyCampaign, setApplyCampaign] = useState<CampaignWithBrand | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    load();
  }, [load]);

  const submitApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyCampaign || !approved) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("campaign_applications").insert({
        campaign_id: applyCampaign.id,
        influencer_id: influencerId,
        message: applyMessage.trim() || null,
        status: "pending",
      });
      if (error) {
        if (error.code === "23505") {
          alert("Έχετε ήδη κάνει αίτηση σε αυτή την καμπάνια.");
        } else {
          alert(error.message);
        }
        return;
      }
      setApplyCampaign(null);
      setApplyMessage("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async (appId: string) => {
    if (!confirm("Απόσυρση αίτησης;")) return;
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
        Η λειτουργία καμπανιών δεν είναι ενεργή στη βάση. Ο διαχειριστής πρέπει να εκτελέσει το{" "}
        <code className="bg-amber-100 px-1 rounded">docs/BRAND_CAMPAIGNS_SCHEMA.sql</code> στο Supabase.
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-slate-700 text-sm">
        Μόλις εγκριθεί το προφίλ σας από την ομάδα μας, θα μπορείτε να κάνετε αίτηση σε ανοιχτές καμπάνιες brands.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-slate-600 text-sm">
          Δείτε ανοιχτές καμπάνιες από verified brands και δηλώστε ενδιαφέρον.{" "}
          <Link href="/campaigns" className="text-blue-600 hover:underline font-medium">
            Δημόσια λίστα καμπανιών
          </Link>
        </p>
      </div>

      {applyCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Αίτηση: {applyCampaign.title}</h3>
            <p className="text-sm text-slate-500 mb-4">{applyCampaign.brands?.brand_name}</p>
            <form onSubmit={submitApply} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Μήνυμα (προαιρετικό)</label>
                <textarea
                  rows={4}
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  placeholder="Γιατί ταιριάζετε σε αυτή την καμπάνια…"
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
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-50"
                >
                  Υποβολή αίτησης
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section>
        <h2 className="text-xl font-semibold text-slate-900 mb-3">Ανοιχτές καμπάνιες</h2>
        {loading ? (
          <p className="text-slate-500 text-sm">Φόρτωση…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl p-8 text-center">
            Δεν υπάρχουν ανοιχτές καμπάνιες αυτή τη στιγμή. Ελέγξτε ξανά αργότερα.
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
                          <strong>Παράδοση:</strong> {c.deliverables}
                        </p>
                      )}
                      <p className="text-sm font-medium text-slate-900 mt-2">
                        Budget: €{Number(c.budget).toLocaleString("el-GR")}
                        {c.category ? ` · ${c.category}` : ""}
                        {c.deadline
                          ? ` · Έως ${new Date(c.deadline).toLocaleDateString("el-GR")}`
                          : ""}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {already ? (
                        <span className="inline-block text-xs font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-800">
                          Έχετε ήδη αίτηση
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setApplyCampaign(c)}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                        >
                          Αίτηση ενδιαφέροντος
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
        <h2 className="text-xl font-semibold text-slate-900 mb-3">Οι αιτήσεις μου</h2>
        {mine.length === 0 ? (
          <p className="text-slate-500 text-sm">Δεν έχετε υποβάλει αίτηση ακόμα.</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((m) => (
              <li
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-slate-100 rounded-lg p-3 bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {m.brand_campaigns?.title ?? "Καμπάνια"}{" "}
                    <span className="text-slate-500 font-normal">
                      · {m.brand_campaigns?.brands?.brand_name ?? ""}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(m.created_at).toLocaleString("el-GR")} ·{" "}
                    <span className="font-medium">{m.status}</span>
                  </p>
                </div>
                {m.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => withdraw(m.id)}
                    className="text-sm text-red-600 hover:underline self-start sm:self-center"
                  >
                    Απόσυρση
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
