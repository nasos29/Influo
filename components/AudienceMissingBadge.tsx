"use client";

import type { AudienceMissingKind } from "@/lib/audience";

export default function AudienceMissingBadge({
  kind,
  lang,
}: {
  kind: AudienceMissingKind | null;
  lang: "el" | "en";
}) {
  if (!kind) return null;
  if (kind === "no_access") {
    return (
      <span
        className="inline-flex max-w-full align-middle rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium leading-tight text-slate-700 whitespace-normal"
        title={lang === "el" ? "Προσωπικός λογαριασμός χωρίς πρόσβαση σε Insights" : "Personal account without Insights access"}
      >
        {lang === "el" ? "Χωρίς δημογραφικά (προσωπικός λογ.)" : "No demographics (personal acct.)"}
      </span>
    );
  }
  return (
    <span
      className="inline-flex max-w-full align-middle rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium leading-tight text-slate-500 ring-1 ring-inset ring-slate-200 whitespace-normal"
      title={lang === "el" ? "Τα στοιχεία κοινού δεν έχουν συμπληρωθεί" : "Audience demographics have not been filled in"}
    >
      {lang === "el" ? "Χωρίς δημογραφικά" : "No demographics"}
    </span>
  );
}
