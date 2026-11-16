import Link from "next/link";
import ShowcaseAddPostForm from "@/components/ShowcaseAddPostForm";
import { parseShowcaseAddPostToken } from "@/lib/showcaseAddPost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "el" | "en";

const COPY = {
  el: {
    eyebrow: "Influo",
    title: "Πρόσθεσε το link της ανάρτησης",
    home: "Επιστροφή στο Influo",
    en: "English",
  },
  en: {
    eyebrow: "Influo",
    title: "Add the post link",
    home: "Back to Influo",
    en: "Ελληνικά",
  },
} as const;

function resolveLang(raw: string | string[] | undefined): Lang {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "en" ? "en" : "el";
}

export default async function ShowcaseAddPostPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const txt = COPY[lang];
  const altLang: Lang = lang === "el" ? "en" : "el";
  const token = String(params.t || "").trim();
  const parsed = parseShowcaseAddPostToken(token);
  const homeHref = lang === "en" ? "/en" : "/";
  const switchHref = `/showcase/add-post?t=${encodeURIComponent(token)}${
    altLang === "en" ? "&lang=en" : ""
  }`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 py-16 text-slate-900">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{txt.eyebrow}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{txt.title}</h1>
        <ShowcaseAddPostForm token={token} lang={lang} valid={!!parsed} />
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={homeHref}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
