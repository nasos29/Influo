import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog | Influo.gr",
  description: "Read articles, guides and tips for influencer marketing, brand collaborations, and how to increase your engagement rate.",
  keywords: ["blog influencer marketing", "marketing articles", "influencer tips", "marketing guides"],
  openGraph: {
    title: "Blog | Influo.gr",
    description: "Read articles and guides for influencer marketing.",
    url: "/en/blog",
  },
  alternates: {
    canonical: "/en/blog",
    languages: { el: "/blog", en: "/en/blog" },
  },
};

export default function EnBlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
