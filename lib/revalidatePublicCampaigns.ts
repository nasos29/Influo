import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

function expireNow() {
  for (const tag of ["home-campaigns", "public-campaigns"]) revalidateTag(tag, { expire: 0 });
  for (const path of ["/", "/en", "/campaigns", "/en/campaigns"]) revalidatePath(path);
}

/**
 * Expire cached public campaign lists (home + /campaigns) so card counts match the campaign page.
 * Runs again a few seconds later: a regeneration already in flight (e.g. from a publish just before)
 * could otherwise store the older count after our first expiry.
 */
export function revalidatePublicCampaigns() {
  try {
    expireNow();
  } catch (err) {
    console.warn("[revalidate campaigns]", err instanceof Error ? err.message : err);
  }
  try {
    after(async () => {
      await new Promise((r) => setTimeout(r, 6000));
      try {
        expireNow();
      } catch (err) {
        console.warn("[revalidate campaigns] delayed", err instanceof Error ? err.message : err);
      }
    });
  } catch {
    /* outside a request scope */
  }
}
