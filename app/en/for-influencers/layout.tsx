import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "For Influencers: Brand Collaborations in Greece | Influo",
  description: "Create a free influencer profile, apply to campaigns and close paid collaborations with Greek brands.",
  path: "/en/for-influencers",
  elPath: "/for-influencers",
  enPath: "/en/for-influencers",
  locale: "en_US",
});

export default function EnForInfluencersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
