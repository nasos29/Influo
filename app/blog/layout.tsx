import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Blog Influencer Marketing: Οδηγοί & Tips | Influo",
  description: "Οδηγοί για influencer marketing στην Ελλάδα: τιμές influencers, engagement rate, συμβόλαια, micro vs macro influencers και μέτρηση ROI.",
  path: "/blog",
  enPath: "/en/blog",
});

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
