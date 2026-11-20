import SeoDiscoverLinks from "@/components/SeoDiscoverLinks";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Find Greek influencers for your business | Influo",
  description:
    "Find verified influencers in Greece, publish campaigns and manage collaborations from one dashboard. AI matching, free sign-up.",
  path: "/en/for-brands",
  elPath: "/for-brands",
  enPath: "/en/for-brands",
  locale: "en_US",
});

export default function EnForBrandsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SeoDiscoverLinks lang="en" />
    </>
  );
}
