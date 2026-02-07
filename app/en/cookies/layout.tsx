import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Learn how we use cookies on the Influo.gr platform and what your rights are.",
  keywords: ["cookies", "cookie policy", "tracking", "privacy"],
  openGraph: {
    title: "Cookie Policy",
    description: "Learn how we use cookies on the Influo.gr platform.",
    url: "/en/cookies",
  },
  alternates: {
    canonical: "/en/cookies",
    languages: { el: "/cookies", en: "/en/cookies" },
  },
};

export default function EnCookiesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
