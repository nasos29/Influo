import { directoryEnMetadata } from "@/lib/directoryMetadata";

export const metadata = directoryEnMetadata;

export default function EnDirectoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
