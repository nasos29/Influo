function textField(row: Record<string, unknown> | null | undefined, key: string): string {
  const value = row?.[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Creator photo wins over the brand logo. Name falls back to email for initials. */
export function accountAvatarFromProfiles(input: {
  email?: string;
  influencer?: Record<string, unknown> | null;
  brand?: Record<string, unknown> | null;
}): { avatarUrl: string; avatarName: string } {
  const influencerName = textField(input.influencer, "display_name");
  const brandName = textField(input.brand, "brand_name");
  const influencerAvatar = textField(input.influencer, "avatar_url");
  const brandLogo = textField(input.brand, "logo_url");
  return {
    avatarUrl: influencerAvatar || brandLogo,
    avatarName: influencerName || brandName || (input.email || "").trim(),
  };
}
