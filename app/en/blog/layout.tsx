import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Blog: rates, ROI and influencer contracts | Influo",
  description:
    "Guides for brands and creators in Greece: choosing influencers, engagement, rates, contracts and measuring campaign results.",
  path: "/en/blog",
  elPath: "/blog",
  enPath: "/en/blog",
  locale: "en_US",
});

export default function EnBlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
