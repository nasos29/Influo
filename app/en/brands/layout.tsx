import { pageMetadata } from "@/lib/pageMetadata";
import { categorySeoKeywords } from "@/lib/categories";

export const metadata = pageMetadata({
  title: "Greek brands seeking influencer collaborations | Influo",
  description:
    "Browse businesses looking for creators for campaigns in Greece. Apply and land paid collaborations — free sign-up.",
  path: "/en/brands",
  elPath: "/brands",
  enPath: "/en/brands",
  locale: "en_US",
  keywords: ["brands Greece", "influencer collaborations", ...categorySeoKeywords()],
});

export default function EnBrandsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
