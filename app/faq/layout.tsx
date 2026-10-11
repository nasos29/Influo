import { pageMetadata } from "@/lib/pageMetadata";
import { faqJsonLd } from "@/lib/faqJsonLd";

export const metadata = pageMetadata({
  title: "Συχνές Ερωτήσεις για το Influo | Influo",
  description: "Απαντήσεις για εγγραφή, κόστος, verified προφίλ, καμπάνιες και συνεργασίες brands και influencers στο Influo.",
  path: "/faq",
  enPath: "/en/faq",
});

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd("el")).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
