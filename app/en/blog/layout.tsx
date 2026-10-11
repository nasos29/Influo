import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Influencer Marketing Blog: Guides & Tips | Influo",
  description: "Guides to influencer marketing in Greece: rates, engagement, contracts, micro vs macro influencers and measuring ROI.",
  path: "/en/blog",
  elPath: "/blog",
  enPath: "/en/blog",
  locale: "en_US",
});

export default function EnBlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
