import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Επαναφορά κωδικού | Influo",
  description: "Επαναφορά κωδικού λογαριασμού Influo.",
  path: "/reset-password",
  index: false,
});

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
