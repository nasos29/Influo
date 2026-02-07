import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Brands Directory",
  description: "Discover verified companies that collaborate with influencers. Connect with top brands for partnerships.",
  keywords: ["brands", "companies directory", "verified companies", "influencer marketing", "partnerships"],
  openGraph: {
    title: "Brands Directory",
    description: "Discover verified companies that collaborate with influencers.",
    url: "/en/brands",
  },
  alternates: {
    canonical: "/en/brands",
    languages: { el: "/brands", en: "/en/brands" },
  },
};

export default function EnBrandsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
