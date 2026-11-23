import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Campaigns and paid brand collabs for creators | Influo",
  description:
    "Create a free profile, browse open brand campaigns and close paid collaborations in Greece — managed on Influo with payment protection.",
  path: "/en/for-influencers",
  elPath: "/for-influencers",
  enPath: "/en/for-influencers",
  locale: "en_US",
});

export default function EnForInfluencersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
