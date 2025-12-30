import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Όροι Χρήσης | Influo.gr",
  description: "Διαβάστε τους όρους χρήσης της πλατφόρμας Influo.gr. Κατανοήστε τα δικαιώματα και τις υποχρεώσεις σας ως χρήστης.",
  keywords: ["όροι χρήσης", "terms of service", "terms and conditions", "χρήση πλατφόρμας"],
  openGraph: {
    title: "Όροι Χρήσης | Influo.gr",
    description: "Διαβάστε τους όρους χρήσης της πλατφόρμας Influo.gr.",
    url: "/terms",
  },
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

