import type { ReactNode } from "react";
import MarketingSection from "@/components/marketing/MarketingSection";
import SectionHeading from "@/components/marketing/SectionHeading";
import TrustStrip from "@/components/marketing/TrustStrip";

type Props = Readonly<{
  trustTitle: string;
  trustItems: readonly string[];
  ctaTitle: string;
  ctaDesc: string;
  ctaAction: ReactNode;
}>;

/** Shared trust strip + dark final CTA used by marketing pages. */
export default function MarketingClosing({
  trustTitle,
  trustItems,
  ctaTitle,
  ctaDesc,
  ctaAction,
}: Props) {
  return (
    <>
      <MarketingSection tone="white">
        <SectionHeading title={trustTitle} />
        <TrustStrip items={trustItems} />
      </MarketingSection>
      <section className="bg-slate-900 px-4 py-16 text-white sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">{ctaTitle}</h2>
          <p className="mb-8 text-slate-300">{ctaDesc}</p>
          {ctaAction}
        </div>
      </section>
    </>
  );
}
