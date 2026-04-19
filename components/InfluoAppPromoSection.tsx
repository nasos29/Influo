"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { FaApple, FaGooglePlay } from "react-icons/fa";
import { buildAppInstallUrl, resolvePublicBaseUrl } from "@/lib/pwaAppUrl";

type Lang = "el" | "en";

/**
 * Hand + product handset — both read clearly as phones (promo-style). Swap URLs anytime.
 */
const PHONE_IMG_BACK =
  "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=520&h=960&q=85";
const PHONE_IMG_FRONT =
  "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=520&h=960&q=85";

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
    phoneAlt: "Κινητό με εφαρμογή",
  },
  en: {
    headline:
      "Influo on your phone — faster access to campaigns, messages, and profiles than on desktop.",
    sub: "Scan the QR or pick your platform to install the app (PWA) on your home screen — no Play Store or App Store required.",
    scan: "SCAN TO INSTALL THE APP",
    android: "For Android",
    ios: "For iPhone / iPad",
    phoneAlt: "Smartphone in hand",
  },
};

/** Slim device frame; object-contain keeps the full handset visible from the photo. */
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
  const rotate = tilt === "left" ? "-rotate-[8deg]" : "rotate-[8deg]";
  return (
    <div
      className={`relative shrink-0 rounded-[2.35rem] border-[6px] border-slate-900 bg-slate-950 p-1 shadow-2xl ring-1 ring-black/40 ${rotate} ${className ?? ""}`}
      style={{
        boxShadow: "0 24px 50px -12px rgba(0,0,0,0.55)",
        width: "clamp(84px, 17vw, 112px)",
        aspectRatio: "10 / 20",
      }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[1.85rem] bg-slate-950">
        <Image src={src} alt={alt} fill className="object-contain object-center" sizes="112px" />
      </div>
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
      className="relative w-full overflow-x-clip overflow-y-visible border-t border-slate-200 bg-white pb-0 pt-10 sm:pt-12 md:pt-14"
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

          {/* Flex: phones + copy grouped (tight gap), CTAs on the right — like reference band */}
          <div className="relative z-10 flex flex-col gap-5 px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5 md:flex-row md:items-start md:gap-3 md:px-5 md:pb-5 md:pt-4 lg:gap-4 lg:px-7 lg:pb-6 lg:pt-5">
            {/* Phones + headline: in-flow on mobile (no absolute overlap / clipping); row from md */}
            <div className="relative z-10 flex w-full flex-col items-center gap-4 md:max-w-[min(100%,52rem)] md:flex-1 md:flex-row md:items-start md:justify-start md:gap-3 lg:gap-4">
              <div className="relative flex w-full shrink-0 justify-center md:w-auto md:justify-start">
                <div className="relative z-10 flex items-end justify-center md:z-30 md:translate-y-[10%] lg:-translate-y-[6%]">
                  <div className="flex items-end">
                    <PhonePhoto src={PHONE_IMG_BACK} alt={t.phoneAlt} tilt="left" className="opacity-95" />
                    <PhonePhoto
                      src={PHONE_IMG_FRONT}
                      alt={t.phoneAlt}
                      tilt="right"
                      className="-ml-10 sm:-ml-11 md:-ml-12 lg:-ml-14"
                    />
                  </div>
                </div>
              </div>

              <div className="relative z-20 w-full min-w-0 flex-1 text-center md:z-10 md:pt-1 md:text-left">
                <h2
                  id="influo-app-heading"
                  className="text-lg font-bold leading-snug tracking-tight text-white sm:text-xl md:text-[1.15rem] md:leading-snug lg:text-xl xl:text-2xl"
                >
                  {t.headline}
                </h2>
                <p className="mt-1.5 text-[11px] leading-relaxed text-indigo-100/95 sm:text-xs md:mt-2 md:text-[13px] md:leading-relaxed lg:text-sm">
                  {t.sub}
                </p>
              </div>
            </div>

            <div className="relative z-10 flex w-full shrink-0 flex-col items-center gap-2.5 md:w-[200px] md:items-end md:gap-2.5 lg:w-[220px]">
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
