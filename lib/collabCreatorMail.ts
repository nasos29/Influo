import { isCollabEmailExcludedInfluencer } from "@/lib/collabEmailExclusion";
import { sendChecked } from "@/lib/proposalMail";
import { sendTransactional } from "@/lib/transactionalEmail";

/** Skip creator-facing collaboration emails (Maria Palli hard exclusion). */
export function creatorCollabEmailBlocked(influencerId: string | null | undefined): boolean {
  return isCollabEmailExcludedInfluencer(influencerId);
}

export async function sendCheckedCreator(
  influencerId: string | null | undefined,
  type: string,
  to: string | null | undefined,
  subject: string,
  html: string,
  opts?: { recipientId?: string | null; dealRef?: string | null; party?: string | null }
): Promise<"ok" | "quota" | "error" | "skipped"> {
  if (creatorCollabEmailBlocked(influencerId)) return "skipped";
  return sendChecked(type, to, subject, html, opts);
}

export async function sendTransactionalCreator(
  influencerId: string | null | undefined,
  type: string,
  to: string | null | undefined,
  subject: string,
  html: string,
  opts?: { recipientId?: string | null }
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (creatorCollabEmailBlocked(influencerId)) return { ok: false, skipped: true };
  const result = await sendTransactional(to, subject, html, { type, recipientId: opts?.recipientId });
  return result;
}