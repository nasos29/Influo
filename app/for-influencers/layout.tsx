import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Για Influencers - Συνδέστε το Ταλέντο σας",
  description: "Δημιουργήστε το επαγγελματικό σας προφίλ, λάβετε προσφορές από brands και κλείστε συνεργασίες. Η πιο σύγχρονη πλατφόρμα influencer marketing στην Ελλάδα.",
  keywords: ["για influencers", "for influencers", "εγγραφή influencer", "influencer platform", "συνεργασίες brands"],
  openGraph: {
    title: "Για Influencers - Συνδέστε το Ταλέντο σας",
    description: "Δημιουργήστε το επαγγελματικό σας προφίλ και κλείστε συνεργασίες με brands.",
    url: "/for-influencers",
  },
  alternates: {
    canonical: "/for-influencers",
    languages: { el: "/for-influencers", en: "/en/for-influencers" },
  },
};

export default function ForInfluencersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

