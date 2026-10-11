import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Πίνακας επιχείρησης | Influo",
  description: "Ιδιωτικός πίνακας επιχείρησης στο Influo.",
  path: "/brand/dashboard",
  index: false,
});

export default function BrandDashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
