import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "User Guide",
  description: "User guide for Influencers & Brands on the Influo platform.",
  keywords: ["guide", "user guide", "help", "influencer marketing"],
  openGraph: {
    title: "User Guide",
    description: "User guide for Influencers & Brands.",
    url: "/en/docs",
  },
  alternates: {
    canonical: "/en/docs",
    languages: { el: "/docs", en: "/en/docs" },
  },
};

export default function EnDocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
