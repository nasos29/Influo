import { faqs } from "@/lib/faqItems";
import { absoluteUrl } from "@/lib/site";

export function faqJsonLd(lang: "el" | "en"): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: absoluteUrl(lang === "en" ? "/en/faq" : "/faq"),
    inLanguage: lang,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question[lang],
      acceptedAnswer: { "@type": "Answer", text: faq.answer[lang] },
    })),
  };
}
