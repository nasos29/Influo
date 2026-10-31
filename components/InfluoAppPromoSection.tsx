"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buildAppInstallUrl, resolvePublicBaseUrl } from "@/lib/pwaAppUrl";
import { SECTION_TITLE_CLASS } from "@/lib/sectionTitle";

type Lang = "el" | "en";

const copy: Record<
  Lang,
  {
    headline: string;
    sub: string;
    bullets: [string, string, string];
    install: string;
    platforms: string;
    scan: string;
    campaignTitle: string;
    campaignBadge: string;
    notif: string;
  }
> = {
  el: {
    headline: "Το Influo στο κινητό σου",
    sub: "Καμπάνιες, μηνύματα και προφίλ — πάντα μαζί σου.",
    bullets: [
      "Ειδοποιήσεις για νέα μηνύματα & καμπάνιες",
      "Εγκατάσταση σε 10 δευτερόλεπτα",
      "Χωρίς App Store / Play Store",
    ],
    install: "Εγκατάσταση εφαρμογής",
    platforms: "Android & iPhone · δωρεάν",
    scan: "Σκάναρε με την κάμερα του κινητού",
    campaignTitle: "Summer Glow Campaign",
    campaignBadge: "5 αιτήσεις",
    notif: "Νέο μήνυμα από brand",
  },
  en: {
    headline: "Influo on your phone",
    sub: "Campaigns, messages and your profile — always with you.",
    bullets: [
      "Alerts for new messages & campaigns",
      "Install in 10 seconds",
      "No App Store / Play Store",
    ],
    install: "Install the app",
    platforms: "Android & iPhone · free",
    scan: "Scan with your phone camera",
    campaignTitle: "Summer Glow Campaign",
    campaignBadge: "5 applications",
    notif: "New message from a brand",
  },
};

function InfluoPhoneMockup({ lang, className }: { lang: Lang; className?: string }) {
  const t = copy[lang];
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[2.5rem] border-[5px] border-slate-950 bg-slate-950 shadow-2xl ring-1 ring-white/10 md:-rotate-6 ${className ?? ""}`}
      style={{ boxShadow: "0 28px 60px -16px rgba(0,0,0,0.55)" }}
      aria-hidden
    >
      {/* Notch */}
      <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />

      {/* Screen */}
      <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] bg-gradient-to-b from-slate-50 to-white">
        {/* Mini header */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 pb-2.5 pt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="h-5 w-auto" />
          <span className="text-[10px] font-semibold tracking-wide text-slate-500">Influo</span>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-3">
          {/* Campaign card */}
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <p className="text-[11px] font-bold leading-snug text-slate-900 line-clamp-2">
              {t.campaignTitle}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-semibold text-white">
                €1.200
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-semibold text-white">
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {t.campaignBadge}
              </span>
            </div>
          </div>

          {/* Notification */}
          <div className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/80 px-2.5 py-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
              B
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-indigo-950">{t.notif}</p>
              <p className="mt-0.5 text-[9px] text-indigo-700/80">
                {lang === "el" ? "Μόλις τώρα" : "Just now"}
              </p>
            </div>
          </div>

          {/* Soft filler rows */}
          <div className="mt-auto space-y-1.5 opacity-60">
            <div className="h-2 w-4/5 rounded bg-slate-200" />
            <div className="h-2 w-3/5 rounded bg-slate-200" />
            <div className="h-2 w-2/3 rounded bg-slate-200" />
          </div>
        </div>
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
    const origin = window.location.origin;
    const id = window.setTimeout(() => setBaseOrigin(origin), 0);
    return () => window.clearTimeout(id);
  }, []);

  const installUrl = useMemo(
    () => buildAppInstallUrl(baseOrigin, lang, "utm_source=footer_qr"),
    [baseOrigin, lang]
  );

  return (
    <section
      id="influo-app"
      className="relative w-full overflow-hidden border-t border-slate-800"
      aria-labelledby="influo-app-heading"
    >
      <div
        className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-800"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 60% at 85% 20%, rgba(99,102,241,0.28), transparent 55%), linear-gradient(to bottom right, #0f172a, #1e1b4b, #3730a3)",
        }}
      >
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-6 py-10 md:grid-cols-[1fr_auto_1fr] md:gap-12 md:px-10 md:py-12 lg:gap-16">
          {/* Phone — last on mobile, first on md+ */}
          <div className="order-2 flex justify-center md:order-1 md:justify-self-end">
            <InfluoPhoneMockup
              lang={lang}
              className="h-[320px] w-[160px] md:h-[440px] md:w-[220px]"
            />
          </div>

          {/* Copy + CTA */}
          <div className="order-1 w-full text-center md:order-2 md:max-w-md md:text-left lg:max-w-lg">
            <h2
              id="influo-app-heading"
              className={`${SECTION_TITLE_CLASS} mb-3 !text-white`}
            >
              {t.headline}
            </h2>
            <p className="text-sm text-indigo-100/90 sm:text-base">{t.sub}</p>

            <ul className="mt-5 inline-flex flex-col items-start gap-2 text-left text-sm text-indigo-50/95">
              {t.bullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-400" aria-hidden>
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-col items-center gap-1.5 md:items-start">
              <a
                href={installUrl}
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-indigo-50"
              >
                {t.install}
              </a>
              <p className="text-xs text-indigo-200/80">{t.platforms}</p>
            </div>
          </div>

          {/* QR — desktop only */}
          <div className="order-3 hidden shrink-0 flex-col items-center gap-2.5 md:flex md:justify-self-start">
            <div className="aspect-square shrink-0 rounded-xl bg-white p-2 shadow-lg">
              <QRCodeSVG
                value={installUrl}
                size={132}
                level="M"
                fgColor="#1e1b4b"
                bgColor="#ffffff"
                title={lang === "el" ? "QR για εγκατάσταση της εφαρμογής Influo" : "QR code to install the Influo app"}
                imageSettings={{
                  src: "/logo-icon.svg",
                  height: 28,
                  width: 28,
                  excavate: true,
                }}
              />
            </div>
            <p className="max-w-[140px] text-center text-xs font-medium leading-snug text-indigo-100/90">
              {t.scan}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
