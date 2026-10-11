import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    absolute: "Find Greek Influencers for Your Brand | Influo",
    template: "%s | Influo",
  },
  description: "Search verified influencers in Greece by category, platform and budget. Free sign-up for brands and creators, with campaigns and messaging in one place.",
  keywords: ["influencer marketing", "influencer marketing Greece", "Greek influencers", "brand collaborations", "content creators", "Greece"],
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["el_GR"],
    url: "/en",
    siteName: SITE_NAME,
    title: "Find Greek Influencers for Your Brand | Influo",
    description: "Search verified influencers in Greece by category, platform and budget. Free sign-up for brands and creators, with campaigns and messaging in one place.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Influo — Greek influencers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Find Greek Influencers for Your Brand | Influo",
    description: "Search verified influencers in Greece by category, platform and budget.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "/en",
    languages: {
      el: "/",
      en: "/en",
      "x-default": "/",
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
