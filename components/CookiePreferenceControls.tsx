"use client";

import { getCookieConsent, openCookieSettings, setCookieConsent } from "@/lib/cookieConsent";
import { useEffect, useState } from "react";

export default function CookiePreferenceControls({ lang }: { lang: "el" | "en" }) {
  const [choice, setChoice] = useState<"accepted" | "rejected" | null>(null);
  const el = lang === "el";

  useEffect(() => {
    setChoice(getCookieConsent());
  }, []);

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-700 mb-3">
        {el
          ? `Τρέχουσα επιλογή: ${choice === "accepted" ? "Αποδοχή" : choice === "rejected" ? "Απόρριψη" : "Δεν έχει οριστεί"}`
          : `Current choice: ${choice === "accepted" ? "Accepted" : choice === "rejected" ? "Rejected" : "Not set"}`}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setCookieConsent("accepted");
            setChoice("accepted");
          }}
          className="px-3 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white"
        >
          {el ? "Αποδοχή" : "Accept"}
        </button>
        <button
          type="button"
          onClick={() => {
            setCookieConsent("rejected");
            setChoice("rejected");
          }}
          className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-800"
        >
          {el ? "Απόρριψη" : "Reject"}
        </button>
        <button
          type="button"
          onClick={() => openCookieSettings()}
          className="px-3 py-2 text-sm font-medium rounded-lg text-blue-700 hover:bg-blue-50"
        >
          {el ? "Άνοιγμα banner" : "Open banner"}
        </button>
      </div>
    </div>
  );
}
