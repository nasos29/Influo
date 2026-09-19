"use client";

type Props = {
  saved: boolean;
  busy?: boolean;
  lang: "el" | "en";
  onToggle: () => void;
  variant?: "card" | "profile";
};

export default function BrandSaveInfluencerButton({
  saved,
  busy,
  lang,
  onToggle,
  variant = "card",
}: Props) {
  const el = lang === "el";
  const label = saved
    ? el ? "Αποθηκευμένος" : "Saved"
    : el ? "Αποθήκευση" : "Save";

  if (variant === "profile") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onToggle}
        className={`font-semibold py-2.5 px-3 rounded-lg text-sm flex items-center justify-center gap-1.5 disabled:opacity-60 ${
          saved
            ? "bg-amber-500 hover:bg-amber-600 text-white"
            : "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300"
        }`}
      >
        {saved ? "★" : "☆"} {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onToggle}
      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-60 ${
        saved
          ? "text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100"
          : "text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
      }`}
    >
      {saved ? "★" : "☆"} {label}
    </button>
  );
}
