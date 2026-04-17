"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { FaApple, FaGooglePlay } from "react-icons/fa";
import { buildAppInstallUrl, resolvePublicBaseUrl } from "@/lib/pwaAppUrl";

type Lang = "el" | "en";

const copy: Record<
  Lang,
  { headline: string; sub: string; scan: string; android: string; ios: string }
> = {
  el: {
    headline:
      "Το Influo στο κινητό σου — πιο γρήγορη πρόσβαση σε καμπάνιες, μηνύματα και προφίλ από την επιτραπέζια εμπειρία.",
    sub: "Σκάναρε το QR ή επίλεξε την πλατφόρμα σου για να εγκαταστήσεις την εφαρμογή (PWA) στην αρχική οθόνη — χωρίς Play Store ή App Store.",
    scan: "ΣΚΑΝΑΡΕΤΕ ΓΙΑ ΝΑ ΕΓΚΑΤΑΣΤΗΣΕΤΕ ΤΟ APP",
    android: "Για Android",
    ios: "Για iPhone / iPad",
  },
  en: {
    headline:
      "Influo on your phone — faster access to campaigns, messages, and profiles than on desktop.",
    sub: "Scan the QR or pick your platform to install the app (PWA) on your home screen — no Play Store or App Store required.",
    scan: "SCAN TO INSTALL THE APP",
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
      className={`relative w-[128px] sm:w-[148px] md:w-[168px] shrink-0 rounded-[1.65rem] border-[5px] border-slate-800 bg-slate-900 shadow-2xl ${rotate} ${className ?? ""}`}
      style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.45)" }}
    >
      <div className="absolute top-2 left-1/2 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-800" aria-hidden />
      <div className="mt-6 mx-1.5 mb-2 rounded-lg overflow-hidden bg-gradient-to-br from-blue-600 to-purple-600 px-1.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <Image src="/logo-icon.svg" alt="" width={22} height={22} className="rounded-md bg-white/95 p-0.5" />
          <span className="text-[10px] font-bold text-white truncate">Influo</span>
        </div>
      </div>
      <div className="space-y-1 px-1.5 pb-3">
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
  const [baseOrigin, setBaseOrigin] = useState(resolvePublicBaseUrl);

  useEffect(() => {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return;
    setBaseOrigin(window.location.origin);
  }, []);

  const installUrl = useMemo(
    () => buildAppInstallUrl(baseOrigin, lang, "utm_source=footer_qr"),
    [baseOrigin, lang]
  );
  const qrSrc = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&color=312e81&bgcolor=ffffff&data=${encodeURIComponent(installUrl)}`,
    [installUrl]
  );

  return (
    <section
      id="influo-app"
      className="relative w-full overflow-x-hidden overflow-y-visible bg-transparent pb-0 pt-0"
      aria-labelledby="influo-app-heading"
    >
      {/* Padding lives INSIDE this box so the gradient covers the full height (no gray strip above). */}
      <div className="relative w-full overflow-visible shadow-lg ring-1 ring-white/10">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700" />
          <div className="absolute -right-16 top-0 h-52 w-52 rounded-full bg-white/15 blur-3xl md:-right-20 md:h-64 md:w-64" />
          <div className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-purple-400/25 blur-3xl md:-bottom-16 md:-left-16 md:h-56 md:w-56" />
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl items-end gap-5 px-4 pb-5 pt-16 sm:gap-6 sm:px-6 sm:pb-6 sm:pt-20 md:grid-cols-12 md:gap-6 md:px-8 md:pb-6 md:pt-[4.5rem] lg:gap-8 lg:pb-7 lg:pt-[5rem]">
          <div className="relative z-20 flex justify-center md:col-span-4 md:justify-start md:self-end">
            <div className="flex -translate-y-[42%] items-end justify-center sm:-translate-y-[46%] md:-translate-y-[50%] lg:-translate-y-[52%]">
              <PhoneMock tilt="left" className="z-10 scale-[0.96] opacity-95" rows={rows} />
              <PhoneMock tilt="right" className="-ml-9 z-20 scale-100 sm:-ml-10 md:-ml-11" rows={rows} />
            </div>
          </div>

          <div className="relative z-10 pb-0.5 text-center md:col-span-5 md:-mt-12 md:self-center md:text-left md:pb-0 lg:-mt-14">
            <h2
              id="influo-app-heading"
              className="text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl md:text-[1.35rem] md:leading-snug lg:text-2xl xl:text-3xl"
            >
              {t.headline}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-indigo-100/95 sm:text-sm md:mt-2 md:max-w-xl md:text-sm">
              {t.sub}
            </p>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-3 md:col-span-3 md:items-end md:self-center md:gap-3">
            <div className="flex w-full max-w-[260px] flex-col gap-2 md:max-w-none md:items-stretch">
              <a
                href={installUrl}
                className="flex items-center gap-2.5 rounded-xl border border-white/25 bg-black/20 px-3 py-2.5 text-white backdrop-blur-sm transition hover:bg-black/30"
              >
                <FaGooglePlay className="h-7 w-7 shrink-0 text-white sm:h-8 sm:w-8" aria-hidden />
                <div className="text-left leading-tight">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/80">
                    {lang === "el" ? "Εγκατάσταση" : "Install"}
                  </span>
                  <span className="text-sm font-bold">{t.android}</span>
                </div>
              </a>
              <a
                href={installUrl}
                className="flex items-center gap-2.5 rounded-xl border border-white/25 bg-black/20 px-3 py-2.5 text-white backdrop-blur-sm transition hover:bg-black/30"
              >
                <FaApple className="h-7 w-7 shrink-0 text-white sm:h-8 sm:w-8" aria-hidden />
                <div className="text-left leading-tight">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/80">
                    {lang === "el" ? "Εγκατάσταση" : "Install"}
                  </span>
                  <span className="text-sm font-bold">{t.ios}</span>
                </div>
              </a>
            </div>

            <div className="flex w-full max-w-[300px] flex-row items-center justify-center gap-3 md:max-w-none md:justify-end">
              <a
                href={installUrl}
                className="rounded-lg border-[3px] border-white bg-white p-1 shadow-lg transition hover:opacity-95"
                aria-label={lang === "el" ? "Σύνδεσμος εγκατάστασης app" : "Install app link"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="" width={104} height={104} className="h-[92px] w-[92px] sm:h-[100px] sm:w-[100px] md:h-[108px] md:w-[108px]" />
              </a>
              <p className="max-w-[120px] text-left text-[10px] font-bold uppercase leading-snug tracking-wide text-white sm:max-w-[130px] sm:text-xs md:max-w-[150px] md:text-sm">
                {t.scan}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
