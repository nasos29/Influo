import type { Metadata } from "next";
import { headers } from "next/headers";
import { Roboto } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";
import { ORGANIZATION_EMAIL, ORGANIZATION_SAME_AS, SITE_NAME, SITE_URL } from "@/lib/site";

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ["latin", "greek"],
  variable: "--font-roboto",
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Influencers Ελλάδα: Βρες Influencer για το Brand σου | Influo",
    template: "%s | Influo",
  },
  description: "Βρες influencers στην Ελλάδα ανά κατηγορία, πλατφόρμα και budget. Δωρεάν εγγραφή για brands και creators, verified προφίλ και καμπάνιες σε ένα μέρος.",
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
    siteName: SITE_NAME,
    title: "Influencers Ελλάδα: Βρες Influencer για το Brand σου | Influo",
    description: "Βρες influencers στην Ελλάδα ανά κατηγορία, πλατφόρμα και budget. Δωρεάν εγγραφή για brands και creators, verified προφίλ και καμπάνιες σε ένα μέρος.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Influo — Influencers στην Ελλάδα",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Influencers Ελλάδα: Βρες Influencer για το Brand σου | Influo",
    description: "Βρες influencers στην Ελλάδα ανά κατηγορία, πλατφόρμα και budget.",
    images: ["/og-image.png"],
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
      el: "/",
      en: "/en",
      "x-default": "/",
    },
  },
  icons: {
    icon: [
      { url: "/logo-icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/logo-icon.svg", type: "image/svg+xml", sizes: "48x48" },
      { url: "/logo-icon.svg", type: "image/svg+xml", sizes: "32x32" },
      { url: "/logo-icon.svg", type: "image/svg+xml", sizes: "16x16" },
    ],
    apple: [
      { url: "/logo-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
    shortcut: "/logo-icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";
  const htmlLang = pathname.startsWith("/en") ? "en" : "el";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Influo",
    url: SITE_URL,
    logo: `${SITE_URL}/logo-512.png`,
    email: ORGANIZATION_EMAIL,
    description: "Πλατφόρμα influencer marketing στην Ελλάδα. Βρες influencers ανά κατηγορία, πλατφόρμα και budget.",
    inLanguage: "el",
    sameAs: ORGANIZATION_SAME_AS,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: ORGANIZATION_EMAIL,
      availableLanguage: ["el", "en"],
    },
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "el",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/directory?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang={htmlLang}>
      <head>
        <link rel="icon" href="/logo-icon.svg" type="image/svg+xml" sizes="any" />
        <link rel="icon" href="/logo-icon.svg" type="image/svg+xml" sizes="48x48" />
        <link rel="icon" href="/logo-icon.svg" type="image/svg+xml" sizes="32x32" />
        <link rel="icon" href="/logo-icon.svg" type="image/svg+xml" sizes="16x16" />
        <link rel="apple-touch-icon" href="/logo-icon.svg" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
          <>
            <link rel="preconnect" href={new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin} crossOrigin="" />
            <link rel="dns-prefetch" href={new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin} />
          </>
        ) : null}
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
        className={`${roboto.variable} font-sans antialiased`}
      >
        {/* Password recovery: Supabase may redirect to Site URL (/) if redirect_to is not allowlisted — send user to reset page with same hash. */}
        <Script id="recovery-hash-redirect" strategy="beforeInteractive">
          {`
(function(){
  try {
    if (typeof location === 'undefined') return;
    if (location.pathname === '/reset-password') return;
    var h = location.hash;
    if (!h || h.length < 2) return;
    var params = new URLSearchParams(h.slice(1));
    if (params.get('type') !== 'recovery') return;
    if (!params.get('access_token')) return;
    location.replace(location.origin + '/reset-password' + h);
  } catch (e) {}
})();
          `}
        </Script>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
