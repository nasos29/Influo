import JsonLdScript from "@/components/JsonLdScript";
import { breadcrumbJsonLd } from "@/lib/breadcrumbJsonLd";
import { directoryEnMetadata } from "@/lib/directoryMetadata";

export const metadata = directoryEnMetadata;

const breadcrumbLd = breadcrumbJsonLd([
  { name: "Home", path: "/en" },
  { name: "Influencer Directory", path: "/en/directory" },
]);

export default function EnDirectoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLdScript data={breadcrumbLd} />
      {children}
    </>
  );
}
