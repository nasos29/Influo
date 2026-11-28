export const MAX_UGC_DRAFT_REVISION_ROUNDS = 2;
export const MAX_CLASSIC_LINK_REVISION_ROUNDS = 1;

export type DraftReviewAction = "request_changes";

/** Whether the brand may request another draft revision round. */
export function canRequestDraftChanges(
  isUgc: boolean,
  revisionCount: number,
  draftStatus: string | null | undefined
): boolean {
  const status = String(draftStatus || "").toLowerCase();
  if (status !== "submitted") return false;
  const max = isUgc ? MAX_UGC_DRAFT_REVISION_ROUNDS : MAX_CLASSIC_LINK_REVISION_ROUNDS;
  return revisionCount < max;
}

/** Increment revision count when brand requests draft changes. */
export function nextDraftRevisionCount(current: number): number {
  return Math.max(0, Math.floor(current)) + 1;
}