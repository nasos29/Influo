import SeoDiscoverLinks from "@/components/SeoDiscoverLinks";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Βρες πληρωμένες συνεργασίες με brands — δωρεάν προφίλ | Influo",
  description:
    "Φτιάξε δωρεάν επαγγελματικό προφίλ influencer, κάνε αίτηση σε καμπάνιες και κλείσε συνεργασίες με ελληνικά brands, με προστασία πληρωμής.",
  path: "/for-influencers",
  enPath: "/en/for-influencers",
});

export default function ForInfluencersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SeoDiscoverLinks lang="el" />
    </>
  );
}
