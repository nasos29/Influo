import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    absolute: "Find the Right Influencer and Content Creator for Your Brand | Influo",
    template: "%s | Influo",
  },
  description: "Search verified influencers and content creators in Greece by category, platform and budget. Free sign-up for brands and creators, with campaigns and messaging in one place.",
  keywords: ["influencer marketing", "influencer marketing Greece", "influencers", "brand collaborations", "content creators", "Greece", "Unboxing", "unboxing influencer"],
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["el_GR"],
    url: "/en",
    siteName: SITE_NAME,
    title: "Find the Right Influencer and Content Creator for Your Brand | Influo",
    description: "Search verified influencers and content creators in Greece by category, platform and budget. Free sign-up for brands and creators, with campaigns and messaging in one place.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Influo — influencers and content creators",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Find the Right Influencer and Content Creator for Your Brand | Influo",
    description: "Search verified influencers and content creators in Greece by category, platform and budget.",
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
