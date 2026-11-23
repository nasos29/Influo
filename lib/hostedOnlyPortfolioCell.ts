import type { PortfolioLinkUiPhase } from "@/lib/portfolioHosted";

export type HostedOnlyPortfolioCell = "hosted" | "pending" | "hide" | "legacy";

/** Public profile portfolio grid: hosted-only creators never fall back to embeds. */
export function hostedOnlyPortfolioCell(args: {
  igTikTokHostedOnly: boolean;
  provider: string | null | undefined;
  hasHostedMedia: boolean;
  linkPhase: PortfolioLinkUiPhase;
}): HostedOnlyPortfolioCell {
  const provider = args.provider;
  const isIgTt = provider === "instagram" || provider === "tiktok";
  if (args.hasHostedMedia) return "hosted";
  if (!args.igTikTokHostedOnly || !isIgTt) return "legacy";
  if (args.linkPhase === "failed") return "hide";
  return "pending";
}