import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Blog: τιμές, ROI και συμβόλαια influencer marketing | Influo",
  description:
    "Άρθρα και οδηγοί για brands και creators στην Ελλάδα: επιλογή influencers, engagement, τιμές, συμβάσεις και μέτρηση αποτελεσμάτων.",
  path: "/blog",
  enPath: "/en/blog",
});

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
