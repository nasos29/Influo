import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Διαχείριση | Influo",
  description: "Ιδιωτική διαχείριση Influo.",
  path: "/admin",
  index: false,
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
