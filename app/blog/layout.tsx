import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Οδηγοί influencer marketing στην Ελλάδα: τιμές, ROI, συμβόλαια | Influo",
  description:
    "Πρακτικοί οδηγοί για brands και creators: τιμές influencers, engagement rate, micro vs macro, συμβόλαια και μέτρηση ROI.",
  path: "/blog",
  enPath: "/en/blog",
});

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
