import SeoDiscoverLinks from "@/components/SeoDiscoverLinks";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Βρες Έλληνες influencers για την επιχείρησή σου | Influo",
  description:
    "Βρες verified influencers στην Ελλάδα, δημοσίευσε καμπάνια και διαχειρίσου συνεργασίες από ένα dashboard. AI προτάσεις, δωρεάν εγγραφή.",
  path: "/for-brands",
  enPath: "/en/for-brands",
});

export default function ForBrandsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SeoDiscoverLinks lang="el" />
    </>
  );
}
