import type { Metadata } from "next";
import GetAppLanding from "@/components/GetAppLanding";

export const metadata: Metadata = {
  title: "Εγκατάσταση app — Influo",
  robots: { index: true, follow: true },
};

export default function GetAppPage() {
  return <GetAppLanding lang="el" />;
}
