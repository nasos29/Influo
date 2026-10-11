import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Σύνδεση επιχείρησης | Influo",
  description: "Σύνδεση λογαριασμού επιχείρησης στο Influo.",
  path: "/brand/login",
  index: false,
});

export default function BrandLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
