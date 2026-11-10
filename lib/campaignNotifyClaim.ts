import { supabaseService } from "@/lib/apiAuth";

/**
 * Durable publish-notify claim. Inserts (campaign_id, opened_at, channel) into
 * campaign_notify_log; unique constraint makes a second process/restart a no-op.
 * Returns true when this caller owns the send.
 */
export async function claimCampaignNotify(
  campaignId: string,
  openedAt: string,
  channel: string
): Promise<boolean> {
  const opened = openedAt.trim();
  const ch = channel.trim().slice(0, 64);
  if (!campaignId || !opened || !ch) return false;
  try {
    const { error } = await supabaseService().from("campaign_notify_log").insert({
      campaign_id: campaignId,
      opened_at: opened,
      channel: ch,
    });
    if (!error) return true;
    // Unique violation → already claimed.
    if (error.code === "23505") return false;
    // Table missing / schema cache: fall through to in-process Set (caller still has that).
    if (/campaign_notify_log|PGRST205|42P01|schema cache/i.test(error.message || "")) {
      console.warn("[campaign notify claim] table unavailable, falling back to process Set", error.message);
      return true;
    }
    console.error("[campaign notify claim]", error.code, error.message);
    // Fail open so creators still get notified if logging is broken.
    return true;
  } catch (err) {
    console.error("[campaign notify claim]", err instanceof Error ? err.message : err);
    return true;
  }
}
