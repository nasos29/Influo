import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Help Desk | Influo",
  description: "Ιδιωτική υποστήριξη λογαριασμού Influo.",
  path: "/help-desk",
  index: false,
});

export default function HelpDeskLayout({ children }: { children: React.ReactNode }) {
  return children;
}
