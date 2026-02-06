import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Blog | Influo.gr",
  description: "Διαβάστε άρθρα, οδηγούς και tips για influencer marketing, συνεργασίες με brands, και πώς να αυξήσετε το engagement rate σας.",
  keywords: ["blog influencer marketing", "άρθρα marketing", "tips influencers", "οδηγοί marketing"],
  openGraph: {
    title: "Blog | Influo.gr",
    description: "Διαβάστε άρθρα και οδηγούς για influencer marketing.",
    url: "/blog",
  },
  alternates: {
    canonical: "/blog",
    languages: { el: "/blog", en: "/en/blog" },
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

