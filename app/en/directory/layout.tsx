import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Greek Influencer Directory: Instagram, TikTok, YouTube | Influo",
  description: "Browse 300+ verified Greek influencers on Instagram, TikTok and YouTube. Filter by category, city, engagement and price.",
  path: "/en/directory",
  elPath: "/directory",
  enPath: "/en/directory",
  locale: "en_US",
});

export default function EnDirectoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
