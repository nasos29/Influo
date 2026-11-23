import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Κατάλογος influencers και δημοσίευση καμπανιών | Influo",
  description:
    "Ψάξε verified creators στον κατάλογο, δημοσίευσε brief και διαχειρίσου προτάσεις και συνεργασίες από ένα dashboard. Δωρεάν εγγραφή.",
  path: "/for-brands",
  enPath: "/en/for-brands",
});

export default function ForBrandsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
