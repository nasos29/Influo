"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

const CATEGORIES = [
  "",
  "Γενικά",
  "Lifestyle",
  "Fashion & Style",
  "Beauty & Makeup",
  "Travel",
  "Food & Drink",
  "Health & Fitness",
  "Tech & Gadgets",
  "Business & Finance",
  "Gaming & Esports",
  "Parenting & Family",
  "Home & Decor",
  "Pets & Animals",
  "Comedy & Entertainment",
  "Art & Photography",
  "Music & Dance",
  "Education & Coaching",
  "Sports & Athletes",
  "DIY & Crafts",
  "Sustainability & Eco",
  "Cars & Automotive",
];

export type BrandCampaignRow = {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  budget: number;
  category: string | null;
  deliverables: string | null;
  status: "draft" | "open" | "closed";
  deadline: string | null;
  created_at: string;
  updated_at: string;
};

type ApplicationRow = {
  id: string;
  campaign_id: string;
  influencer_id: string;
  message: string | null;
  status: string;
  created_at: string;
  influencers: { display_name: string; avatar_url: string | null } | null;
};

const txt = {
  el: {
    title: "Καμπάνιες",
    subtitle: "Δημοσιεύστε καμπάνια με τίτλο, περιγραφή και budget — οι influencers κάνουν αίτηση ενδιαφέροντος.",
    new: "Νέα καμπάνια",
    edit: "Επεξεργασία",
    save: "Αποθήκευση",
    cancel: "Ακύρωση",
    delete: "Διαγραφή",
    list_title: "Οι καμπάνιες σας",
    empty: "Δεν έχετε καμπάνια ακόμα. Δημιουργήστε μία για να λάβετε αιτήσεις από influencers.",
    form_title: "Τίτλος",
    form_desc: "Περιγραφή",
    form_budget: "Budget (€)",
    form_category: "Κατηγορία (προαιρετικό)",
    form_deliverables: "Παράδοση / deliverables (προαιρετικό)",
    form_deadline: "Προθεσμία (προαιρετικό)",
    form_status: "Κατάσταση",
    status_draft: "Πρόχειρο",
    status_open: "Ανοιχτή (δημόσια)",
    status_closed: "Κλειστή",
    applications: "Αιτήσεις",
    no_apps: "Καμία αίτηση ακόμα.",
    app_status: "Κατάσταση αίτησης",
    influencer: "Influencer",
    message: "Μήνυμα",
    open_public:
      "Μόνο επαληθευμένα brands μπορούν να δημοσιεύουν καμπάνιες. Οι «Ανοιχτές» καμπάνιες εμφανίζονται σε εγκεκριμένους influencers και στη δημόσια σελίδα (για verified brands).",
    verified_banner:
      "Η επιχείρησή σας δεν είναι ακόμη επαληθευμένη από την ομάδα μας. Μετά την επαλήθευση θα μπορείτε να δημιουργείτε και να επεξεργάζεστε καμπάνιες.",
    verified_modal_title: "Επαλήθευση απαιτείται",
    verified_modal_body:
      "Για να αναρτήσετε καμπάνιες, το brand σας πρέπει να είναι επαληθευμένο. Θα ενημερωθείτε όταν ολοκληρωθεί ο έλεγχος.",
    verified_modal_ok: "Κατάλαβα",
    table_missing:
      "Η λειτουργία καμπανιών δεν είναι ενεργή στη βάση. Εκτελέστε το αρχείο docs/BRAND_CAMPAIGNS_SCHEMA.sql στο Supabase.",
    confirm_delete: "Να διαγραφεί αυτή η καμπάνια και όλες οι αιτήσεις;",
  },
  en: {
    title: "Campaigns",
    subtitle: "Publish a campaign with title, description and budget — influencers can apply.",
    new: "New campaign",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    list_title: "Your campaigns",
    empty: "No campaigns yet. Create one to receive applications from influencers.",
    form_title: "Title",
    form_desc: "Description",
    form_budget: "Budget (€)",
    form_category: "Category (optional)",
    form_deliverables: "Deliverables (optional)",
    form_deadline: "Deadline (optional)",
    form_status: "Status",
    status_draft: "Draft",
    status_open: "Open (public)",
    status_closed: "Closed",
    applications: "Applications",
    no_apps: "No applications yet.",
    app_status: "Application status",
    influencer: "Influencer",
    message: "Message",
    open_public:
      "Only verified brands can publish campaigns. Open campaigns appear to approved influencers and on the public page (verified brands only).",
    verified_banner:
      "Your company is not verified yet. Once verified by our team, you can create and edit campaigns.",
    verified_modal_title: "Verification required",
    verified_modal_body:
      "To publish campaigns, your brand must be verified. We will notify you when the review is complete.",
    verified_modal_ok: "Got it",
    table_missing:
      "Campaigns are not enabled in the database. Run docs/BRAND_CAMPAIGNS_SCHEMA.sql in Supabase.",
    confirm_delete: "Delete this campaign and all applications?",
  },
};

