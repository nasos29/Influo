import { revalidatePath, revalidateTag } from "next/cache";

/** Expire cached public campaign lists (home + /campaigns) so card counts match the campaign page. */
export function revalidatePublicCampaigns() {
  try {
    for (const tag of ["home-campaigns", "public-campaigns"]) revalidateTag(tag, { expire: 0 });
    for (const path of ["/", "/en", "/campaigns", "/en/campaigns"]) revalidatePath(path);
  } catch (err) {
    console.warn("[revalidate campaigns]", err instanceof Error ? err.message : err);
  }
}
