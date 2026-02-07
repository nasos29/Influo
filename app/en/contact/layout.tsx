import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact us for questions, suggestions or support. We'll get back to you as soon as possible.",
  keywords: ["contact", "support", "help", "get in touch"],
  openGraph: {
    title: "Contact",
    description: "Contact us for questions or support.",
    url: "/en/contact",
  },
  alternates: {
    canonical: "/en/contact",
    languages: { el: "/contact", en: "/en/contact" },
  },
};

export default function EnContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
