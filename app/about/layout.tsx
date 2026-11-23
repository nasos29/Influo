import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Τι είναι το Influo; Πλατφόρμα brands & creators | Influo",
  description:
    "Το Influo είναι η ελληνική πλατφόρμα που συνδέει brands με influencers: κατάλογος, καμπάνιες, προτάσεις και συνεργασίες σε ένα μέρος.",
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
