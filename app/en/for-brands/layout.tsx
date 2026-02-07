import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Brands - Find Influencers",
  description: "Find the best influencers for your company. Search, connect and collaborate with verified creators. Get AI-powered recommendations for free!",
  keywords: ["for brands", "influencer marketing", "find influencers", "brand collaboration", "Greece"],
  openGraph: {
    title: "For Brands - Find Influencers",
    description: "Find the best influencers for your company with AI-powered recommendations.",
    url: "/en/for-brands",
  },
  alternates: {
    canonical: "/en/for-brands",
    languages: { el: "/for-brands", en: "/en/for-brands" },
  },
};

export default function EnForBrandsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
