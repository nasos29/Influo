/**
 * Hard exclusions for collaboration-related emails (review, deliverable reminders,
 * auto-complete notices about past deals). Μαρία Πάλλη must never get emails about
 * her past collaborations after the account-restore incident.
 */

/** Influencers.id for Μαρία Πάλλη — single source of truth for exclusion. */
export const PALLI_INFLUENCER_ID = "7b2b6165-36ce-4fe8-a386-2db73774bac9";

const EXTRA_EXCLUDED = (process.env.COLLAB_EMAIL_EXCLUDED_INFLUENCER_IDS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const EXCLUDED = new Set<string>([PALLI_INFLUENCER_ID.toLowerCase(), ...EXTRA_EXCLUDED]);

/** True when this influencer must never receive collab/review reminder emails. */
export function isCollabEmailExcludedInfluencer(
  influencerId: string | null | undefined
): boolean {
  const id = String(influencerId || "")
    .trim()
    .toLowerCase();
  if (!id) return false;
  return EXCLUDED.has(id);
}
