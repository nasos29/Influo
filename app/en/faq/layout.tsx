import { pageMetadata } from "@/lib/pageMetadata";
import { faqJsonLd } from "@/lib/faqJsonLd";

export const metadata = pageMetadata({
  title: "Influo FAQ | Influo",
  description: "Answers about signing up, cost, verified profiles, campaigns and collaborations on Influo.",
  path: "/en/faq",
  elPath: "/faq",
  enPath: "/en/faq",
  locale: "en_US",
});

export default function EnFaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd("en")).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
