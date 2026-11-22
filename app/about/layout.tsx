import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Η πλατφόρμα influencer marketing στην Ελλάδα | Influo",
  description:
    "Το Influo συνδέει ελληνικά brands με verified influencers. Καμπάνιες, προτάσεις και συνεργασίες σε μία πλατφόρμα — πιο δίκαια και πιο αποδοτικά.",
  path: "/about",
  enPath: "/en/about",
  keywords: ["influo", "σχετικά με εμάς", "about", "influencer marketing", "πλατφόρμα"],
});

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
