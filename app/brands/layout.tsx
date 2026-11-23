import BrandsListingJsonLd from "./BrandsListingJsonLd";
import { pageMetadata } from "@/lib/pageMetadata";
import { categorySeoKeywords } from "@/lib/categories";

export const metadata = pageMetadata({
  title: "Κατάλογος επιχειρήσεων — καμπάνιες για influencers | Influo",
  description:
    "Ανακάλυψε ελληνικές επιχειρήσεις με ανοιχτές καμπάνιες. Βρες brand στο niche σου, κάνε αίτηση και κλείσε πληρωμένη συνεργασία — δωρεάν εγγραφή.",
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
