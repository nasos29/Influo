import { pageMetadata } from "@/lib/pageMetadata";

export const metadata = pageMetadata({
  title: "Καμπάνιες και πληρωμένες συνεργασίες για creators | Influo",
  description:
    "Δημιούργησε δωρεάν προφίλ, δες ανοιχτές καμπάνιες brands και κλείσε συνεργασίες στην Ελλάδα — με διαχείριση και προστασία πληρωμής στο Influo.",
  path: "/for-influencers",
  enPath: "/en/for-influencers",
});

export default function ForInfluencersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
