/**
 * Live showcase appearance notify was removed (2026-11-16 follow-up).
 * Notice + opt-out now live inside existing transactional emails when consent is true.
 * Kept as a no-op so older call sites / flags stay harmless.
 */

/** @deprecated No-op — inline notice is embedded in existing emails instead. */
export async function maybeNotifyShowcaseAppearance(_input: {
  source: "proposal" | "campaign";
  id: string;
  brandName: string;
  brandEmail: string | null | undefined;
  influencerId: string;
  collabLabel: string;
}): Promise<{ sent: number; skipped: string }> {
  return { sent: 0, skipped: "disabled_inline_notice" };
}
