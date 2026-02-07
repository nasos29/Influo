import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Influencers - Connect Your Talent",
  description: "Create your professional profile, get offers from brands and close deals. The most modern influencer marketing platform in Greece.",
  keywords: ["for influencers", "influencer platform", "brand collaborations", "Greece", "creator economy"],
  openGraph: {
    title: "For Influencers - Connect Your Talent",
    description: "Create your professional profile and collaborate with brands.",
    url: "/en/for-influencers",
  },
  alternates: {
    canonical: "/en/for-influencers",
    languages: { el: "/for-influencers", en: "/en/for-influencers" },
  },
};

export default function EnForInfluencersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
