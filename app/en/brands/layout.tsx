import { pageMetadata } from "@/lib/pageMetadata";
import { categorySeoKeywords } from "@/lib/categories";

export const metadata = pageMetadata({
  title: "Brand directory — open campaigns for creators | Influo",
  description:
    "Discover Greek businesses with open campaigns. Find a brand in your niche, apply and land paid collaborations — free sign-up.",
  path: "/en/brands",
  elPath: "/brands",
  enPath: "/en/brands",
  locale: "en_US",
  keywords: ["brands Greece", "influencer collaborations", ...categorySeoKeywords()],
});

export default function EnBrandsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
