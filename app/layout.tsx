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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.gr'),
  title: {
    default: "Influo.gr - Σύνδεσε το Ταλέντο σου με κορυφαία Brands | Πλατφόρμα Influencer Marketing",
    template: "%s | Influo.gr"
  },
  description: "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Σύνδεσε το ταλέντο σου με κορυφαία Brands. Δημιούργησε το επαγγελματικό σου προφίλ και κλείσε συνεργασίες σήμερα.",
  keywords: ["influencer marketing", "influencer marketing Ελλάδα", "brand collaborations", "content creators", "Ελλάδα", "πλατφόρμα influencers", "διαφήμιση στα social media", "συνεργασίες με brands", "creator economy", "διαφημίσεις influencers", "προώθηση προϊόντων", "influencer Ελλάδα"],
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
    locale: "el_GR",
    alternateLocale: ["en_US"],
    url: "/",
    siteName: "Influo.gr",
    title: "Influo - Σύνδεσε το Ταλέντο σου με κορυφαία Brands",
    description: "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Σύνδεσε το ταλέντο σου με κορυφαία Brands.",
    images: [
      {
        url: "/logo.svg",
        width: 1200,
        height: 630,
        alt: "Influo - Πλατφόρμα Influencer Marketing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Influo - Σύνδεσε το Ταλέντο σου με κορυφαία Brands",
    description: "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα.",
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
      "el": "/",
      "en": "/?lang=en",
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
    "name": "Influo.gr",
    "url": process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr",
    "logo": `${process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr"}/logo.svg`,
    "description": "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Σύνδεσε το ταλέντο σου με κορυφαία Brands.",
    "inLanguage": "el",
    "sameAs": [
      "https://www.instagram.com/influo",
      "https://www.facebook.com/influo",
      "https://twitter.com/influo"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "email": "contact@influo.com",
      "availableLanguage": ["el", "en"]
    }
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Influo.gr",
    "url": process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr",
    "inLanguage": "el",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr"}/directory?search={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html lang="el">
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
