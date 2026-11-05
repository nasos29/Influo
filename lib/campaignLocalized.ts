/** Pick Greek source or stored English translation based on UI language. */
export function campaignField(
  primary: string | null | undefined,
  english: string | null | undefined,
  lang: "el" | "en"
): string {
  if (lang === "en" && typeof english === "string" && english.trim()) return english.trim();
  return (primary || "").trim();
}

export type CampaignLocalizedSource = {
  title?: string | null;
  title_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  deliverables?: string | null;
  deliverables_en?: string | null;
};

export function localizeCampaignCopy<T extends CampaignLocalizedSource>(
  campaign: T,
  lang: "el" | "en"
): T & { title: string; description: string; deliverables: string | null } {
  return {
    ...campaign,
    title: campaignField(campaign.title, campaign.title_en, lang),
    description: campaignField(campaign.description, campaign.description_en, lang),
    deliverables: (() => {
      const value = campaignField(campaign.deliverables, campaign.deliverables_en, lang);
      return value || null;
    })(),
  };
}
