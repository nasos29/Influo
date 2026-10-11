export type InfluencerPresenceRow = {
  influencer_id?: string | null;
  is_online?: boolean | null;
  last_seen?: string | null;
};

export type BrandPresenceRow = {
  brand_email?: string | null;
  is_online?: boolean | null;
  last_seen?: string | null;
};

/**
 * Keep a presence row only when it is the requested influencer.
 * In brand view, the viewer's own auth id is never the other party.
 */
export function counterpartyInfluencerPresence<T extends InfluencerPresenceRow>(
  requestedId: string,
  row: T | null | undefined,
  viewerUserId?: string | null
): T | null {
  if (!requestedId || !row?.influencer_id) return null;
  if (row.influencer_id !== requestedId) return null;
  if (viewerUserId && requestedId === viewerUserId) return null;
  return row;
}

/** Keep a brand presence row only when the email is the requested counterparty. */
export function counterpartyBrandPresence<T extends BrandPresenceRow>(
  requestedEmail: string,
  row: T | null | undefined
): T | null {
  if (!row?.brand_email) return null;
  const wanted = requestedEmail.toLowerCase().trim();
  const got = row.brand_email.toLowerCase().trim();
  if (!wanted || wanted !== got) return null;
  return row;
}
