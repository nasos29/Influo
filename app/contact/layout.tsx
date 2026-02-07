import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Επικοινωνία",
  description: "Επικοινωνήστε μαζί μας για ερωτήσεις, προτάσεις ή υποστήριξη. Θα σας απαντήσουμε το συντομότερο δυνατό.",
  keywords: ["επικοινωνία", "contact", "support", "βοήθεια", "επαφή"],
  openGraph: {
    title: "Επικοινωνία",
    description: "Επικοινωνήστε μαζί μας για ερωτήσεις ή υποστήριξη.",
    url: "/contact",
  },
  alternates: {
    canonical: "/contact",
    languages: { el: "/contact", en: "/en/contact" },
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

