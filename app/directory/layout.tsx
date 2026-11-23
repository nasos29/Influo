import JsonLdScript from "@/components/JsonLdScript";
import { breadcrumbJsonLd } from "@/lib/breadcrumbJsonLd";
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
