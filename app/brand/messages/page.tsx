import { redirect } from "next/navigation";

/** Legacy path → brand dashboard messages tab. */
export default function BrandMessagesRedirectPage() {
  redirect("/brand/dashboard?tab=messages");
}
