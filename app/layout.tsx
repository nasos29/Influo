import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ChunkErrorReload from "@/components/ChunkErrorReload";
import BackToTop from "@/components/BackToTop";
import ChatDock from "@/components/ChatDock";
import CookieConsent from "@/components/CookieConsent";
import FeedbackHost from "@/components/Feedback";
import HtmlLang from "@/components/HtmlLang";
import { SiteSettingsProvider } from "@/components/SiteSettingsProvider";
import { HEADER_AVATAR_BOOT_SCRIPT } from "@/lib/headerAvatarCache";
import { ORGANIZATION_EMAIL, ORGANIZATION_SAME_AS, SITE_NAME, SITE_URL } from "@/lib/site";
import { publicSiteSettings, siteSettingsCssVars } from "@/lib/siteSettings";
import { getSiteSettings } from "@/lib/siteSettingsServer";

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ["latin", "greek"],
  variable: "--font-roboto",
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Influencer και Ψηφιακός Δημιουργός για το Brand σου | Influo",
    template: "%s | Influo",
  },
  description: "Βρες influencers και ψηφιακούς δημιουργούς στην Ελλάδα ανά κατηγορία, πλατφόρμα και budget. Δωρεάν εγγραφή για brands και creators, verified προφίλ και καμπάνιες σε ένα μέρος.",
  keywords: ["influencer marketing", "influencer marketing Ελλάδα", "brand collaborations", "content creators", "ψηφιακός δημιουργός", "Ελλάδα", "πλατφόρμα influencers", "διαφήμιση στα social media", "συνεργασίες με brands", "creator economy", "διαφημίσεις influencers", "προώθηση προϊόντων", "influencer Ελλάδα", "Unboxing", "unboxing influencer"],
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
    title: "Influencer και Ψηφιακός Δημιουργός για το Brand σου | Influo",
    description: "Βρες influencers και ψηφιακούς δημιουργούς στην Ελλάδα ανά κατηγορία, πλατφόρμα και budget. Δωρεάν εγγραφή για brands και creators, verified προφίλ και καμπάνιες σε ένα μέρος.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Influo — Influencers και ψηφιακοί δημιουργοί στην Ελλάδα",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Influencer και Ψηφιακός Δημιουργός για το Brand σου | Influo",
    description: "Βρες influencers και ψηφιακούς δημιουργούς στην Ελλάδα ανά κατηγορία, πλατφόρμα και budget.",
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
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48 256x256", type: "image/x-icon" },
      { url: "/logo-icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteSettings = await getSiteSettings();
  const publicSettings = publicSiteSettings(siteSettings);
  const settingsCss = siteSettingsCssVars(siteSettings);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Influo",
    url: SITE_URL,
    logo: `${SITE_URL}/logo-512.png`,
    email: ORGANIZATION_EMAIL,
    description: "Πλατφόρμα influencer marketing στην Ελλάδα. Βρες influencers και ψηφιακούς δημιουργούς ανά κατηγορία, πλατφόρμα και budget.",
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
        urlTemplate: `${SITE_URL}/directory?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="el" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEADER_AVATAR_BOOT_SCRIPT }} />
        <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48 256x256" type="image/x-icon" />
        <link rel="icon" href="/logo-icon.svg" type="image/svg+xml" sizes="any" />
        <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="icon" href="/icon-512.png" type="image/png" sizes="512x512" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
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
      <body className={`${roboto.variable} font-sans antialiased`}>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{${settingsCss}}`,
          }}
        />
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
        <SiteSettingsProvider settings={publicSettings}>
          {children}
          <ChatDock />
          <BackToTop />
          <ChunkErrorReload />
          <HtmlLang />
          <FeedbackHost />
          <CookieConsent />
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
