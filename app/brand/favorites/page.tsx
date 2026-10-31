import { redirect } from "next/navigation";

/** Legacy path → brand dashboard shortlist (“favorites”) tab. */
export default function BrandFavoritesRedirectPage() {
  redirect("/brand/dashboard?tab=shortlist");
}
