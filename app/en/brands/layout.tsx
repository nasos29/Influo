import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Brands Looking for Influencers in Greece | Influo",
  description: "See Greek businesses looking for influencers for collaborations and campaigns. Free sign-up for creators.",
  path: "/en/brands",
  elPath: "/brands",
  enPath: "/en/brands",
  locale: "en_US",
});

export default function EnBrandsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
