"use client";

type SignupType = "influencer" | "brand";

type Props = {
  lang: "el" | "en";
  value: SignupType;
  onChange: (value: SignupType) => void;
  influencerLabel: string;
  brandLabel: string;
};

export default function SignupTypeToggle({
  lang,
  value,
  onChange,
  influencerLabel,
  brandLabel,
}: Props) {
  const el = lang === "el";
  const label = el ? "Εγγραφή ως:" : "Sign up as:";
  const options: { id: SignupType; title: string; hint: string }[] = [
    {
      id: "influencer",
      title: influencerLabel,
      hint: el
        ? "Προφίλ creator και συνεργασίες με brands"
        : "Creator profile and brand collaborations",
    },
    {
      id: "brand",
      title: brandLabel,
      hint: el
        ? "Βρες influencers για την επιχείρησή σου"
        : "Find influencers for your business",
    },
  ];

  return (
    <div className="mb-3 rounded-2xl bg-slate-950/80 p-3 shadow-xl sm:mb-4 sm:p-4">
      <p id="signup-type-label" className="mb-2 text-sm font-bold text-white">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby="signup-type-label"
        className="grid grid-cols-2 gap-1 rounded-xl border-2 border-white bg-slate-950/40 p-1"
      >
        {options.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.id)}
              className={`flex min-h-16 flex-col items-center justify-center rounded-lg px-2 py-2 text-center transition-all sm:min-h-[4.75rem] sm:px-3 sm:py-2.5 ${
                selected
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                  : "bg-transparent text-white hover:bg-white/10"
              }`}
            >
              <span className="flex items-center justify-center gap-1 text-[13px] font-bold leading-tight sm:gap-1.5 sm:text-base">
                {selected ? (
                  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.2 7.2a1 1 0 0 1-1.4 0L3.3 9.1a1 1 0 1 1 1.4-1.4l4.1 4.1 6.5-6.5a1 1 0 0 1 1.4 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : null}
                <span>{opt.title}</span>
              </span>
              <span
                className={`mt-1 text-[11px] font-medium leading-snug sm:text-xs ${
                  selected ? "text-white" : "text-slate-200"
                }`}
              >
                {opt.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
