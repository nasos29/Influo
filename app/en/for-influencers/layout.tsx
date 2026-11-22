import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Find paid brand collaborations — free creator profile | Influo",
  description:
    "Build a free professional influencer profile, apply to campaigns and close collaborations with Greek brands, with payment protection.",
  path: "/en/for-influencers",
  elPath: "/for-influencers",
  enPath: "/en/for-influencers",
  locale: "en_US",
});

export default function EnForInfluencersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
