import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Influo - Connect Your Talent with Top Brands | Influencer Marketing Platform",
  description: "The most modern Influencer Marketing platform in Greece. Connect your talent with top Brands. Create your professional profile and get hired today.",
  keywords: ["influencer marketing", "influencer marketing Greece", "brand collaborations", "content creators", "Greece", "influencer platform", "social media advertising", "creator economy", "influencer Greece"],
  openGraph: {
    locale: "en_US",
    alternateLocale: ["el_GR"],
    url: "/en",
    title: "Influo - Connect Your Talent with Top Brands",
    description: "The most modern Influencer Marketing platform in Greece. Connect your talent with top Brands.",
    siteName: "Influo.gr",
  },
  twitter: {
    card: "summary_large_image",
    title: "Influo - Connect Your Talent with Top Brands",
    description: "The most modern Influencer Marketing platform in Greece.",
  },
  alternates: {
    canonical: "/en",
    languages: {
      el: "/",
      en: "/en",
    },
  },
};

export default function EnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
