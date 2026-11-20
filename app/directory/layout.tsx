import JsonLdScript from "@/components/JsonLdScript";
import { breadcrumbJsonLd } from "@/lib/breadcrumbJsonLd";
import { directoryElMetadata } from "@/lib/directoryMetadata";

export const metadata = directoryElMetadata;

const breadcrumbLd = breadcrumbJsonLd([
  { name: "Αρχική", path: "/" },
  { name: "Κατάλογος Δημιουργών", path: "/directory" },
]);

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLdScript data={breadcrumbLd} />
      {children}
    </>
  );
}
