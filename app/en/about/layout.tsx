import SeoDiscoverLinks from "@/components/SeoDiscoverLinks";
import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Influencer marketing platform in Greece | Influo",
  description:
    "Influo connects Greek brands with verified influencers. Campaigns, matching and collaborations in one place — fairer and more efficient.",
  path: "/en/about",
  elPath: "/about",
  enPath: "/en/about",
  locale: "en_US",
  keywords: ["influo", "about us", "influencer marketing", "platform", "Greece"],
});

export default function EnAboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SeoDiscoverLinks lang="en" />
    </>
  );
}
