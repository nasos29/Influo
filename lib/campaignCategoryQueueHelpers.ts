/** Pure helpers for campaign category mail queue (no Next/Supabase imports). */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** campaignId from queue key `campaignId:influencerId` or emailKey `campaignId:email`. */
export function campaignIdFromQueueKey(key: string): string | null {
  const id = String(key || "").split(":")[0] || "";
  return UUID_RE.test(id) ? id : null;
}

/** Group pending jobs by campaign id (dedupe by email within each campaign). */
export function groupCategoryQueueByCampaign(
  jobs: Array<{ key: string; emailKey?: string; to: string }>
): Map<string, { emails: string[]; jobKeys: string[] }> {
  const byCampaign = new Map<string, { emails: string[]; jobKeys: string[]; seen: Set<string> }>();
  for (const j of jobs) {
    const campaignId = campaignIdFromQueueKey(j.key) || campaignIdFromQueueKey(j.emailKey || "");
    if (!campaignId) continue;
    const email = (j.to || "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    let bucket = byCampaign.get(campaignId);
    if (!bucket) {
      bucket = { emails: [], jobKeys: [], seen: new Set() };
      byCampaign.set(campaignId, bucket);
    }
    bucket.jobKeys.push(j.key);
    if (!bucket.seen.has(email)) {
      bucket.seen.add(email);
      bucket.emails.push(email);
    }
  }
  const out = new Map<string, { emails: string[]; jobKeys: string[] }>();
  for (const [id, b] of byCampaign) out.set(id, { emails: b.emails, jobKeys: b.jobKeys });
  return out;
}
