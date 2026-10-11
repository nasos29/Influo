import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Αποσύνδεση | Influo",
  description: "Αποσύνδεση από το Influo.",
  path: "/logout",
  index: false,
});

export default function LogoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
