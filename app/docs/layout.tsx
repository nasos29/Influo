import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Οδηγός Χρήστη",
  description: "Ολοκληρωμένος οδηγός χρήσης της πλατφόρμας Influo για influencers και brands. Μάθετε πώς να χρησιμοποιήσετε όλες τις δυνατότητες της πλατφόρμας.",
  keywords: ["οδηγός χρήστη", "user guide", "οδηγίες influo", "πώς να χρησιμοποιήσω influo", "tutorial"],
  openGraph: {
    title: "Οδηγός Χρήστη",
    description: "Ολοκληρωμένος οδηγός χρήσης της πλατφόρμας Influo.",
    url: "/docs",
  },
  alternates: {
    canonical: "/docs",
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

