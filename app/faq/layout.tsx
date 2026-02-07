import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Συχνές Ερωτήσεις (FAQ)",
  description: "Βρείτε απαντήσεις στις πιο συχνές ερωτήσεις σχετικά με την πλατφόρμα Influo, την εγγραφή, τις συνεργασίες και πολλά άλλα.",
  keywords: ["faq", "συχνές ερωτήσεις", "ερωτήσεις influo", "βοήθεια", "support"],
  openGraph: {
    title: "Συχνές Ερωτήσεις (FAQ)",
    description: "Βρείτε απαντήσεις στις πιο συχνές ερωτήσεις σχετικά με την Influo.",
    url: "/faq",
  },
  alternates: {
    canonical: "/faq",
    languages: { el: "/faq", en: "/en/faq" },
  },
};

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

