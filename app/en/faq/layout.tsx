import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about Influo - the Influencer Marketing platform in Greece.",
  keywords: ["FAQ", "help", "questions", "influencer marketing"],
  openGraph: {
    title: "FAQ",
    description: "Frequently asked questions about Influo.",
    url: "/en/faq",
  },
  alternates: {
    canonical: "/en/faq",
    languages: { el: "/faq", en: "/en/faq" },
  },
};

export default function EnFaqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
