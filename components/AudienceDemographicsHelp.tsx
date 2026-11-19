"use client";

type Props = {
  lang: "el" | "en";
  className?: string;
};

const COPY = {
  el: {
    title: "Πού τα βρίσκω;",
    switchTitle: "Αν έχεις προσωπικό λογαριασμό",
    igSwitch:
      "Instagram: Ρυθμίσεις → Τύπος λογαριασμού και εργαλεία → Μετάβαση σε επαγγελματικό λογαριασμό → Δημιουργός ή Επιχείρηση. Είναι δωρεάν.",
    igFind: "Μετά: Επαγγελματικός πίνακας → Insights → Κοινό (Audience).",
    ttSwitch:
      "TikTok: Ρυθμίσεις και απόρρητο → Λογαριασμός → Μετάβαση σε λογαριασμό Δημιουργού ή Επιχείρησης. Είναι δωρεάν.",
    ttFind: "Μετά: Εργαλεία δημιουργού / Επιχειρηματικά εργαλεία → Analytics → Θεατές ή Ακόλουθοι.",
    collect:
      "Τα στατιστικά αρχίζουν να μαζεύονται από τη στιγμή της μετάβασης. Τα παλαιότερα δεδομένα του προσωπικού λογαριασμού συνήθως δεν εμφανίζονται, και τα πρώτα νούμερα μπορεί να αργήσουν λίγο.",
    personal:
      "Αν θες να μείνεις σε προσωπικό λογαριασμό, επίλεξε «Δεν έχω πρόσβαση». Στο δημόσιο προφίλ τα στοιχεία κοινού θα φαίνονται ως «;».",
  },
  en: {
    title: "Where do I find this?",
    switchTitle: "If you have a personal account",
    igSwitch:
      "Instagram: Settings → Account type and tools → Switch to professional account → Creator or Business. It’s free.",
    igFind: "Then: Professional dashboard → Insights → Audience.",
    ttSwitch:
      "TikTok: Settings and privacy → Account → Switch to a Creator or Business account. It’s free.",
    ttFind: "Then: Creator tools / Business suite → Analytics → Viewers or Followers.",
    collect:
      "Stats start collecting from the moment you switch. Data from a personal account usually does not appear, and the first numbers may take a little time.",
    personal:
      "If you want to stay on a personal account, choose “I don’t have access”. Public profiles will show “?” for audience stats.",
  },
} as const;

export default function AudienceDemographicsHelp({ lang, className = "" }: Props) {
  const t = COPY[lang];
  return (
    <div className={`text-xs leading-relaxed text-slate-600 space-y-2 ${className}`.trim()}>
      <p className="font-semibold text-slate-700">{t.switchTitle}</p>
      <p>{t.igSwitch}</p>
      <p>{t.igFind}</p>
      <p>{t.ttSwitch}</p>
      <p>{t.ttFind}</p>
      <p>{t.collect}</p>
      <p>{t.personal}</p>
    </div>
  );
}

export function AudienceDemographicsHowTip({ lang }: { lang: "el" | "en" }) {
  const title = COPY[lang].title;
  return (
    <div>
      <p className="font-medium text-slate-700 mb-1">{title}</p>
      <AudienceDemographicsHelp lang={lang} />
    </div>
  );
}
