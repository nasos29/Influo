"use client";

import Image from "next/image";
import { FaApple, FaGooglePlay } from "react-icons/fa";

type Lang = "el" | "en";

const SITE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
    : "https://influo.gr";

const copy: Record<
  Lang,
  { headline: string; sub: string; scan: string; android: string; ios: string }
> = {
  el: {
    headline:
      "Το Influo στο κινητό σου — πιο γρήγορη πρόσβαση σε καμπάνιες, μηνύματα και προφίλ από την επιτραπέζια εμπειρία.",
    sub: "Πρόσθεσέ το στην αρχική οθόνη για εμπειρία σαν εφαρμογή. Λειτουργεί από Chrome (Android) και Safari (iPhone) — χωρίς Play Store ή App Store.",
    scan: "ΣΚΑΝΑΡΕΤΕ ΓΙΑ ΝΑ ΑΝΟΙΞΕΤΕ ΤΟ INFLUO",
    android: "Για Android",
    ios: "Για iPhone / iPad",
  },
  en: {
    headline:
      "Influo on your phone — faster access to campaigns, messages, and profiles than on desktop.",
    sub: "Add it to your home screen for an app-like experience. Works in Chrome (Android) and Safari (iOS) — no Play Store or App Store required.",
    scan: "SCAN TO OPEN INFLUO",
    android: "For Android",
    ios: "For iPhone / iPad",
  },
};

function PhoneMock({
  className,
  tilt,
  rows,
}: {
  className?: string;
  tilt?: "left" | "right";
  rows: [string, string, string];
}) {
  const rotate = tilt === "left" ? "-rotate-6" : "rotate-6";
  return (
    <div
      className={`relative w-[140px] sm:w-[160px] md:w-[180px] shrink-0 rounded-[1.75rem] border-[6px] border-slate-800 bg-slate-900 shadow-2xl ${rotate} ${className ?? ""}`}
      style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.45)" }}
    >
      <div className="absolute top-2 left-1/2 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-800" aria-hidden />
      <div className="mt-8 mx-2 mb-3 rounded-xl overflow-hidden bg-gradient-to-br from-blue-600 to-purple-600 px-2 py-2">
        <div className="flex items-center gap-1.5">
          <Image src="/logo-icon.svg" alt="" width={22} height={22} className="rounded-md bg-white/95 p-0.5" />
          <span className="text-[10px] font-bold text-white truncate">Influo</span>
        </div>
      </div>
      <div className="space-y-1.5 px-2 pb-4">
        {rows.map((label, i) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-lg bg-white/95 px-2 py-1.5 text-[9px] font-medium text-slate-700 shadow-sm"
          >
            <span
              className={`h-6 w-6 shrink-0 rounded-md ${i === 0 ? "bg-violet-200" : i === 1 ? "bg-blue-200" : "bg-emerald-200"}`}
            />
            <span className="truncate">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const phoneRows: Record<Lang, [string, string, string]> = {
  el: ["Καμπάνιες", "Κατάλογος", "Μηνύματα"],
  en: ["Campaigns", "Directory", "Messages"],
};

export default function InfluoAppPromoSection({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const rows = phoneRows[lang];
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&color=312e81&bgcolor=ffffff&data=${encodeURIComponent(SITE)}`;

  return (
    <section
      id="influo-app"
      className="relative overflow-visible bg-slate-50 pt-8 pb-16 md:pt-12 md:pb-20"
      aria-labelledby="influo-app-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-visible rounded-2xl md:rounded-3xl shadow-xl ring-1 ring-white/10">
          <div className="absolute inset-0 overflow-hidden rounded-2xl md:rounded-3xl" aria-hidden>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700" />
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-purple-400/20 blur-3xl" />
          </div>

          <div className="relative grid gap-10 px-6 py-12 md:grid-cols-12 md:gap-8 md:px-10 md:py-14 lg:items-center">
            {/* Phones — overlap upward like reference */}
            <div className="relative z-10 flex justify-center md:col-span-4 md:justify-start lg:-mt-16 lg:mb-4">
              <div className="flex items-end justify-center gap-0 pl-2 pr-6 sm:pl-4">
                <PhoneMock tilt="left" className="z-10 scale-95 opacity-95" rows={rows} />
                <PhoneMock tilt="right" className="-ml-10 z-20 scale-100" rows={rows} />
              </div>
            </div>

            <div className="relative z-10 text-center md:col-span-5 md:text-left">
              <h2
                id="influo-app-heading"
                className="text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl md:text-[1.65rem] md:leading-tight lg:text-3xl xl:text-4xl"
              >
                {t.headline}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-indigo-100/95 sm:text-base md:max-w-xl">
                {t.sub}
              </p>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-5 md:col-span-3 md:items-end">
              <div className="flex w-full max-w-[280px] flex-col gap-3 md:max-w-none md:items-stretch">
                <a
                  href={SITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-white/25 bg-black/20 px-4 py-3 text-white backdrop-blur-sm transition hover:bg-black/30"
                >
                  <FaGooglePlay className="h-8 w-8 shrink-0 text-white" aria-hidden />
                  <div className="text-left leading-tight">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/80">
                      {lang === "el" ? "Άνοιγμα στο" : "Open in"}
                    </span>
                    <span className="text-sm font-bold">{t.android}</span>
                  </div>
                </a>
                <a
                  href={SITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-white/25 bg-black/20 px-4 py-3 text-white backdrop-blur-sm transition hover:bg-black/30"
                >
                  <FaApple className="h-8 w-8 shrink-0 text-white" aria-hidden />
                  <div className="text-left leading-tight">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/80">
                      {lang === "el" ? "Άνοιγμα στο" : "Open in"}
                    </span>
                    <span className="text-sm font-bold">{t.ios}</span>
                  </div>
                </a>
              </div>

              <div className="flex w-full max-w-[320px] flex-row items-center justify-center gap-4 md:max-w-none md:justify-end">
                <div className="rounded-xl border-4 border-white bg-white p-1.5 shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt="" width={120} height={120} className="h-[120px] w-[120px] md:h-[132px] md:w-[132px]" />
                </div>
                <p className="max-w-[140px] text-left text-xs font-bold uppercase leading-snug tracking-wide text-white md:max-w-[160px] md:text-sm">
                  {t.scan}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
