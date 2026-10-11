import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Influencer Marketing για Επιχειρήσεις στην Ελλάδα | Influo",
  description: "Βρες influencers για την επιχείρησή σου, δημοσίευσε καμπάνιες και διαχειρίσου συνεργασίες από ένα dashboard. AI προτάσεις χωρίς κόστος.",
  path: "/for-brands",
  enPath: "/en/for-brands",
});

export default function ForBrandsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
