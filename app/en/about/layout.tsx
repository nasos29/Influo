import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description: "Our mission is to make influencer marketing smarter, fairer and more effective. Get to know Influo.",
  keywords: ["influo", "about us", "influencer marketing", "platform", "Greece"],
  openGraph: {
    title: "About Us",
    description: "Our mission is to make influencer marketing smarter and fairer.",
    url: "/en/about",
  },
  alternates: {
    canonical: "/en/about",
    languages: { el: "/about", en: "/en/about" },
  },
};

export default function EnAboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
