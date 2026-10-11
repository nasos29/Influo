import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Για Influencers: Συνεργασίες με Brands στην Ελλάδα | Influo",
  description: "Φτιάξε δωρεάν επαγγελματικό προφίλ influencer, κάνε αίτηση σε καμπάνιες και κλείσε πληρωμένες συνεργασίες με ελληνικά brands.",
  path: "/for-influencers",
  enPath: "/en/for-influencers",
});

export default function ForInfluencersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
