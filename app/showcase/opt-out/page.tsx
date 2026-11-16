import Link from "next/link";
import { supabaseService } from "@/lib/apiAuth";
import { applyShowcaseOptOut } from "@/lib/applyShowcaseOptOut";
import { parseShowcaseOptOutToken } from "@/lib/showcaseOptOut";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "el" | "en";

const COPY = {
  el: {
    okTitle: "Εξαίρεση ολοκληρώθηκε",
    okBody:
      "Η συνεργασία δεν θα εμφανίζεται πλέον στις Πρόσφατες συνεργασίες για τη δική σας πλευρά. Μπορείτε να την ενεργοποιήσετε ξανά από το dashboard της συνεργασίας.",
    badTitle: "Μη έγκυρος σύνδεσμος",
    badBody: "Ο σύνδεσμος εξαίρεσης δεν είναι έγκυρος ή έχει λήξει.",
    missingTitle: "Δεν βρέθηκε",
    missingBody: "Η συνεργασία δεν βρέθηκε. Επικοινωνήστε στο support@influo.gr αν χρειάζεστε βοήθεια.",
    errTitle: "Σφάλμα",
    errBody: "Κάτι πήγε στραβά. Δοκιμάστε ξανά ή γράψτε στο support@influo.gr.",
    home: "Επιστροφή στο Influo",
    en: "English",
  },
  en: {
    okTitle: "Opt-out complete",
    okBody:
      "This collaboration will no longer appear in Recent collaborations for your side. You can turn it back on later from the collaboration page in your dashboard.",
    badTitle: "Invalid link",
    badBody: "This opt-out link is invalid or has expired.",
    missingTitle: "Not found",
    missingBody: "We could not find this collaboration. Contact support@influo.gr if you need help.",
    errTitle: "Something went wrong",
    errBody: "Please try again or email support@influo.gr.",
    home: "Back to Influo",
    en: "Ελληνικά",
  },
} as const;

function resolveLang(raw: string | string[] | undefined): Lang {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "en" ? "en" : "el";
}

export default async function ShowcaseOptOutPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const txt = COPY[lang];
  const altLang: Lang = lang === "el" ? "en" : "el";
  const token = String(params.t || "").trim();
  const parsed = parseShowcaseOptOutToken(token);

  let state: "ok" | "bad" | "missing" | "err" = "bad";
  if (parsed) {
    try {
      const result = await applyShowcaseOptOut(supabaseService(), parsed);
      if (result.ok) state = "ok";
      else if (result.reason === "not_found") state = "missing";
      else state = "err";
    } catch {
      state = "err";
    }
  }

  const title =
    state === "ok"
      ? txt.okTitle
      : state === "missing"
        ? txt.missingTitle
        : state === "err"
          ? txt.errTitle
          : txt.badTitle;
  const body =
    state === "ok"
      ? txt.okBody
      : state === "missing"
        ? txt.missingBody
        : state === "err"
          ? txt.errBody
          : txt.badBody;

  const homeHref = lang === "en" ? "/en" : "/";
  const switchHref = `/showcase/opt-out?t=${encodeURIComponent(token)}${
    altLang === "en" ? "&lang=en" : ""
  }`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 py-16 text-slate-900">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Influo</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-slate-600">{body}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={homeHref}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {txt.home}
          </Link>
          {token ? (
            <Link href={switchHref} className="text-sm text-slate-500 underline-offset-2 hover:underline">
              {txt.en}
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