export default function BrandCampaignsSection({
  brandId,
  lang,
  brandVerified,
}: {
  brandId: string;
  lang: "el" | "en";
  brandVerified: boolean;
}) {
  const t = txt[lang];
  const [dismissVerifiedModal, setDismissVerifiedModal] = useState(false);
  const showVerifiedModal = !brandVerified && !dismissVerifiedModal;
  const [rows, setRows] = useState<BrandCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaError, setSchemaError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [appsByCampaign, setAppsByCampaign] = useState<Record<string, ApplicationRow[]>>({});
  const [loadingApps, setLoadingApps] = useState<string | null>(null);

  const [editing, setEditing] = useState<BrandCampaignRow | "new" | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    budget: "",
    category: "",
    deliverables: "",
    deadline: "",
    status: "draft" as "draft" | "open" | "closed",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setSchemaError(false);
    const { data, error } = await supabase
      .from("brand_campaigns")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("brand_campaigns")) {
        setSchemaError(true);
      }
      console.error(error);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data as BrandCampaignRow[]) || []);
    setLoading(false);
  }, [brandId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadApplications = async (campaignId: string) => {
    setLoadingApps(campaignId);
    const { data, error } = await supabase
      .from("campaign_applications")
      .select(
        `
        id,
        campaign_id,
        influencer_id,
        message,
        status,
        created_at,
        influencers ( display_name, avatar_url )
      `
      )
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAppsByCampaign((prev) => ({ ...prev, [campaignId]: data as unknown as ApplicationRow[] }));
    }
    setLoadingApps(null);
  };

  const openNew = () => {
    if (!brandVerified) {
      setDismissVerifiedModal(false);
      return;
    }
    setForm({
      title: "",
      description: "",
      budget: "",
      category: "",
      deliverables: "",
      deadline: "",
      status: "draft",
    });
    setEditing("new");
  };

  const openEdit = (row: BrandCampaignRow) => {
    if (!brandVerified) {
      setDismissVerifiedModal(false);
      return;
    }
    setForm({
      title: row.title,
      description: row.description,
      budget: String(row.budget ?? ""),
      category: row.category || "",
      deliverables: row.deliverables || "",
      deadline: row.deadline ? row.deadline.slice(0, 10) : "",
      status: row.status,
    });
    setEditing(row);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandVerified) return;
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        budget: Math.max(0, parseFloat(form.budget) || 0),
        category: form.category || null,
        deliverables: form.deliverables.trim() || null,
        status: form.status,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (editing === "new") {
        const { error } = await supabase.from("brand_campaigns").insert({
          brand_id: brandId,
          ...payload,
        });
        if (error) throw error;
      } else if (editing !== null && "id" in editing) {
        const { error } = await supabase
          .from("brand_campaigns")
          .update(payload)
          .eq("id", editing.id)
          .eq("brand_id", brandId);
        if (error) throw error;
      }
      setEditing(null);
      await load();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: BrandCampaignRow) => {
    if (!confirm(t.confirm_delete)) return;
    const { error } = await supabase.from("brand_campaigns").delete().eq("id", row.id).eq("brand_id", brandId);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
    if (expandedId === row.id) setExpandedId(null);
  };

  const updateAppStatus = async (appId: string, status: string) => {
    const { error } = await supabase.from("campaign_applications").update({ status }).eq("id", appId);
    if (error) {
      alert(error.message);
      return;
    }
    if (expandedId) await loadApplications(expandedId);
  };

  if (schemaError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 text-sm">{t.table_missing}</div>
    );
  }

  return (
    <div className="space-y-6">
      {showVerifiedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200"
            role="dialog"
            aria-labelledby="verified-modal-title"
          >
            <h3 id="verified-modal-title" className="text-lg font-semibold text-slate-900">
              {t.verified_modal_title}
            </h3>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed">{t.verified_modal_body}</p>
            <button
              type="button"
              onClick={() => setDismissVerifiedModal(true)}
              className="mt-6 w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
            >
              {t.verified_modal_ok}
            </button>
          </div>
        </div>
      )}

      {!brandVerified && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">{t.verified_banner}</div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{t.title}</h2>
          <p className="text-slate-600 text-sm mt-1 max-w-2xl">{t.subtitle}</p>
          <p className="text-slate-500 text-xs mt-2">{t.open_public}</p>
          <Link
            href={lang === "en" ? "/en/campaigns" : "/campaigns"}
            className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {lang === "el" ? "→ Δημόσια προβολή καμπανιών" : "→ Public campaigns page"}
          </Link>
        </div>
        <button
          type="button"
          onClick={openNew}
          disabled={!brandVerified}
          className="shrink-0 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
        >
          {t.new}
        </button>
      </div>

      {editing && brandVerified && (
        <form
          onSubmit={submit}
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm"
        >
          <h3 className="font-semibold text-slate-900">{editing === "new" ? t.new : t.edit}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_title}</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_desc}</label>
              <textarea
                required
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_budget}</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_deadline}</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_category}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c || "none"} value={c}>
                    {c || (lang === "el" ? "—" : "—")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_status}</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as "draft" | "open" | "closed" })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
              >
                <option value="draft">{t.status_draft}</option>
                <option value="open">{t.status_open}</option>
                <option value="closed">{t.status_closed}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_deliverables}</label>
              <textarea
                rows={2}
                value={form.deliverables}
                onChange={(e) => setForm({ ...form, deliverables: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                placeholder={lang === "el" ? "π.χ. 2 Reels + 1 Story" : "e.g. 2 Reels + 1 Story"}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {t.save}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
            >
              {t.cancel}
            </button>
          </div>
        </form>
      )}

      <div>
        <h3 className="text-lg font-medium text-slate-900 mb-3">{t.list_title}</h3>
        {loading ? (
          <p className="text-slate-500 text-sm">{lang === "el" ? "Φόρτωση…" : "Loading…"}</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl p-8 text-center">{t.empty}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                <div className="p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{row.title}</h4>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          row.status === "open"
                            ? "bg-green-100 text-green-800"
                            : row.status === "closed"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {row.status === "open" ? t.status_open : row.status === "closed" ? t.status_closed : t.status_draft}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{row.description}</p>
                    <p className="text-sm text-slate-800 mt-2">
                      <strong>€{Number(row.budget).toLocaleString(lang === "el" ? "el-GR" : "en-GB")}</strong>
                      {row.category ? ` · ${row.category}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!brandVerified}
                      onClick={() => {
                        if (!brandVerified) return;
                        setExpandedId(expandedId === row.id ? null : row.id);
                        if (expandedId !== row.id) loadApplications(row.id);
                      }}
                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t.applications}
                    </button>
                    <button
                      type="button"
                      disabled={!brandVerified}
                      onClick={() => openEdit(row)}
                      className="text-sm px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t.edit}
                    </button>
                    <button
                      type="button"
                      disabled={!brandVerified}
                      onClick={() => remove(row)}
                      className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t.delete}
                    </button>
                  </div>
                </div>
                {expandedId === row.id && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4">
                    {loadingApps === row.id ? (
                      <p className="text-sm text-slate-500">…</p>
                    ) : (appsByCampaign[row.id]?.length ?? 0) === 0 ? (
                      <p className="text-sm text-slate-500">{t.no_apps}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-600 border-b border-slate-200">
                              <th className="pb-2 pr-4">{t.influencer}</th>
                              <th className="pb-2 pr-4">{t.message}</th>
                              <th className="pb-2">{t.app_status}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(appsByCampaign[row.id] || []).map((app) => (
                              <tr key={app.id} className="border-b border-slate-100 last:border-0">
                                <td className="py-2 pr-4 font-medium text-slate-900">
                                  {app.influencers?.display_name || app.influencer_id}
                                </td>
                                <td className="py-2 pr-4 text-slate-600 max-w-xs truncate">{app.message || "—"}</td>
                                <td className="py-2">
                                  <select
                                    value={app.status}
                                    onChange={(e) => updateAppStatus(app.id, e.target.value)}
                                    className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                                  >
                                    <option value="pending">pending</option>
                                    <option value="shortlisted">shortlisted</option>
                                    <option value="rejected">rejected</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
