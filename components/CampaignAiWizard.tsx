"use client";

import { useState } from "react";
import { useBackGesture, useSessionState } from "@/lib/useFormPersistence";
import Link from "next/link";
import { sessionFetch } from "@/lib/sessionFetch";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { publicProfilePath } from "@/lib/profileSlug";

export type AiPrefill = {
  title: string;
  description: string;
  deliverables: string;
  category: string;
  platforms: string[];
  location: string;
  budget: string;
  slots: string;
  compensation_type: "money" | "product" | "both";
  starts_on: string;
  requires_presence: boolean;
};

export type SiteBrandInfo = { name: string | null; logo: string | null; colors: string[]; source?: string } | null;
type Pkg = { name: string; slots: number | null; deliverables: string; price: number | null };
type Match = { id: string; display_name: string; avatar_url: string | null; profile_slug: string | null; followers: number };

const GOALS = [
  ["awareness", "Αναγνωρισιμότητα brand"],
  ["launch", "Λανσάρισμα προϊόντος"],
  ["sales", "Πωλήσεις / κωδικός έκπτωσης"],
  ["traffic", "Επισκέψεις σε κατάστημα ή site"],
  ["ugc", "UGC βίντεο για τα κανάλια μας"],
  ["event", "Κάλυψη εκδήλωσης"],
] as const;
const PLATFORMS = [["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["facebook", "Facebook"]] as const;
const CONTENT = [["reel", "Reel"], ["story", "Stories"], ["post", "Post"], ["tiktok", "TikTok βίντεο"], ["youtube", "YouTube βίντεο"], ["ugc", "UGC (χωρίς δημοσίευση)"]] as const;

function addDays(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
}


/** A chosen package only pre-fills; everything stays editable in the form. */
function withPackage(r: { fill: AiPrefill; price: number | null; packages: Pkg[] }, idx: number | null): AiPrefill {
  const p = idx == null ? null : r.packages[idx];
  if (!p) return r.fill;
  const base = r.fill.description.replace(/\n\nΠροτεινόμενη αμοιβή ανά creator: \d+ €\.$/, "");
  return {
    ...r.fill,
    slots: p.slots ? String(p.slots) : r.fill.slots,
    deliverables: p.deliverables,
    description: p.price ? `${base}\n\nΠροτεινόμενη αμοιβή ανά creator: ${p.price} €.` : r.fill.description,
  };
}

const sel = "w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white";

/** Six short questions → one cheap AI call → editable prefill for the campaign form. */
export default function CampaignAiWizard({ onClose, onApply }: { onClose: () => void; onApply: (fill: AiPrefill, brand: SiteBrandInfo) => void }) {
  const [q, setQ] = useSessionState("influo:ai-wizard:q", 0);
  const [website, setWebsite] = useSessionState("influo:ai-wizard:website", "");
  const [siteGoal, setSiteGoal] = useSessionState("influo:ai-wizard:siteGoal", "");
  const [siteBrand, setSiteBrand] = useSessionState<SiteBrandInfo>("influo:ai-wizard:siteBrand", null);
  const [notice, setNotice] = useState<string | null>(null);
  const [goal, setGoal] = useSessionState("influo:ai-wizard:goal", "launch");
  const [category, setCategory] = useSessionState("influo:ai-wizard:category", "");
  const [product, setProduct] = useSessionState("influo:ai-wizard:product", "");
  const [age, setAge] = useSessionState("influo:ai-wizard:age", "all");
  const [gender, setGender] = useSessionState("influo:ai-wizard:gender", "all");
  const [inPerson, setInPerson] = useSessionState("influo:ai-wizard:inPerson", false);
  const [location, setLocation] = useSessionState("influo:ai-wizard:location", "");
  const [platforms, setPlatforms] = useSessionState<string[]>("influo:ai-wizard:platforms", ["instagram"]);
  const [content, setContent] = useSessionState<string[]>("influo:ai-wizard:content", ["reel"]);
  const [budget, setBudget] = useSessionState("influo:ai-wizard:budget", "");
  const [slots, setSlots] = useSessionState("influo:ai-wizard:slots", "3");
  const [timing, setTiming] = useSessionState("influo:ai-wizard:timing", "2weeks");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useSessionState<{ fill: AiPrefill; price: number | null; matches: Match[]; packages: Pkg[] } | null>("influo:ai-wizard:result", null);
  const [pkgIdx, setPkgIdx] = useSessionState<number | null>("influo:ai-wizard:pkgIdx", null);

  // Back gesture: previous question, or close (answers stay in sessionStorage).
  useBackGesture(true, () => {
    if (result) {
      setResult(null);
      return true;
    }
    if (q > 0) {
      setQ(q - 1);
      return true;
    }
    onClose();
    return false;
  });

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const check = (n: number): string | null => {
    if (n === 2 && !category) return "Επιλέξτε κατηγορία.";
    if (n === 3 && inPerson && !location.trim()) return "Γράψτε την περιοχή όπου χρειάζεται φυσική παρουσία.";
    if (n === 4 && !platforms.length) return "Επιλέξτε τουλάχιστον μία πλατφόρμα.";
    if (n === 5 && budget && !(Number(budget) >= 0)) return "Το budget πρέπει να είναι αριθμός.";
    return null;
  };

  const next = () => {
    const problem = check(q);
    setError(problem);
    if (!problem) setQ(q + 1);
  };

  const generate = async (fromSource = false) => {
    if (fromSource && !website.trim()) {
      setError("Γράψτε το website σας.");
      return;
    }
    if (fromSource && !siteGoal) {
      setError("Επιλέξτε τι θέλετε να πετύχετε.");
      return;
    }
    for (const n of fromSource ? [] : [2, 3, 4, 5]) {
      const problem = check(n);
      if (problem) {
        setError(problem);
        setQ(n);
        return;
      }
    }
    setError(null);
    setLoading(true);
    try {
      const res = await sessionFetch("/api/campaigns/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, category, product, age, gender, inPerson, location, platforms, content, budget: Number(budget) || 0, slots: Number(slots) || 0, timing, ...(fromSource ? { website: website.trim(), goal: siteGoal } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        draft?: { title: string; description: string; deliverables: string; slots: number | null; pricePerCreator: number | null; location: string; compensation: "money" | "product"; budget: number | null; timing: string; requiresPresence?: boolean; category?: string; platforms?: string[] };
        matches?: Match[];
        packages?: Pkg[];
        message?: { el?: string };
        needsDetails?: boolean;
        brand?: SiteBrandInfo;
      };
      if (data.brand) setSiteBrand(data.brand);
      if (data.needsDetails) {
        setNotice(data.message?.el || "Συμπληρώστε τις ερωτήσεις παρακάτω.");
        setQ(1);
        return;
      }
      if (!res.ok || !data.draft) {
        setError(data.message?.el || "Κάτι πήγε στραβά. Δοκιμάστε ξανά ή χρησιμοποιήστε τη φόρμα.");
        return;
      }
      const d = data.draft;
      setPkgIdx(null);
      const priceLine = d.pricePerCreator ? `\n\nΠροτεινόμενη αμοιβή ανά creator: ${d.pricePerCreator} €.` : "";
      const start = timing === "asap" ? addDays(2) : timing === "2weeks" ? addDays(14) : timing === "month" ? addDays(30) : addDays(7);
      setResult({
        price: d.pricePerCreator,
        matches: data.matches || [],
        packages: data.packages || [],
        fill: {
          title: d.title,
          description: `${d.description}${priceLine}`.trim(),
          deliverables: d.deliverables,
          category: d.category || category,
          platforms: d.platforms?.length ? d.platforms : platforms,
          location: inPerson ? location.trim() : "",
          budget: d.budget ? String(d.budget) : "",
          slots: d.slots ? String(d.slots) : "",
          compensation_type: d.compensation === "money" ? "money" : "product",
          starts_on: start,
          requires_presence: inPerson || d.requiresPresence === true,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="ai-wiz-title">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="ai-wiz-title" className="text-lg font-semibold text-slate-900">Δημιουργία καμπάνιας με AI</h3>
            <p className="text-xs text-slate-500 mt-0.5">{result ? "Ελέγξτε το προσχέδιο. Θα μπορείτε να το αλλάξετε πριν τη δημοσίευση." : q === 0 ? "Γρήγορη αρχή" : `Ερώτηση ${q}/6`}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm" aria-label="Κλείσιμο">✕</button>
        </div>

        {!result && (
          <div className="mt-4 space-y-3">
            {notice && q > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>}
            {q === 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-800">Δημιούργησε την καμπάνια σου από το website σου</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={website} maxLength={300} inputMode="url" onChange={(e) => setWebsite(e.target.value)} className={sel} placeholder="π.χ. mybrand.gr" aria-label="Website" />
                  <select value={siteGoal} onChange={(e) => { setSiteGoal(e.target.value); if (e.target.value) setGoal(e.target.value); }} className={sel} aria-label="Τι θέλεις να πετύχεις;" required>
                    <option value="">Τι θέλεις να πετύχεις;</option>
                    <option value="awareness">Αναγνωρισιμότητα</option>
                    <option value="sales">Πωλήσεις</option>
                    <option value="launch">Launch προϊόντος</option>
                    <option value="ugc">UGC βίντεο</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <p className="text-xs text-slate-500">Διαβάζουμε μόνο δημόσιες πληροφορίες (κείμενο, λογότυπο, χρώματα). Θα μπορείτε να αλλάξετε τα πάντα πριν τη δημοσίευση.</p>
              </div>
            )}
            {q === 1 && (
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">Ποιος είναι ο στόχος;</span>
                <select value={goal} onChange={(e) => setGoal(e.target.value)} className={sel}>
                  {GOALS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
            )}
            {q === 2 && (
              <>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Κατηγορία προϊόντος / υπηρεσίας</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={sel}>
                    <option value="">—</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c, "el")}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Τι προωθείτε; (προαιρετικό, σύντομα)</span>
                  <input value={product} maxLength={140} onChange={(e) => setProduct(e.target.value)} className={sel} placeholder="π.χ. νέα σειρά αντηλιακών" />
                </label>
              </>
            )}
            {q === 3 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-sm font-medium text-slate-700 mb-1">Ηλικία κοινού</span>
                    <select value={age} onChange={(e) => setAge(e.target.value)} className={sel}>
                      <option value="all">Όλες</option>
                      <option value="18-24">18–24</option>
                      <option value="25-34">25–34</option>
                      <option value="35-44">35–44</option>
                      <option value="45+">45+</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-sm font-medium text-slate-700 mb-1">Φύλο κοινού</span>
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className={sel}>
                      <option value="all">Όλοι</option>
                      <option value="women">Κυρίως γυναίκες</option>
                      <option value="men">Κυρίως άνδρες</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Χρειάζεται φυσική παρουσία;</span>
                  <select value={inPerson ? "yes" : "no"} onChange={(e) => setInPerson(e.target.value === "yes")} className={sel}>
                    <option value="no">Όχι, εξ αποστάσεως (Πανελλαδικά)</option>
                    <option value="yes">Ναι (κατάστημα, εκδήλωση κ.λπ.)</option>
                  </select>
                </label>
                {inPerson && (
                  <label className="block">
                    <span className="block text-sm font-medium text-slate-700 mb-1">Περιοχή</span>
                    <input value={location} maxLength={60} onChange={(e) => setLocation(e.target.value)} className={sel} placeholder="π.χ. Αθήνα" />
                  </label>
                )}
              </>
            )}
            {q === 4 && (
              <>
                <p className="text-sm font-medium text-slate-700">Πλατφόρμες</p>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(([id, label]) => (
                    <button key={id} type="button" onClick={() => toggle(platforms, setPlatforms, id)} className={`rounded-full border px-3 py-1.5 text-sm ${platforms.includes(id) ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-700"}`}>{label}</button>
                  ))}
                </div>
                <p className="text-sm font-medium text-slate-700 pt-1">Τύπος περιεχομένου</p>
                <div className="flex flex-wrap gap-2">
                  {CONTENT.map(([id, label]) => (
                    <button key={id} type="button" onClick={() => toggle(content, setContent, id)} className={`rounded-full border px-3 py-1.5 text-sm ${content.includes(id) ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-300 text-slate-700"}`}>{label}</button>
                  ))}
                </div>
              </>
            )}
            {q === 5 && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Συνολικό budget (€)</span>
                  <select value={budget} onChange={(e) => setBudget(e.target.value)} className={sel}>
                    <option value="">Μόνο προϊόν / ανταλλαγή</option>
                    {["150", "300", "500", "1000", "2000", "5000"].map((b) => <option key={b} value={b}>{`έως ${b} €`}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Πόσοι creators;</span>
                  <select value={slots} onChange={(e) => setSlots(e.target.value)} className={sel}>
                    <option value="">Χωρίς όριο</option>
                    {["1", "2", "3", "5", "10"].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
            )}
            {q === 6 && (
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">Πότε ξεκινά;</span>
                <select value={timing} onChange={(e) => setTiming(e.target.value)} className={sel}>
                  <option value="asap">Άμεσα</option>
                  <option value="2weeks">Σε περίπου 2 εβδομάδες</option>
                  <option value="month">Μέσα στον μήνα</option>
                  <option value="flexible">Ευέλικτα</option>
                </select>
              </label>
            )}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-2 pt-2">
              {q === 0 && (
                <>
                  <button type="button" onClick={() => { setError(null); setQ(1); }} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700">Με ερωτήσεις</button>
                  <button type="button" onClick={() => generate(true)} disabled={loading} className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60">{loading ? "Ανάλυση…" : "Δημιουργία"}</button>
                </>
              )}
              {q > 0 && <button type="button" onClick={() => { setError(null); setQ(q - 1); }} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700">Πίσω</button>}
              {q === 0 ? null : q < 6 ? (
                <button type="button" onClick={next} className="ml-auto px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium">Επόμενο</button>
              ) : (
                <button type="button" onClick={() => generate(false)} disabled={loading} className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60">{loading ? "Δημιουργία…" : "Δημιουργία προσχεδίου"}</button>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-4">
            {siteBrand && (siteBrand.logo || siteBrand.colors.length > 0) && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {siteBrand.logo && <img src={siteBrand.logo} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-lg border border-slate-200 bg-white object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                <div className="flex gap-1.5" aria-label="Χρώματα brand">
                  {siteBrand.colors.map((c) => <span key={c} className="h-5 w-5 rounded-full border border-slate-200" style={{ backgroundColor: c }} title={c} />)}
                </div>
                {siteBrand.name && <span className="truncate text-sm text-slate-600">{siteBrand.name}</span>}
              </div>
            )}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm" style={siteBrand?.colors[0] ? { borderTop: `4px solid ${siteBrand.colors[0]}` } : undefined}>
              <p className="font-semibold text-slate-900">{result.fill.title}</p>
              <p className="text-slate-700 whitespace-pre-line">{result.fill.description}</p>
              {result.fill.deliverables && <p className="text-slate-700"><span className="text-slate-500">Παραδοτέα:</span> {result.fill.deliverables}</p>}
              <p className="text-slate-700"><span className="text-slate-500">Θέσεις:</span> {result.fill.slots || "Χωρίς όριο"}</p>
              <p className="text-xs text-slate-500">Εικόνα καμπάνιας: την ανεβάζετε στο επόμενο βήμα («Επεξεργασία & δημοσίευση») και μπορείτε να την αλλάξετε όποτε θέλετε. Χωρίς εικόνα εμφανίζεται το λογότυπό σας.</p>
              {result.price ? <p className="text-slate-700"><span className="text-slate-500">Προτεινόμενη αμοιβή ανά creator:</span> {result.price} €</p> : null}
            </div>
            {result.packages.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Προτεινόμενα πακέτα <span className="font-normal text-slate-500">(προαιρετικά, όλα αλλάζουν μετά)</span></p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {result.packages.map((p, i) => (
                    <button key={i} type="button" aria-pressed={pkgIdx === i} onClick={() => setPkgIdx(pkgIdx === i ? null : i)} className={`text-left rounded-xl border p-3 text-sm transition ${pkgIdx === i ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 hover:border-slate-300"}`}>
                      <span className="block font-semibold text-slate-900">{p.name}</span>
                      <span className="block text-slate-600 mt-1">{p.deliverables}</span>
                      <span className="block text-slate-500 mt-1">{p.slots ? `${p.slots} θέσεις` : "Χωρίς όριο"}{p.price ? ` · ${p.price} € / creator` : ""}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {result.matches.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Creators που ταιριάζουν</p>
                <ul className="grid grid-cols-2 gap-2">
                  {result.matches.map((m) => (
                    <li key={m.id}>
                      <Link href={publicProfilePath(m.profile_slug, m.id)} target="_blank" className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {m.avatar_url ? <img src={m.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="h-8 w-8 rounded-full bg-slate-200" />}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">{m.display_name}</span>
                          {m.followers > 0 && <span className="block text-xs text-slate-500">{m.followers.toLocaleString("el-GR")} ακόλουθοι</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500 mt-1">Μετά τη δημοσίευση μπορείτε να τους στείλετε πρόσκληση.</p>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setResult(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700">Αλλαγή απαντήσεων</button>
              <button type="button" onClick={() => onApply(withPackage(result, pkgIdx), siteBrand)} className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">Επεξεργασία & δημοσίευση</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
