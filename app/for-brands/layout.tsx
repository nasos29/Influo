import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Για Brands - Βρείτε Influencers",
  description: "Βρείτε τους καλύτερους influencers για την εταιρεία σας. Αναζητήστε, επικοινωνήστε και συνεργαστείτε με verified creators. 🤖 Λάβετε AI-powered προτάσεις δωρεάν!",
  keywords: ["για brands", "for brands", "influencer marketing brands", "βρες influencers", "συνεργασία με influencers"],
  openGraph: {
    title: "Για Brands - Βρείτε Influencers",
    description: "Βρείτε τους καλύτερους influencers για την εταιρεία σας με AI-powered προτάσεις.",
    url: "/for-brands",
  },
  alternates: {
    canonical: "/for-brands",
  },
};

export default function ForBrandsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

