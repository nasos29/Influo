"use client";

import Link from "next/link";
import {
  SHOWCASE_ADD_POST_CTA_EL,
  SHOWCASE_ADD_POST_CTA_EN,
  SHOWCASE_MISSING_POST_BRAND_NOTICE_EL,
  SHOWCASE_MISSING_POST_BRAND_NOTICE_EN,
  SHOWCASE_MISSING_POST_NOTICE_EL,
  SHOWCASE_MISSING_POST_NOTICE_EN,
  showcaseHelperText,
} from "@/lib/showcaseCopy";
import { deliverableTipHref } from "@/lib/deliverableChatTip";

type Lang = "el" | "en";
type Party = "brand" | "influencer";
type Source = "proposal" | "campaign";

export default function MissingPostLinkNotice({
  lang,
  party,
  source,
  id,
  className = "",
}: {
  lang: Lang;
  party: Party;
  source: Source;
  id: string;
  className?: string;
}) {
  const notice =
    party === "brand"
      ? lang === "en"
        ? SHOWCASE_MISSING_POST_BRAND_NOTICE_EN
        : SHOWCASE_MISSING_POST_BRAND_NOTICE_EL
      : lang === "en"
        ? SHOWCASE_MISSING_POST_NOTICE_EN
        : SHOWCASE_MISSING_POST_NOTICE_EL;
  const cta = lang === "en" ? SHOWCASE_ADD_POST_CTA_EN : SHOWCASE_ADD_POST_CTA_EL;
  const href = deliverableTipHref(
    { kind: source, id },
    party === "brand" ? "brand" : "influencer"
  );

  return (
    <div
      className={`rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5 ${className}`}
      role="status"
    >
      <p className="text-xs leading-relaxed text-amber-900/90">{notice}</p>
      {party === "influencer" ? (
        <Link
          href={href}
          className="mt-1.5 inline-flex text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
        >
          {cta}
        </Link>
      ) : null}
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
        {showcaseHelperText(party, lang)}
      </p>
    </div>
  );
}
