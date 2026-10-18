import { sharedCategoryKeys } from "./recommendations.ts";

export type AlertCandidate = {
  id: string;
  category?: string | null;
  approved?: boolean | null;
  availability_status?: string | null;
  auth_user_id?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function available(status: string | null | undefined): boolean {
  return !status || status === "available";
}

/** Approved, available creators in the campaign category. Unavailable profiles are skipped. */
export function campaignAlertTarget(
  row: AlertCandidate,
  category: string | null | undefined
): { id: string; authUserId: string } | null {
  if (!row.approved) return null;
  if (!available(row.availability_status)) return null;
  if (!category || sharedCategoryKeys(category, row.category).length === 0) return null;
  const authUserId = String(row.auth_user_id || row.id || "").trim();
  if (!UUID.test(authUserId) || !row.id) return null;
  return { id: String(row.id), authUserId };
}
