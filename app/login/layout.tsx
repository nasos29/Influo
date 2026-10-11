import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Σύνδεση | Influo",
  description: "Σύνδεση στον λογαριασμό σας στο Influo.",
  path: "/login",
  index: false,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
