import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Read the terms of use for the Influo.gr platform. Understand your rights and obligations as a user.",
  keywords: ["terms of use", "terms and conditions", "platform usage", "user agreement"],
  openGraph: {
    title: "Terms of Use",
    description: "Read the terms of use for the Influo.gr platform.",
    url: "/en/terms",
  },
  alternates: {
    canonical: "/en/terms",
    languages: { el: "/terms", en: "/en/terms" },
  },
};

export default function EnTermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
