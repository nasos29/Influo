import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Ανοιχτές καμπάνιες brands | Influo" },
  description: "Ανοιχτές καμπάνιες από επαληθευμένα brands. Οι εγκεκριμένοι influencers μπορούν να κάνουν αίτηση.",
};

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
