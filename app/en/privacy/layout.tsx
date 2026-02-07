import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how we collect, use and protect your personal data on the Influo.gr platform.",
  keywords: ["privacy policy", "data protection", "GDPR", "personal data"],
  openGraph: {
    title: "Privacy Policy",
    description: "Learn how we protect your personal data.",
    url: "/en/privacy",
  },
  alternates: {
    canonical: "/en/privacy",
    languages: { el: "/privacy", en: "/en/privacy" },
  },
};

export default function EnPrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
