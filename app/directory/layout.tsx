import { pageMetadata } from "@/lib/pageMetadata";
import { categorySeoKeywords } from "@/lib/categories";

export const metadata = pageMetadata({
  title: "Κατάλογος Influencers Ελλάδα: Instagram, TikTok, YouTube | Influo",
  description: "Δες 300+ verified Έλληνες influencers σε Instagram, TikTok και YouTube. Φίλτρα ανά κατηγορία, πόλη, engagement και τιμή. Δωρεάν αναζήτηση.",
  path: "/directory",
  enPath: "/en/directory",
  keywords: ["influencers Ελλάδα", "κατάλογος influencers", ...categorySeoKeywords()],
});

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
