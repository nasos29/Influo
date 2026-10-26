"use client";

type Lang = "el" | "en";

const copy = {
  el: {
    title: "Πώς δουλεύει",
    subtitle: "Δύο απλά μονοπάτια — για brands και για influencers.",
    brands_title: "Για brands",
    influencers_title: "Για influencers",
    brands_steps: [
      "Ψάξε στον κατάλογο ή δημοσίευσε καμπάνια δωρεάν",
      "Δες αιτήσεις με τιμές και links",
      "Μίλα απευθείας με τον creator",
    ],
    influencers_steps: [
      "Φτιάξε προφίλ δωρεάν",
      "Εγκρίνεται και τα στατιστικά ελέγχονται από το Influo",
      "Κάνε αίτηση σε καμπάνιες και λάβε προτάσεις",
    ],
    guide: "Δες τον πλήρη οδηγό",
  },
  en: {
    title: "How it works",
    subtitle: "Two simple paths — for brands and for influencers.",
    brands_title: "For brands",
    influencers_title: "For influencers",
    brands_steps: [
      "Browse the directory or post a campaign for free",
      "Review applications with rates and links",
      "Message the creator directly",
    ],
    influencers_steps: [
      "Create a free profile",
      "Get approved — Influo checks your stats",
      "Apply to campaigns and receive proposals",
    ],
    guide: "See the full guide",
  },
} as const;

function StepList({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 items-start min-w-0">
          <span
            className="shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-semibold flex items-center justify-center"
            aria-hidden
          >
            {i + 1}
          </span>
          <span className="pt-1 text-slate-700 text-sm md:text-base leading-relaxed min-w-0">
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function HomeHowItWorks({ lang }: { lang: Lang }) {
  const txt = copy[lang];
  const brandsHref = lang === "en" ? "/en/for-brands" : "/for-brands";
  const influencersHref = lang === "en" ? "/en/for-influencers" : "/for-influencers";

  return (
    <section
      className="relative py-16 md:py-20 px-6 bg-white border-b border-slate-100 overflow-x-hidden"
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
    >
      <div className="max-w-6xl mx-auto w-full min-w-0">
        <div className="text-center mb-10 md:mb-14 max-w-2xl mx-auto">
          <h2
            id="how-it-works-heading"
            className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight"
          >
            {txt.title}
          </h2>
          <p className="mt-3 text-base md:text-lg text-slate-600">{txt.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-6 md:p-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-6 tracking-tight">
              {txt.brands_title}
            </h3>
            <StepList steps={txt.brands_steps} />
            <a
              href={brandsHref}
              className="inline-flex mt-8 text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline"
            >
              {txt.guide} →
            </a>
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-6 md:p-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-6 tracking-tight">
              {txt.influencers_title}
            </h3>
            <StepList steps={txt.influencers_steps} />
            <a
              href={influencersHref}
              className="inline-flex mt-8 text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline"
            >
              {txt.guide} →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
