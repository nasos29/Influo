import type { Metadata } from "next";
import { absoluteUrl, languageAlternates, SITE_NAME } from "@/lib/site";

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  /** Greek URL. Defaults to path. x-default always points here. */
  elPath?: string;
  enPath?: string;
  locale?: "el_GR" | "en_US";
  index?: boolean;
  keywords?: string[];
}): Metadata {
  const index = opts.index !== false;
  const elPath = opts.elPath || opts.path;
  return {
    title: { absolute: opts.title },
    description: opts.description,
    ...(opts.keywords?.length ? { keywords: opts.keywords } : {}),
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false, googleBot: { index: false, follow: false } },
    alternates: {
      canonical: opts.path,
      languages: languageAlternates(elPath, opts.enPath),
    },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: absoluteUrl(opts.path),
      locale: opts.locale ?? "el_GR",
      siteName: SITE_NAME,
      type: "website",
    },
  };
}
