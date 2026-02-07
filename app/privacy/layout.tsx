import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Πολιτική Απορρήτου",
  description: "Μάθετε πώς συλλέγουμε, χρησιμοποιούμε και προστατεύουμε τα προσωπικά σας δεδομένα στην πλατφόρμα Influo.gr.",
  keywords: ["πολιτική απορρήτου", "privacy policy", "προστασία δεδομένων", "GDPR"],
  openGraph: {
    title: "Πολιτική Απορρήτου",
    description: "Μάθετε πώς προστατεύουμε τα προσωπικά σας δεδομένα.",
    url: "/privacy",
  },
  alternates: {
    canonical: "/privacy",
    languages: { el: "/privacy", en: "/en/privacy" },
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

