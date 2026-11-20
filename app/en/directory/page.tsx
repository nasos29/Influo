import type { Metadata } from "next";
import DirectoryPage from "../../directory/page";
import { directoryEnMetadata } from "@/lib/directoryMetadata";

export const revalidate = 3600;

type Search = Promise<{ q?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const params = await searchParams;
  if ((params.q || "").trim()) {
    return { ...directoryEnMetadata, robots: { index: false, follow: true } };
  }
  return directoryEnMetadata;
}

export default function EnDirectoryPage() {
  return <DirectoryPage />;
}
