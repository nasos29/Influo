import type { Metadata } from "next";
import DirectoryMain from "./DirectoryMain";
import { directoryPageMetadata } from "@/lib/directoryMetadata";

export const revalidate = 3600;

type Props = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return directoryPageMetadata("el", q);
}

export default async function DirectoryPage() {
  return <DirectoryMain lang="el" />;
}