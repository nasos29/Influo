"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { FaApple, FaGooglePlay } from "react-icons/fa";
import { buildAppInstallUrl, resolvePublicBaseUrl } from "@/lib/pwaAppUrl";

type Lang = "el" | "en";

/** Stock photos — tall/narrow crop; swap URLs anytime. */
const PHONE_IMG_BACK =
  "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=420&h=920&q=80";
const PHONE_IMG_FRONT =
  "https://images.unsplash.com/photo-1556656793-08538906a9f8?auto=format&fit=crop&w=420&h=920&q=80";

const copy: Record<
  Lang,
  { headline: string; sub: string; scan: string; android: string; ios: string; phoneAlt: string }
> = {
  el: {
    headline:
      "Το Influo στο κινητό σου — πιο γρήγορη πρόσβαση σε καμπάνιες, μηνύματα και προφίλ από την επιτραπέζια εμπειρία.",
    sub: "Σκάναρε το QR ή επίλεξε την πλατφόρμα σου για να εγκαταστήσεις την εφαρμογή (PWA) στην αρχική οθόνη — χωρίς Play Store ή App Store.",
    scan: "ΣΚΑΝΑΡΕΤΕ ΓΙΑ ΝΑ ΕΓΚΑΤΑΣΤΗΣΕΤΕ ΤΟ APP",
    android: "Για Android",
    ios: "Για iPhone / iPad",
    phoneAlt: "Εφαρμογή Influo σε κινητό",
  },
  en: {
    headline:
      "Influo on your phone — faster access to campaigns, messages, and profiles than on desktop.",
    sub: "Scan the QR or pick your platform to install the app (PWA) on your home screen — no Play Store or App Store required.",
    scan: "SCAN TO INSTALL THE APP",
    android: "For Android",
    ios: "For iPhone / iPad",
    phoneAlt: "Influo app on a smartphone",
  },
};

/** Narrow portrait frame (~9:19) with photo inside — like slim handsets in promos. */
function PhonePhoto({
  src,
  alt,
  tilt,
  className,
}: {
  src: string;
  alt: string;
  tilt: "left" | "right";
  className?: string;
}) {
  const rotate = tilt === "left" ? "-rotate-[9deg]" : "rotate-[9deg]";
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[2rem] border-[5px] border-slate-900 bg-slate-900 shadow-2xl ring-1 ring-white/10 ${rotate} ${className ?? ""}`}
      style={{
        boxShadow: "0 22px 48px -10px rgba(0,0,0,0.55)",
        width: "clamp(72px, 16vw, 96px)",
        aspectRatio: "9 / 19.5",
      }}
    >
      <Image src={src} alt={alt} fill className="object-cover object-center" sizes="96px" />
    </div>
  );
}

export default function InfluoAppPromoSection({ lang }: { lang: Lang }) {
  const t = copy[lang];
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
      className="relative w-full overflow-x-hidden overflow-y-visible bg-white pb-0 pt-10 sm:pt-12 md:pt-14"
      aria-labelledby="influo-app-heading"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative isolate overflow-visible rounded-t-2xl shadow-xl ring-1 ring-slate-900/10 md:rounded-t-3xl">
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-2xl md:rounded-t-3xl"
            aria-hidden
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700" />
            <div className="absolute -right-12 top-0 h-44 w-44 rounded-full bg-white/15 blur-3xl md:-right-16 md:h-56 md:w-56" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-purple-400/25 blur-3xl md:h-48 md:w-48" />
          </div>

          <div className="relative z-10 grid items-center gap-4 px-4 pb-4 pt-4 sm:gap-5 sm:px-5 sm:pb-5 sm:pt-5 md:grid-cols-12 md:gap-6 md:px-6 md:pb-5 md:pt-4 lg:gap-8 lg:px-8 lg:pb-6 lg:pt-5">
            <div className="relative z-30 flex min-h-[9rem] justify-center md:col-span-4 md:min-h-[6rem] md:justify-start lg:min-h-0">
              <div className="absolute bottom-full left-1/2 z-30 flex -translate-x-1/2 translate-y-[18%] items-end sm:translate-y-[20%] md:left-4 md:translate-x-0 md:translate-y-[14%] lg:left-8 lg:translate-y-[10%]">
                <PhonePhoto src={PHONE_IMG_BACK} alt={t.phoneAlt} tilt="left" className="z-10 scale-[0.98] opacity-95" />
                <PhonePhoto
                  src={PHONE_IMG_FRONT}
                  alt={t.phoneAlt}
                  tilt="right"
                  className="-ml-11 z-20 scale-100 sm:-ml-12 md:-ml-14 lg:-ml-[3.75rem]"
                />
              </div>
            </div>

            <div className="relative z-10 text-center md:col-span-5 md:text-left">
              <h2
                id="influo-app-heading"
                className="text-lg font-bold leading-snug tracking-tight text-white sm:text-xl md:text-[1.2rem] md:leading-snug lg:text-2xl xl:text-[1.65rem]"
              >
                {t.headline}
              </h2>
              <p className="mt-1.5 text-[11px] leading-relaxed text-indigo-100/95 sm:text-xs md:mt-2 md:max-w-xl md:text-sm">
                {t.sub}
              </p>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2.5 md:col-span-3 md:items-end md:gap-2.5">
              <div className="flex w-full max-w-[260px] flex-col gap-1.5 md:max-w-none md:items-stretch">
                <a
                  href={installUrl}
                  className="flex items-center gap-2.5 rounded-xl border border-white/25 bg-black/20 px-3 py-2 text-white backdrop-blur-sm transition hover:bg-black/30"
                >
                  <FaGooglePlay className="h-6 w-6 shrink-0 text-white sm:h-7 sm:w-7" aria-hidden />
                  <div className="text-left leading-tight">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/80">
                      {lang === "el" ? "Εγκατάσταση" : "Install"}
                    </span>
                    <span className="text-sm font-bold">{t.android}</span>
                  </div>
                </a>
                <a
                  href={installUrl}
                  className="flex items-center gap-2.5 rounded-xl border border-white/25 bg-black/20 px-3 py-2 text-white backdrop-blur-sm transition hover:bg-black/30"
                >
                  <FaApple className="h-6 w-6 shrink-0 text-white sm:h-7 sm:w-7" aria-hidden />
                  <div className="text-left leading-tight">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/80">
                      {lang === "el" ? "Εγκατάσταση" : "Install"}
                    </span>
                    <span className="text-sm font-bold">{t.ios}</span>
                  </div>
                </a>
              </div>

              <div className="flex w-full max-w-[280px] flex-row items-center justify-center gap-2.5 md:max-w-none md:justify-end">
                <a
                  href={installUrl}
                  className="rounded-md border-[3px] border-white bg-white p-0.5 shadow-md transition hover:opacity-95"
                  aria-label={lang === "el" ? "Σύνδεσμος εγκατάστασης app" : "Install app link"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt="" width={96} height={96} className="h-[80px] w-[80px] sm:h-[88px] sm:w-[88px] md:h-[96px] md:w-[96px]" />
                </a>
                <p className="max-w-[108px] text-left text-[9px] font-bold uppercase leading-snug tracking-wide text-white sm:max-w-[118px] sm:text-[10px] md:max-w-[140px] md:text-xs">
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
