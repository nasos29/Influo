"use client";

import { useMemo, useState } from "react";
import type { BrandShortlistItem } from "@/lib/brandShortlist";
import { publicProfilePath } from "@/lib/profileSlug";

type Props = {
  lang: "el" | "en";
  brandName: string;
  industry?: string | null;
  website?: string | null;
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

export default function BrandToolsPanel({
  lang,
  brandName,
  industry,
  website,
  shortlist,
  onOpenCampaigns,
  onOpenShortlist,
}: Props) {
  const el = lang === "el";
  const [units, setUnits] = useState(1);
  const [copied, setCopied] = useState<"brief" | "budget" | "">("");
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

  const priced = useMemo(() => {
    return shortlist.map((item) => {
      const rate = parseEuro(item.minRate);
      return { ...item, rate };
    });
  }, [shortlist]);

  const withRate = priced.filter((p) => p.rate != null) as Array<
    BrandShortlistItem & { rate: number }
  >;
  const withoutRate = priced.filter((p) => p.rate == null);

  const minTotal = useMemo(() => {
    const u = Math.max(1, Math.min(20, Math.round(units) || 1));
    return withRate.reduce((sum, p) => sum + p.rate * u, 0);
  }, [withRate, units]);

  const briefText = useMemo(() => {
    const lines = [
      el ? `Brief καμπάνιας — ${brandName || "Brand"}` : `Campaign brief — ${brandName || "Brand"}`,
      "",
      el ? `Brand: ${brandName || "—"}` : `Brand: ${brandName || "—"}`,
      industry ? (el ? `Κλάδος: ${industry}` : `Industry: ${industry}`) : null,
      website ? `Website: ${website}` : null,
      "",
      el ? `Στόχος: ${goal.trim() || "—"}` : `Goal: ${goal.trim() || "—"}`,
      el ? `Κοινό: ${audience.trim() || "—"}` : `Audience: ${audience.trim() || "—"}`,
      el ? `Deliverables: ${deliverables.trim() || "—"}` : `Deliverables: ${deliverables.trim() || "—"}`,
      el ? `Χρονοδιάγραμμα: ${timeline.trim() || "—"}` : `Timeline: ${timeline.trim() || "—"}`,
      budgetNote.trim()
        ? el
          ? `Budget: ${budgetNote.trim()}`
          : `Budget: ${budgetNote.trim()}`
        : withRate.length
          ? el
            ? `Εκτίμηση από shortlist (από): ${Math.round(minTotal)}€ (${withRate.length} creators × ${Math.max(1, units)} μονάδα/ες)`
            : `Shortlist estimate (from): ${Math.round(minTotal)}€ (${withRate.length} creators × ${Math.max(1, units)} unit(s))`
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
      "",
      el
        ? "Σημείωση: οι τιμές «από» είναι ενδεικτικές από τα προφίλ· επιβεβαιώστε με πρόταση ή αίτηση καμπάνιας."
        : "Note: “from” rates are indicative from profiles; confirm via proposal or campaign application.",
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
    units,
  ]);

  const copyText = async (text: string, kind: "brief" | "budget") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      /* ignore */
    }
  };

  const downloadCsv = () => {
    const header = el
      ? ["Όνομα", "Κατηγορία", "Ελάχ. τιμή (€)", "Σημείωση", "Προφίλ", "Εγκεκριμένος"]
      : ["Name", "Category", "Min rate (€)", "Note", "Profile", "Approved"];
    const rows = shortlist.map((s) => {
      const rate = parseEuro(s.minRate);
      const path = publicProfilePath(s.profileSlug, s.influencerId);
      return [
        s.displayName,
        s.category || "",
        rate != null ? String(rate) : "",
        s.note || "",
        `https://www.influo.gr${path}`,
        s.approved ? (el ? "ναι" : "yes") : el ? "όχι" : "no",
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

  const printSummary = () => {
    const w = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
    if (!w) return;
    const title = el ? "Influo — Shortlist & budget" : "Influo — Shortlist & budget";
    const rows = shortlist
      .map((s) => {
        const rate = parseEuro(s.minRate);
        return `<tr><td>${escapeHtml(s.displayName)}</td><td>${escapeHtml(s.category || "—")}</td><td>${
          rate != null ? rate + "€" : "—"
        }</td><td>${escapeHtml(s.note || "")}</td></tr>`;
      })
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:32px;color:#0f172a}
        h1{font-size:20px;margin:0 0 8px}
        p{color:#475569;font-size:14px}
        table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
        th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}
        th{background:#f8fafc}
        .sum{margin-top:20px;font-weight:600}
      </style></head><body>
      <h1>${escapeHtml(brandName || "Brand")} — ${el ? "σύνοψη" : "summary"}</h1>
      <p>${el ? "Εκτίμηση από shortlist (από)" : "Shortlist estimate (from)"}: ${Math.round(minTotal)}€
      · ${withRate.length}/${shortlist.length} ${el ? "με τιμή" : "with rate"}
      · ×${Math.max(1, units)} ${el ? "μονάδα/ες" : "unit(s)"}</p>
      <table><thead><tr><th>${el ? "Όνομα" : "Name"}</th><th>${el ? "Κατηγορία" : "Category"}</th><th>${
      el ? "Από" : "From"
    }</th><th>${el ? "Σημείωση" : "Note"}</th></tr></thead><tbody>${rows || `<tr><td colspan="4">${
      el ? "Κενή λίστα" : "Empty list"
    }</td></tr>`}</tbody></table>
      <p class="sum">${el ? "Εκτύπωση / αποθήκευση ως PDF από το παράθυρο εκτύπωσης." : "Print / save as PDF from the print dialog."}</p>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          {el ? "Εργαλεία brand" : "Brand tools"}
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          {el
            ? "Budget από τη shortlist, brief καμπάνιας και export — χωρίς να φύγετε από το Influo."
            : "Budget from your shortlist, a campaign brief, and export — without leaving Influo."}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Budget */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
            {el ? "Budget estimator" : "Budget estimator"}
          </h3>
          <p className="text-sm text-slate-600">
            {el
              ? "Άθροισμα των ελάχιστων τιμών («από») στη λίστα σας. Προαιρετικά × μονάδες deliverable ανά creator."
              : "Sum of “from” rates on your shortlist. Optionally × deliverable units per creator."}
          </p>

          {shortlist.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {el ? "Η shortlist είναι κενή." : "Your shortlist is empty."}{" "}
              <button type="button" onClick={onOpenShortlist} className="text-blue-600 font-medium hover:underline">
                {el ? "Προσθέστε creators" : "Add creators"}
              </button>
            </div>
          ) : (
            <>
              <label className="block text-sm text-slate-700">
                {el ? "Μονάδες ανά creator" : "Units per creator"}
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={units}
                  onChange={(e) => setUnits(Number(e.target.value) || 1)}
                  className="mt-1 w-full max-w-[8rem] px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </label>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                  {el ? "Εκτίμηση (από)" : "Estimate (from)"}
                </div>
                <div className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">
                  {withRate.length ? `${Math.round(minTotal).toLocaleString(el ? "el-GR" : "en-US")}€` : "—"}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {el
                    ? `${withRate.length} με τιμή · ${withoutRate.length} χωρίς τιμή`
                    : `${withRate.length} with rate · ${withoutRate.length} missing rate`}
                </p>
              </div>
              <ul className="max-h-40 overflow-y-auto text-sm space-y-1.5 border-t border-slate-100 pt-3">
                {priced.map((p) => (
                  <li key={p.influencerId} className="flex justify-between gap-2 text-slate-700">
                    <span className="truncate">{p.displayName}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {p.rate != null
                        ? el
                          ? `από ${p.rate}€`
                          : `from ${p.rate}€`
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  copyText(
                    el
                      ? `Εκτίμηση Influo shortlist: από ${Math.round(minTotal)}€ (${withRate.length} creators × ${Math.max(1, units)} μονάδες)`
                      : `Influo shortlist estimate: from ${Math.round(minTotal)}€ (${withRate.length} creators × ${Math.max(1, units)} units)`,
                    "budget"
                  )
                }
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
              >
                {copied === "budget" ? (el ? "Αντιγράφηκε" : "Copied") : el ? "Αντιγραφή σύνοψης" : "Copy summary"}
              </button>
            </>
          )}
        </section>

        {/* Export */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
            {el ? "Export shortlist" : "Export shortlist"}
          </h3>
          <p className="text-sm text-slate-600">
            {el
              ? "CSV για Excel / Sheets, ή εκτύπωση / αποθήκευση ως PDF."
              : "CSV for Excel / Sheets, or print / save as PDF."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!shortlist.length}
              onClick={downloadCsv}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              {el ? "Λήψη CSV" : "Download CSV"}
            </button>
            <button
              type="button"
              disabled={!shortlist.length}
              onClick={printSummary}
              className="px-4 py-2 border border-slate-300 text-slate-800 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              {el ? "Εκτύπωση / PDF" : "Print / PDF"}
            </button>
            <button
              type="button"
              onClick={onOpenShortlist}
              className="px-4 py-2 border border-slate-300 text-slate-800 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              {el ? "Άνοιγμα λίστας" : "Open list"}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {el
              ? `${shortlist.length} creators στη λίστα.`
              : `${shortlist.length} creators on the list.`}
          </p>
        </section>
      </div>

      {/* Brief */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              {el ? "Campaign brief" : "Campaign brief"}
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              {el
                ? "Συμπληρώστε και αντιγράψτε στο μήνυμα ή στην περιγραφή καμπάνιας."
                : "Fill in and copy into a message or campaign description."}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCampaigns}
            className="shrink-0 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {el ? "Νέα καμπάνια" : "New campaign"}
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm text-slate-700">
            {el ? "Στόχος" : "Goal"}
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
            />
          </label>
          <label className="block text-sm text-slate-700">
            {el ? "Κοινό" : "Audience"}
            <textarea
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Deliverables
            <textarea
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
            />
          </label>
          <label className="block text-sm text-slate-700">
            {el ? "Χρονοδιάγραμμα" : "Timeline"}
            <input
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
            />
          </label>
          <label className="block text-sm text-slate-700 sm:col-span-2">
            {el ? "Budget (προαιρετικό κείμενο)" : "Budget (optional note)"}
            <input
              value={budgetNote}
              onChange={(e) => setBudgetNote(e.target.value)}
              placeholder={el ? "π.χ. έως 2.000€ συνολικά" : "e.g. up to €2,000 total"}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
            />
          </label>
        </div>

        <textarea
          readOnly
          value={briefText}
          rows={12}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 text-sm font-mono"
        />
        <button
          type="button"
          onClick={() => copyText(briefText, "brief")}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
        >
          {copied === "brief" ? (el ? "Αντιγράφηκε" : "Copied") : el ? "Αντιγραφή brief" : "Copy brief"}
        </button>
      </section>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
