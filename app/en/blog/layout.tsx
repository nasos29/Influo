import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Influencer marketing guides for Greece: rates, ROI, contracts | Influo",
  description:
    "Practical guides for brands and creators: influencer rates, engagement, micro vs macro, contracts and measuring ROI.",
  path: "/en/blog",
  elPath: "/blog",
  enPath: "/en/blog",
  locale: "en_US",
});

export default function EnBlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
