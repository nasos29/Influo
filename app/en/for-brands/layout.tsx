import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Influencer directory and campaign publishing | Influo",
  description:
    "Search verified creators in the directory, publish a brief and manage proposals and collaborations from one dashboard. Free sign-up.",
  path: "/en/for-brands",
  elPath: "/for-brands",
  enPath: "/en/for-brands",
  locale: "en_US",
});

export default function EnForBrandsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
