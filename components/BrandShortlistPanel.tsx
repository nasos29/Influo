"use client";

import { useState } from "react";
import Link from "next/link";
import { getCachedImageUrl } from "@/lib/imageProxy";
import { SHORTLIST_NOTE_MAX, type BrandShortlistItem } from "@/lib/brandShortlist";
import { publicProfilePath } from "@/lib/profileSlug";

type Props = {
  lang: "el" | "en";
  items: BrandShortlistItem[];
  missingTable?: boolean;
  onNoteSave: (influencerId: string, note: string) => Promise<void>;
  onRemove: (influencerId: string) => Promise<void>;
  onMessage: (influencerId: string, displayName: string) => void;
};

export default function BrandShortlistPanel({
  lang,
  items,
  missingTable,
  onNoteSave,
  onRemove,
  onMessage,
}: Props) {
  const el = lang === "el";
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  if (missingTable) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-slate-700">
        {el
          ? "Η λίστα δεν είναι έτοιμη ακόμα. Τρέξε το SQL ADD_BRAND_SHORTLIST στη Supabase."
          : "The shortlist is not ready yet. Run ADD_BRAND_SHORTLIST.sql in Supabase."}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          {el ? "Οι influencers μου" : "My influencers"}
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {el
            ? "Δεν έχετε αποθηκεύσει κάποιον ακόμα. Από τις προτάσεις ή ένα προφίλ πατήστε Αποθήκευση και προσθέστε σημείωση εδώ."
            : "You have not saved anyone yet. From recommendations or a profile, tap Save and add a note here."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-900">
          {el ? "Οι influencers μου" : "My influencers"}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {el
            ? "Ιδιωτική λίστα. Οι σημειώσεις φαίνονται μόνο σε εσάς."
            : "Private list. Notes are visible only to you."}
        </p>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const avatar = getCachedImageUrl(item.avatarUrl) || item.avatarUrl;
          const note = drafts[item.influencerId] ?? item.note;
          return (
            <article
              key={item.influencerId}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-4"
            >
              <div className="flex gap-3 min-w-0 flex-1">
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover bg-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-200 shrink-0 flex items-center justify-center font-bold text-slate-600">
                    {(item.displayName || "C").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{item.displayName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {item.category || "Creator"}
                    {item.minRate ? ` · από ${item.minRate}€` : ""}
                    {!item.approved ? (el ? " · μη εγκεκριμένος" : " · not approved") : ""}
                  </div>
                  <textarea
                    value={note}
                    maxLength={SHORTLIST_NOTE_MAX}
                    rows={2}
                    placeholder={el ? "Σημείωση, π.χ. μίλησα, θέλει 200€" : "Note, e.g. talked, wants €200"}
                    onChange={(e) => setDrafts((d) => ({ ...d, [item.influencerId]: e.target.value }))}
                    className="mt-2 w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 placeholder:text-slate-400"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      disabled={busyId === item.influencerId || note === item.note}
                      onClick={async () => {
                        setBusyId(item.influencerId);
                        try {
                          await onNoteSave(item.influencerId, note);
                          setDrafts((d) => {
                            const next = { ...d };
                            delete next[item.influencerId];
                            return next;
                          });
                          setSavedId(item.influencerId);
                          window.setTimeout(() => {
                            setSavedId((cur) => (cur === item.influencerId ? null : cur));
                          }, 2500);
                        } catch {
                          alert(el ? "Η σημείωση δεν αποθηκεύτηκε." : "The note was not saved.");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900 text-white disabled:opacity-40"
                    >
                      {busyId === item.influencerId
                        ? (el ? "Αποθήκευση…" : "Saving…")
                        : el ? "Αποθήκευση σημείωσης" : "Save note"}
                    </button>
                    {savedId === item.influencerId ? (
                      <span className="text-xs font-medium text-emerald-700 self-center">
                        {el ? "Αποθηκεύτηκε" : "Saved"}
                      </span>
                    ) : null}
                    <Link
                      href={publicProfilePath(item.profileSlug, item.influencerId)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800"
                    >
                      {el ? "Προφίλ" : "Profile"}
                    </Link>
                    <button
                      type="button"
                      onClick={() => onMessage(item.influencerId, item.displayName)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      {el ? "Μήνυμα" : "Message"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.influencerId}
                      onClick={async () => {
                        setBusyId(item.influencerId);
                        try {
                          await onRemove(item.influencerId);
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg text-red-700 hover:bg-red-50"
                    >
                      {el ? "Αφαίρεση" : "Remove"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
