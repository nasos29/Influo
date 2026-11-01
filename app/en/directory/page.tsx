import type { Metadata } from "next";
import DirectoryPage from "../../directory/page";

export const revalidate = 3600;

type Search = Promise<{ q?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const params = await searchParams;
  if ((params.q || "").trim()) {
    return { robots: { index: false, follow: true } };
  }
  return {};
}

export default function EnDirectoryPage() {
  return <DirectoryPage />;
}
