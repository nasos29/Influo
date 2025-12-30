import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Κατάλογος Influencers | Influo.gr",
  description: "Ανακαλύψτε τους καλύτερους content creators στην Ελλάδα. Αναζητήστε influencers ανά κατηγορία, πλατφόρμα, engagement rate και budget.",
  keywords: ["κατάλογος influencers", "influencer directory", "content creators Ελλάδα", "αναζήτηση influencers", "influencer marketing"],
  openGraph: {
    title: "Κατάλογος Influencers | Influo.gr",
    description: "Ανακαλύψτε τους καλύτερους content creators στην Ελλάδα.",
    url: "/directory",
  },
  alternates: {
    canonical: "/directory",
  },
};

export default function DirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

