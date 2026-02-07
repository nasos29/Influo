import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Κατάλογος Επιχειρήσεων',
  description: 'Ανακαλύψτε επαληθευμένες επιχειρήσεις που συνεργάζονται με influencers. Επικοινωνήστε με κορυφαία brands για συνεργασίες.',
  keywords: 'επιχειρήσεις, brands, καταλογος, verified companies, influencer marketing, συνεργασίες',
  openGraph: {
    title: 'Κατάλογος Επιχειρήσεων',
    description: 'Ανακαλύψτε επαληθευμένες επιχειρήσεις που συνεργάζονται με influencers.',
    url: 'https://www.influo.gr/brands',
    siteName: 'Influo.gr',
    locale: 'el_GR',
    type: 'website',
  },
  alternates: {
    canonical: "/brands",
    languages: { el: "/brands", en: "/en/brands" },
  },
};

export default function BrandsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

