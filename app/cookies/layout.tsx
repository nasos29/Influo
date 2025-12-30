import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Πολιτική Cookies | Influo.gr",
  description: "Μάθετε πώς χρησιμοποιούμε cookies στην πλατφόρμα Influo.gr και ποια είναι τα δικαιώματά σας.",
  keywords: ["cookies", "πολιτική cookies", "cookie policy", "tracking"],
  openGraph: {
    title: "Πολιτική Cookies | Influo.gr",
    description: "Μάθετε πώς χρησιμοποιούμε cookies στην πλατφόρμα Influo.gr.",
    url: "/cookies",
  },
  alternates: {
    canonical: "/cookies",
  },
};

export default function CookiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

