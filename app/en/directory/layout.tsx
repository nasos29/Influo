import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Influencer Directory",
  description: "Discover the best content creators in Greece. Search influencers by category, platform, engagement rate and budget.",
  keywords: ["influencer directory", "content creators Greece", "find influencers", "influencer marketing"],
  openGraph: {
    title: "Influencer Directory",
    description: "Discover the best content creators in Greece.",
    url: "/en/directory",
  },
  alternates: {
    canonical: "/en/directory",
    languages: { el: "/directory", en: "/en/directory" },
  },
};

export default function EnDirectoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
