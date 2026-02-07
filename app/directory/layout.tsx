import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Κατάλογος Influencers",
  description: "Ανακαλύψτε τους καλύτερους content creators στην Ελλάδα. Αναζητήστε influencers ανά κατηγορία, πλατφόρμα, engagement rate και budget.",
  keywords: ["κατάλογος influencers", "influencer directory", "content creators Ελλάδα", "αναζήτηση influencers", "influencer marketing"],
  openGraph: {
    title: "Κατάλογος Influencers",
    description: "Ανακαλύψτε τους καλύτερους content creators στην Ελλάδα.",
    url: "/directory",
  },
  alternates: {
    canonical: "/directory",
    languages: { el: "/directory", en: "/en/directory" },
  },
};

export default function DirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

