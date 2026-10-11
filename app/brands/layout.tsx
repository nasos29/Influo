import { pageMetadata } from "@/lib/pageMetadata";
import { categorySeoKeywords } from "@/lib/categories";

export const metadata = pageMetadata({
  title: "Brands που Ψάχνουν Influencers στην Ελλάδα | Influo",
  description: "Δες ελληνικές επιχειρήσεις που αναζητούν influencers για συνεργασίες και καμπάνιες. Εγγραφή δωρεάν για creators.",
  path: "/brands",
  enPath: "/en/brands",
  keywords: ["brands Ελλάδα", "επιχειρήσεις influencers", ...categorySeoKeywords()],
});

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
