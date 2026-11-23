import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "What is Influo? Platform for brands and creators | Influo",
  description:
    "Influo is the Greek platform connecting brands with influencers: directory, campaigns, proposals and collaborations in one place.",
  path: "/en/about",
  elPath: "/about",
  enPath: "/en/about",
  locale: "en_US",
  keywords: ["influo", "about us", "influencer marketing", "platform", "Greece"],
});

export default function EnAboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
