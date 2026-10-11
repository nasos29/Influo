import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Μηνύματα | Influo",
  description: "Ιδιωτικά μηνύματα λογαριασμού Influo.",
  path: "/messages",
  index: false,
});

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
