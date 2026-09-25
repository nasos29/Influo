"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { BrandShortlistItem } from "@/lib/brandShortlist";
import { publicProfilePath } from "@/lib/profileSlug";
import {
  defaultChecklist,
  loadChecklist,
  saveChecklist,
  loadRoi,
  saveRoi,
  loadSnippets,
  saveSnippets,
  loadToolOrder,
  saveToolOrder,
  defaultToolOrder,
  type BrandChecklistState,
  type BrandRoiEntry,
  type BrandSnippetsState,
  type ToolSectionId,
} from "@/lib/brandToolsStorage";

type Props = {
  lang: "el" | "en";
  brandId: string;
  brandName: string;
  industry?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  contactPerson?: string | null;
  shortlist: BrandShortlistItem[];
  onOpenCampaigns: () => void;
  onOpenShortlist: () => void;
};

function parseEuro(raw: string | null | undefined): number | null {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw.replace(/[€$%\s]/g, "").replace(",", ".");
  const m = cleaned.match(/(\d+(\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtFollowers(n: number | null | undefined): string {
  if (n == null || !(n > 0)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function slugify(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "campaign"
  );
}

const CHECKLIST_LABELS = {
  el: {
    brief: "Brief έτοιμο",
    budget: "Budget εγκριμένο",
    creators: "Creators επιλεγμένοι / shortlist",
    deliverables: "Deliverables ορισμένα",
    tracking: "UTM / tracking links",
    legal: "Όροι / συμφωνία OK",
  },
  en: {
    brief: "Brief ready",
    budget: "Budget approved",
    creators: "Creators selected / shortlist",
    deliverables: "Deliverables defined",
    tracking: "UTM / tracking links",
    legal: "Terms / agreement OK",
  },
} as const;

const SECTION_TITLES: Record<ToolSectionId, { el: string; en: string }> = {
  budget: { el: "Budget estimator", en: "Budget estimator" },
  export: { el: "Export shortlist", en: "Export shortlist" },
  compare: { el: "Σύγκριση creators", en: "Compare creators" },
  checklist: { el: "Campaign checklist", en: "Campaign checklist" },
  utm: { el: "UTM builder", en: "UTM builder" },
  brief: { el: "Campaign brief", en: "Campaign brief" },
  roi: { el: "ROI / αποτελέσματα", en: "ROI / results log" },
  kit: { el: "Brand kit", en: "Brand kit" },
  snippets: { el: "Έτοιμα μηνύματα", en: "Message snippets" },
};

function ToolCard({
  title,
  index,
  total,
  onMove,
  children,
}: {
  title: string;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">{title}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="w-8 h-8 rounded-md border border-slate-300 text-slate-800 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white text-sm font-bold"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={index >= total - 1}
            onClick={() => onMove(1)}
            className="w-8 h-8 rounded-md border border-slate-300 text-slate-800 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white text-sm font-bold"
          >
            ↓
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function BrandToolsPanel({
  lang,
  brandId,
  brandName,
  industry,
  website,
  logoUrl,
  contactPerson,
  shortlist,
  onOpenCampaigns,
  onOpenShortlist,
}: Props) {
  const el = lang === "el";
  const [units, setUnits] = useState(1);
  const [copied, setCopied] = useState("");
  const [order, setOrder] = useState<ToolSectionId[]>(defaultToolOrder);
  const [goal, setGoal] = useState(
    el ? "Αύξηση awareness / πωλήσεων για το νέο launch" : "Raise awareness / sales for the new launch"
  );
  const [deliverables, setDeliverables] = useState(
    el ? "1 Reel + 1 Story ανά creator" : "1 Reel + 1 Story per creator"
  );
  const [timeline, setTimeline] = useState(el ? "2–3 εβδομάδες" : "2–3 weeks");
  const [budgetNote, setBudgetNote] = useState("");
  const [audience, setAudience] = useState(
    el ? "Ελλάδα · 18–34 · ενδιαφέρον για το brand" : "Greece · 18–34 · brand-relevant interests"
  );

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<BrandChecklistState>(defaultChecklist);
  const [utmBase, setUtmBase] = useState(
    website?.startsWith("http") ? website : website ? `https://${website}` : "https://"
  );
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmCreator, setUtmCreator] = useState("");
  const [roi, setRoi] = useState<BrandRoiEntry[]>([]);
  const [roiName, setRoiName] = useState("");
  const [roiSpend, setRoiSpend] = useState("");
  const [roiResults, setRoiResults] = useState("");
  const [roiNotes, setRoiNotes] = useState("");
  const [snippets, setSnippets] = useState<BrandSnippetsState>(() => loadSnippets(brandId, el));
  const [kitDos, setKitDos] = useState(
    el
      ? "Χρησιμοποιήστε το λογότυπο σε καθαρό φόντο\nTag @brand στο caption"
      : "Use logo on a clean background\nTag @brand in the caption"
  );
  const [kitDonts, setKitDonts] = useState(
    el
      ? "Μην αλλάζετε τα χρώματα του λογοτύπου\nΜην κάνετε πολιτική τοποθέτηση"
      : "Do not alter logo colors\nNo political placement"
  );

  useEffect(() => {
    if (!brandId) return;
    setChecklist(loadChecklist(brandId));
    setRoi(loadRoi(brandId));
    setSnippets(loadSnippets(brandId, el));
    setOrder(loadToolOrder(brandId));
  }, [brandId, el]);

  useEffect(() => {
    if (website) {
      setUtmBase(website.startsWith("http") ? website : `https://${website}`);
    }
  }, [website]);

  const priced = useMemo(() => {
    return shortlist.map((item) => ({ ...item, rate: parseEuro(item.minRate) }));
  }, [shortlist]);

  const withRate = priced.filter((p) => p.rate != null) as Array<BrandShortlistItem & { rate: number }>;
  const withoutRate = priced.filter((p) => p.rate == null);

  const minTotal = useMemo(() => {
    const u = Math.max(1, Math.min(20, Math.round(units) || 1));
    return withRate.reduce((sum, p) => sum + p.rate * u, 0);
  }, [withRate, units]);

  const compareItems = useMemo(
    () => shortlist.filter((s) => compareIds.includes(s.influencerId)),
    [shortlist, compareIds]
  );

  const utmUrl = useMemo(() => {
    try {
      const u = new URL(utmBase.includes("://") ? utmBase : `https://${utmBase}`);
      u.searchParams.set("utm_source", "influo");
      u.searchParams.set("utm_medium", "influencer");
      u.searchParams.set("utm_campaign", slugify(utmCampaign || brandName || "campaign"));
      if (utmCreator.trim()) u.searchParams.set("utm_content", slugify(utmCreator));
      return u.toString();
    } catch {
      return "";
    }
  }, [utmBase, utmCampaign, utmCreator, brandName]);

  const briefText = useMemo(() => {
    const lines = [
      el ? `Brief καμπάνιας — ${brandName || "Brand"}` : `Campaign brief — ${brandName || "Brand"}`,
      "",
      `Brand: ${brandName || "—"}`,
      industry ? (el ? `Κλάδος: ${industry}` : `Industry: ${industry}`) : null,
      website ? `Website: ${website}` : null,
      "",
      el ? `Στόχος: ${goal.trim() || "—"}` : `Goal: ${goal.trim() || "—"}`,
      el ? `Κοινό: ${audience.trim() || "—"}` : `Audience: ${audience.trim() || "—"}`,
      `Deliverables: ${deliverables.trim() || "—"}`,
      el ? `Χρονοδιάγραμμα: ${timeline.trim() || "—"}` : `Timeline: ${timeline.trim() || "—"}`,
      budgetNote.trim()
        ? `Budget: ${budgetNote.trim()}`
        : withRate.length
          ? el
            ? `Εκτίμηση από shortlist (από): ${Math.round(minTotal)}€`
            : `Shortlist estimate (from): ${Math.round(minTotal)}€`
          : null,
      "",
      el ? "Creators στη λίστα:" : "Creators on shortlist:",
      ...(shortlist.length
        ? shortlist.map((s, i) => {
            const path = publicProfilePath(s.profileSlug, s.influencerId);
            const rate = parseEuro(s.minRate);
            const rateBit = rate != null ? ` · από ${rate}€` : "";
            return `${i + 1}. ${s.displayName}${rateBit} — https://www.influo.gr${path}`;
          })
        : [el ? "(κενή shortlist)" : "(empty shortlist)"]),
    ];
    return lines.filter((l) => l !== null).join("\n");
  }, [
    el,
    brandName,
    industry,
    website,
    goal,
    audience,
    deliverables,
    timeline,
    budgetNote,
    shortlist,
    withRate.length,
    minTotal,
  ]);

  const copyText = async (text: string, kind: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      /* ignore */
    }
  };

  const moveSection = (id: ToolSectionId, dir: -1 | 1) => {
    setOrder((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      if (brandId) saveToolOrder(brandId, next);
      return next;
    });
  };

  const resetOrder = () => {
    const next = defaultToolOrder();
    setOrder(next);
    if (brandId) saveToolOrder(brandId, next);
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const setCheck = (k: string, v: boolean) => {
    const next = { ...checklist, [k]: v };
    setChecklist(next);
    if (brandId) saveChecklist(brandId, next);
  };

  const addRoi = () => {
    const spend = parseFloat(roiSpend.replace(",", "."));
    if (!roiName.trim() || !Number.isFinite(spend)) return;
    const entry: BrandRoiEntry = {
      id: `${Date.now()}`,
      campaignName: roiName.trim(),
      spend,
      results: roiResults.trim(),
      notes: roiNotes.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...roi].slice(0, 50);
    setRoi(next);
    if (brandId) saveRoi(brandId, next);
    setRoiName("");
    setRoiSpend("");
    setRoiResults("");
    setRoiNotes("");
  };

  const removeRoi = (id: string) => {
    const next = roi.filter((r) => r.id !== id);
    setRoi(next);
    if (brandId) saveRoi(brandId, next);
  };

  const updateSnippet = (field: keyof BrandSnippetsState, value: string) => {
    const next = { ...snippets, [field]: value };
    setSnippets(next);
    if (brandId) saveSnippets(brandId, next);
  };

  const downloadCsv = () => {
    const header = el
      ? ["Όνομα", "Κατηγορία", "Followers", "ER %", "Ελάχ. τιμή", "Response h", "Completion %", "Σημείωση", "Προφίλ"]
      : ["Name", "Category", "Followers", "ER %", "Min rate", "Response h", "Completion %", "Note", "Profile"];
    const rows = shortlist.map((s) => {
      const rate = parseEuro(s.minRate);
      const path = publicProfilePath(s.profileSlug, s.influencerId);
      return [
        s.displayName,
        s.category || "",
        s.followers != null ? String(s.followers) : "",
        s.engagementRate != null ? String(s.engagementRate) : "",
        rate != null ? String(rate) : "",
        s.avgResponseTime != null ? String(s.avgResponseTime) : "",
        s.completionRate != null ? String(s.completionRate) : "",
        s.note || "",
        `https://www.influo.gr${path}`,
      ].map((c) => escapeCsv(c));
    });
    const csv = [header.map(escapeCsv).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `influo-shortlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(href);
  };

  const openPrintableHtml = (html: string) => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      const a = document.createElement("a");
      a.href = url;
      a.download = "influo-print.html";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      return;
    }
    const tryPrint = () => {
      try {
        w.focus();
        w.print();
      } catch {
        /* user can print manually */
      }
    };
    // Blob windows may already be loaded when we get the handle.
    if (w.document?.readyState === "complete") {
      setTimeout(tryPrint, 250);
    } else {
      w.addEventListener("load", () => setTimeout(tryPrint, 250));
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  };

  const printSummary = () => {
    const rows = shortlist
      .map((s) => {
        const rate = parseEuro(s.minRate);
        return `<tr><td>${escapeHtml(s.displayName)}</td><td>${escapeHtml(s.category || "—")}</td><td>${
          rate != null ? rate + "€" : "—"
        }</td><td>${escapeHtml(s.note || "")}</td></tr>`;
      })
      .join("");
    openPrintableHtml(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Influo shortlist</title>
      <style>body{font-family:system-ui,sans-serif;padding:32px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f8fafc}
      @media print{button{display:none}}</style></head><body>
      <h1>${escapeHtml(brandName || "Brand")}</h1>
      <p>${el ? "Εκτίμηση (από)" : "Estimate (from)"}: ${Math.round(minTotal)}€</p>
      <table><thead><tr><th>${el ? "Όνομα" : "Name"}</th><th>${el ? "Κατηγορία" : "Category"}</th><th>${el ? "Από" : "From"}</th><th>${el ? "Σημείωση" : "Note"}</th></tr></thead><tbody>${rows || `<tr><td colspan="4">${el ? "Κενή λίστα" : "Empty list"}</td></tr>`}</tbody></table>
      <p style="margin-top:24px"><button type="button" onclick="window.print()" style="padding:10px 16px;font-size:14px;cursor:pointer">${el ? "Εκτύπωση / PDF" : "Print / PDF"}</button></p>
      </body></html>`);
  };

  const printBrandKit = () => {
    const logoBlock =
      logoUrl && /^https?:\/\//i.test(logoUrl)
        ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="" crossorigin="anonymous" onerror="this.style.display='none'" />`
        : "";
    openPrintableHtml(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(brandName || "Brand")} kit</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a;max-width:720px;margin:0 auto;background:#fff}
        h1{font-size:28px;margin:0 0 8px}
        .meta{color:#334155;font-size:14px;margin-bottom:24px}
        .logo{max-height:64px;margin-bottom:16px;display:block}
        h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#334155;margin:24px 0 8px}
        pre{white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;font-size:13px;color:#0f172a}
        @media print{button{display:none}}
      </style></head><body>
      ${logoBlock}
      <h1>${escapeHtml(brandName || "Brand")}</h1>
      <div class="meta">${escapeHtml([industry, website, contactPerson].filter(Boolean).join(" · ") || "—")}</div>
      <h2>Do</h2><pre>${escapeHtml(kitDos)}</pre>
      <h2>Don&apos;t</h2><pre>${escapeHtml(kitDonts)}</pre>
      <p style="margin-top:24px"><button type="button" onclick="window.print()" style="padding:10px 16px;font-size:14px;cursor:pointer">${el ? "Εκτύπωση / PDF" : "Print / PDF"}</button></p>
      </body></html>`);
  };

  const labels = CHECKLIST_LABELS[el ? "el" : "en"];
  const checklistDone = Object.values(checklist).filter(Boolean).length;
  const checklistTotal = Object.keys(labels).length;
  const inputCls =
    "mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500";
  const hintCls = "text-sm text-slate-700";
  const mutedCls = "text-xs text-slate-600";

  const renderSection = (id: ToolSectionId, index: number) => {
    const title = SECTION_TITLES[id][el ? "el" : "en"];
    const wrap = (children: ReactNode) => (
      <ToolCard key={id} title={title} index={index} total={order.length} onMove={(dir) => moveSection(id, dir)}>
        {children}
      </ToolCard>
    );

    switch (id) {
      case "budget":
        return wrap(
          shortlist.length === 0 ? (
            <p className={hintCls}>
              {el ? "Κενή shortlist." : "Empty shortlist."}{" "}
              <button type="button" onClick={onOpenShortlist} className="text-blue-700 font-semibold hover:underline">
                {el ? "Προσθήκη" : "Add"}
              </button>
            </p>
          ) : (
            <>
              <label className="block text-sm font-medium text-slate-800">
                {el ? "Μονάδες ανά creator" : "Units per creator"}
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={units}
                  onChange={(e) => setUnits(Number(e.target.value) || 1)}
                  className="mt-1 w-28 px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </label>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-700 font-semibold">
                  {el ? "Εκτίμηση (από)" : "Estimate (from)"}
                </div>
                <div className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">
                  {withRate.length ? `${Math.round(minTotal).toLocaleString(el ? "el-GR" : "en-US")}€` : "—"}
                </div>
                <p className={`${mutedCls} mt-2`}>
                  {withRate.length} {el ? "με τιμή" : "with rate"} · {withoutRate.length}{" "}
                  {el ? "χωρίς" : "missing"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  copyText(
                    el ? `Εκτίμηση Influo: από ${Math.round(minTotal)}€` : `Influo estimate: from ${Math.round(minTotal)}€`,
                    "budget"
                  )
                }
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
              >
                {copied === "budget" ? (el ? "Αντιγράφηκε" : "Copied") : el ? "Αντιγραφή" : "Copy"}
              </button>
            </>
          )
        );

      case "export":
        return wrap(
          <>
            <p className={hintCls}>
              {el ? "CSV ή εκτύπωση / PDF." : "CSV or print / PDF."} {shortlist.length} creators.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!shortlist.length}
                onClick={downloadCsv}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
              >
                CSV
              </button>
              <button
                type="button"
                disabled={!shortlist.length}
                onClick={printSummary}
                className="px-4 py-2 border border-slate-300 text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
              >
                {el ? "Εκτύπωση / PDF" : "Print / PDF"}
              </button>
              <button
                type="button"
                onClick={onOpenShortlist}
                className="px-4 py-2 border border-slate-300 text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                {el ? "Λίστα" : "List"}
              </button>
            </div>
          </>
        );

      case "compare":
        return wrap(
          <>
            <p className={hintCls}>{el ? "Επιλέξτε έως 4 από τη shortlist." : "Select up to 4 from your shortlist."}</p>
            {shortlist.length === 0 ? (
              <p className="text-sm text-slate-700">{el ? "Δεν υπάρχουν creators στη λίστα." : "No creators on the list."}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {shortlist.map((s) => {
                    const on = compareIds.includes(s.influencerId);
                    return (
                      <button
                        key={s.influencerId}
                        type="button"
                        onClick={() => toggleCompare(s.influencerId)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          on
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-800 border-slate-300 hover:border-slate-400"
                        }`}
                      >
                        {s.displayName}
                      </button>
                    );
                  })}
                </div>
                {compareItems.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[480px]">
                      <thead>
                        <tr className="text-left text-slate-700 border-b border-slate-200">
                          <th className="py-2 pr-3 font-semibold">{el ? "Μετρική" : "Metric"}</th>
                          {compareItems.map((s) => (
                            <th key={s.influencerId} className="py-2 px-2 font-semibold text-slate-900">
                              {s.displayName}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="text-slate-800">
                        {(
                          [
                            [el ? "Κατηγορία" : "Category", (s: BrandShortlistItem) => s.category || "—"],
                            [el ? "Followers" : "Followers", (s: BrandShortlistItem) => fmtFollowers(s.followers)],
                            ["ER", (s: BrandShortlistItem) => (s.engagementRate != null ? `${s.engagementRate}%` : "—")],
                            [
                              el ? "Από (€)" : "From (€)",
                              (s: BrandShortlistItem) => {
                                const r = parseEuro(s.minRate);
                                return r != null ? `${r}` : "—";
                              },
                            ],
                            [
                              el ? "Απάντηση (h)" : "Response (h)",
                              (s: BrandShortlistItem) =>
                                s.avgResponseTime != null ? String(s.avgResponseTime) : "—",
                            ],
                            [
                              "Completion",
                              (s: BrandShortlistItem) =>
                                s.completionRate != null ? `${s.completionRate}%` : "—",
                            ],
                          ] as const
                        ).map(([label, fn]) => (
                          <tr key={String(label)} className="border-b border-slate-100">
                            <td className="py-2 pr-3 text-slate-700 font-medium">{label}</td>
                            {compareItems.map((s) => (
                              <td key={s.influencerId} className="py-2 px-2 tabular-nums text-slate-900">
                                {fn(s)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        );

      case "checklist":
        return wrap(
          <>
            <div className="flex items-center justify-between gap-2 -mt-1">
              <span className={`${mutedCls} tabular-nums`}>
                {checklistDone}/{checklistTotal}
              </span>
            </div>
            <ul className="space-y-2">
              {(Object.keys(labels) as Array<keyof typeof labels>).map((k) => (
                <li key={k}>
                  <label className="flex items-center gap-3 text-sm font-medium text-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!checklist[k]}
                      onChange={(e) => setCheck(k, e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    {labels[k]}
                  </label>
                </li>
              ))}
            </ul>
            <p className={mutedCls}>
              {el ? "Αποθηκεύεται σε αυτόν τον browser για το brand σας." : "Saved in this browser for your brand."}
            </p>
          </>
        );

      case "utm":
        return wrap(
          <>
            <label className="block text-sm font-medium text-slate-800">
              URL
              <input value={utmBase} onChange={(e) => setUtmBase(e.target.value)} className={inputCls} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm font-medium text-slate-800">
                Campaign
                <input
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  placeholder="spring_sale"
                  className={inputCls}
                />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                Creator
                <input
                  value={utmCreator}
                  onChange={(e) => setUtmCreator(e.target.value)}
                  placeholder="@username"
                  className={inputCls}
                />
              </label>
            </div>
            <input
              readOnly
              value={utmUrl}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-xs font-mono text-slate-900"
            />
            <button
              type="button"
              disabled={!utmUrl}
              onClick={() => copyText(utmUrl, "utm")}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-40"
            >
              {copied === "utm" ? (el ? "Αντιγράφηκε" : "Copied") : el ? "Αντιγραφή link" : "Copy link"}
            </button>
          </>
        );

      case "brief":
        return wrap(
          <>
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={onOpenCampaigns}
                className="px-4 py-2 border border-slate-300 text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                {el ? "Νέα καμπάνια" : "New campaign"}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-slate-800">
                {el ? "Στόχος" : "Goal"}
                <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} className={inputCls} />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                {el ? "Κοινό" : "Audience"}
                <textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={2} className={inputCls} />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                Deliverables
                <textarea
                  value={deliverables}
                  onChange={(e) => setDeliverables(e.target.value)}
                  rows={2}
                  className={inputCls}
                />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                {el ? "Χρονοδιάγραμμα" : "Timeline"}
                <input value={timeline} onChange={(e) => setTimeline(e.target.value)} className={inputCls} />
              </label>
              <label className="block text-sm font-medium text-slate-800 sm:col-span-2">
                Budget
                <input value={budgetNote} onChange={(e) => setBudgetNote(e.target.value)} className={inputCls} />
              </label>
            </div>
            <textarea
              readOnly
              value={briefText}
              rows={8}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm font-mono text-slate-900"
            />
            <button
              type="button"
              onClick={() => copyText(briefText, "brief")}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
            >
              {copied === "brief" ? (el ? "Αντιγράφηκε" : "Copied") : el ? "Αντιγραφή brief" : "Copy brief"}
            </button>
          </>
        );

      case "roi":
        return wrap(
          <>
            <p className={hintCls}>
              {el
                ? "Καταγράψτε spend και αποτελέσματα ανά καμπάνια (τοπικά σε αυτόν τον browser)."
                : "Log spend and results per campaign (stored in this browser)."}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                value={roiName}
                onChange={(e) => setRoiName(e.target.value)}
                placeholder={el ? "Όνομα καμπάνιας" : "Campaign name"}
                className={inputCls.replace("mt-1 ", "")}
              />
              <input
                value={roiSpend}
                onChange={(e) => setRoiSpend(e.target.value)}
                placeholder="Spend €"
                className={inputCls.replace("mt-1 ", "")}
              />
              <input
                value={roiResults}
                onChange={(e) => setRoiResults(e.target.value)}
                placeholder={el ? "Αποτελέσματα (clicks, sales…)" : "Results (clicks, sales…)"}
                className={`${inputCls.replace("mt-1 ", "")} sm:col-span-2`}
              />
              <input
                value={roiNotes}
                onChange={(e) => setRoiNotes(e.target.value)}
                placeholder={el ? "Σημειώσεις" : "Notes"}
                className={`${inputCls.replace("mt-1 ", "")} sm:col-span-2`}
              />
            </div>
            <button
              type="button"
              onClick={addRoi}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              {el ? "Προσθήκη" : "Add entry"}
            </button>
            {roi.length > 0 && (
              <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                {roi.map((r) => (
                  <li
                    key={r.id}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{r.campaignName}</div>
                      <div className="text-slate-700">
                        {r.spend.toLocaleString(el ? "el-GR" : "en-US")}€
                        {r.results ? ` · ${r.results}` : ""}
                        {r.notes ? ` · ${r.notes}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRoi(r.id)}
                      className="text-slate-700 hover:text-red-700 text-xs font-medium"
                    >
                      {el ? "Διαγραφή" : "Delete"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        );

      case "kit":
        return wrap(
          <>
            <p className={hintCls}>
              {el
                ? "Οδηγίες για influencers — εκτύπωση ή αποθήκευση ως PDF."
                : "Guidelines for influencers — print or save as PDF."}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-slate-800">
                Do
                <textarea value={kitDos} onChange={(e) => setKitDos(e.target.value)} rows={4} className={inputCls} />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                Don&apos;t
                <textarea value={kitDonts} onChange={(e) => setKitDonts(e.target.value)} rows={4} className={inputCls} />
              </label>
            </div>
            <button
              type="button"
              onClick={printBrandKit}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
            >
              {el ? "Εκτύπωση / PDF kit" : "Print / PDF kit"}
            </button>
          </>
        );

      case "snippets":
        return wrap(
          <>
            <p className={hintCls}>
              {el ? "Αντιγράψτε και επεξεργαστείτε πριν την αποστολή." : "Copy and edit before sending."}
            </p>
            {(
              [
                ["outreach", el ? "Πρώτη επαφή" : "Outreach"],
                ["negotiate", el ? "Διαπραγμάτευση" : "Negotiate"],
                ["reminder", el ? "Υπενθύμιση deliverable" : "Deliverable reminder"],
                ["approve", el ? "Έγκριση" : "Approval"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{label}</span>
                  <button
                    type="button"
                    onClick={() => copyText(snippets[key], `snip-${key}`)}
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    {copied === `snip-${key}` ? (el ? "Αντιγράφηκε" : "Copied") : el ? "Αντιγραφή" : "Copy"}
                  </button>
                </div>
                <textarea
                  value={snippets[key]}
                  onChange={(e) => updateSnippet(key, e.target.value)}
                  rows={3}
                  className={inputCls.replace("mt-1 ", "")}
                />
              </div>
            ))}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{el ? "Εργαλεία brand" : "Brand tools"}</h2>
          <p className="text-sm text-slate-700 mt-1">
            {el
              ? "Μετακινήστε τα εργαλεία με ↑ ↓ για να ορίσετε τη σειρά που σας βολεύει."
              : "Use ↑ ↓ to rearrange tools in the order you prefer."}
          </p>
        </div>
        <button
          type="button"
          onClick={resetOrder}
          className="text-sm font-medium text-slate-800 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 self-start"
        >
          {el ? "Επαναφορά σειράς" : "Reset order"}
        </button>
      </div>

      <div className="space-y-5">{order.map((id, index) => renderSection(id, index))}</div>
    </div>
  );
}
