import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Εγγραφή Επιχείρησης | Influo",
  description: "Δωρεάν εγγραφή επιχείρησης στο Influo για αναζήτηση influencers και καμπάνιες.",
  path: "/brand/signup",
});

export default function BrandSignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
