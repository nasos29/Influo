import type { Metadata } from "next";
import DirectoryMain from "../../directory/DirectoryMain";
import { directoryPageMetadata } from "@/lib/directoryMetadata";

export const revalidate = 3600;

type Props = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return directoryPageMetadata("en", q);
}

export default async function EnDirectoryPage() {
  return <DirectoryMain lang="en" />;
}