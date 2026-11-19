/** Deep link creator dashboard → Messages with an open conversation. */
export function creatorCampaignBrandMessagesHref(conversationId: string): string {
  return `/dashboard?tab=messages&conversation=${encodeURIComponent(conversationId)}`;
}