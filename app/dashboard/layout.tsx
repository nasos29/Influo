import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Πίνακας ελέγχου | Influo",
  description: "Ιδιωτικός πίνακας ελέγχου Influo.",
  path: "/dashboard",
  index: false,
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
