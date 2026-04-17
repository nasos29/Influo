import type { Metadata } from "next";
import GetAppLanding from "@/components/GetAppLanding";

export const metadata: Metadata = {
  title: "Install app — Influo",
  robots: { index: true, follow: true },
};

export default function EnGetAppPage() {
  return <GetAppLanding lang="en" />;
}
