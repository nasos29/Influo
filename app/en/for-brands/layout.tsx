import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Influencer Marketing for Businesses in Greece | Influo",
  description: "Find influencers for your business, publish campaigns and manage collaborations from one dashboard.",
  path: "/en/for-brands",
  elPath: "/for-brands",
  enPath: "/en/for-brands",
  locale: "en_US",
});

export default function EnForBrandsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
