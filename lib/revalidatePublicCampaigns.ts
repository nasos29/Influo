import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

function expireNow(campaignId?: string) {
  const tags = ["home-campaigns", "public-campaigns"];
  if (campaignId) tags.push(`campaign-${campaignId}`);
  for (const tag of tags) revalidateTag(tag, { expire: 0 });

  const paths = ["/", "/en", "/campaigns", "/en/campaigns"];
  if (campaignId) {
    paths.push(`/campaigns/${campaignId}`, `/en/campaigns/${campaignId}`);
  }
  for (const path of paths) revalidatePath(path);
}

/**
 * Expire cached public campaign lists (home + /campaigns) and, when known, the
 * campaign detail pages so applications_count matches live rows.
 * Runs again a few seconds later: a regeneration already in flight (e.g. from a
 * publish just before) could otherwise store the older count after our first expiry.
 */
export function revalidatePublicCampaigns(campaignId?: string) {
  try {
    expireNow(campaignId);
  } catch (err) {
    console.warn("[revalidate campaigns]", err instanceof Error ? err.message : err);
  }
  try {
    after(async () => {
      await new Promise((r) => setTimeout(r, 6000));
      try {
        expireNow(campaignId);
      } catch (err) {
        console.warn("[revalidate campaigns] delayed", err instanceof Error ? err.message : err);
      }
    });
  } catch {
    /* outside a request scope */
  }
}
