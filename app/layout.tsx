import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.com'),
  title: {
    default: "Influo - Connect Your Talent with Top Brands | Influencer Marketing Platform",
    template: "%s | Influo"
  },
  description: "The most modern Influencer Marketing platform in Greece. Connect talented creators with top brands. Create your professional profile and get hired today.",
  keywords: ["influencer marketing", "brand collaborations", "content creators", "Greece", "influencer platform", "social media marketing", "brand partnerships", "creator economy"],
  authors: [{ name: "Influo" }],
  creator: "Influo",
  publisher: "Influo",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["el_GR"],
    url: "/",
    siteName: "Influo",
    title: "Influo - Connect Your Talent with Top Brands",
    description: "The most modern Influencer Marketing platform in Greece. Connect talented creators with top brands.",
    images: [
      {
        url: "/logo.svg",
        width: 1200,
        height: 630,
        alt: "Influo - Influencer Marketing Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Influo - Connect Your Talent with Top Brands",
    description: "The most modern Influencer Marketing platform in Greece.",
    images: ["/logo.svg"],
    creator: "@influo",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
  alternates: {
    canonical: "/",
    languages: {
      "en": "/",
      "el": "/?lang=el",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Influo",
    "url": process.env.NEXT_PUBLIC_SITE_URL || "https://influo.com",
    "logo": `${process.env.NEXT_PUBLIC_SITE_URL || "https://influo.com"}/logo.svg`,
    "description": "The most modern Influencer Marketing platform in Greece. Connect talented creators with top brands.",
    "sameAs": [
      "https://www.instagram.com/influo",
      "https://www.facebook.com/influo",
      "https://twitter.com/influo"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "email": "contact@influo.com"
    }
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Influo",
    "url": process.env.NEXT_PUBLIC_SITE_URL || "https://influo.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${process.env.NEXT_PUBLIC_SITE_URL || "https://influo.com"}/directory?search={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
