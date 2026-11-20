import BrandsListingJsonLd from "./BrandsListingJsonLd";
import { pageMetadata } from "@/lib/pageMetadata";
import { categorySeoKeywords } from "@/lib/categories";

export const metadata = pageMetadata({
  title: "Ελληνικά brands που ζητούν συνεργασία με influencers | Influo",
  description:
    "Δες επιχειρήσεις που ψάχνουν creators για καμπάνιες στην Ελλάδα. Κάνε αίτηση και κλείσε πληρωμένη συνεργασία — εγγραφή δωρεάν.",
  path: "/brands",
  enPath: "/en/brands",
  keywords: ["brands Ελλάδα", "επιχειρήσεις influencers", ...categorySeoKeywords()],
});

export const revalidate = 3600;

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BrandsListingJsonLd />
      {children}
    </>
  );
}
