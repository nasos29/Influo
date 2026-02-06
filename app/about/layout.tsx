import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Σχετικά με εμάς | Influo.gr",
  description: "Η αποστολή μας είναι να κάνουμε το influencer marketing πιο έξυπνο, δίκαιο και αποδοτικό. Γνωρίστε το Influo.",
  keywords: ["influo", "σχετικά με εμάς", "about", "influencer marketing", "πλατφόρμα"],
  openGraph: {
    title: "Σχετικά με εμάς | Influo.gr",
    description: "Η αποστολή μας είναι να κάνουμε το influencer marketing πιο έξυπνο και δίκαιο.",
    url: "/about",
  },
  alternates: {
    canonical: "/about",
    languages: { el: "/about", en: "/en/about" },
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
