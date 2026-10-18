import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Open brand campaigns | Influo" },
  description: "Open campaigns from verified brands. Approved influencers can apply.",
};

export default function EnCampaignsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
