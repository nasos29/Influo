export type AdminCampaignApplication = {
  id: string;
  campaign_id: string;
  influencer_id: string;
  status: string;
  message: string | null;
  proposed_price: number | null;
  work_links: string | null;
  created_at: string;
  deliverable_url?: string | null;
  deliverable_note?: string | null;
  deliverable_status?: string | null;
  deliverable_review_note?: string | null;
  influencers:
    | { display_name: string | null; avatar_url: string | null }
    | Array<{ display_name: string | null; avatar_url: string | null }>
    | null;
};

export type AdminCampaignBrand = {
  brand_name: string | null;
  contact_email: string | null;
  verified: boolean | null;
  logo_url?: string | null;
};

export type AdminBrandCampaign = {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  budget: number;
  category: string | null;
  status: string;
  deadline: string | null;
  platforms?: string[] | string | null;
  compensation_type?: string | null;
  deliverables?: string | null;
  location?: string | null;
  starts_on?: string | null;
  min_followers?: number | null;
  cover_url?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  auto_closed?: boolean | null;
  created_at: string;
  updated_at: string;
  applications?: AdminCampaignApplication[];
  applications_count?: number;
  brands: AdminCampaignBrand | AdminCampaignBrand[] | null;
};

export function getApplicationInfluencerMeta(app: AdminCampaignApplication): {
  name: string;
  avatar: string | null;
} {
  const raw = app.influencers;
  const row = Array.isArray(raw) ? raw[0] : raw;
  return {
    name: row?.display_name?.trim() || app.influencer_id,
    avatar: row?.avatar_url || null,
  };
}

export function getCampaignBrandMeta(row: AdminBrandCampaign): {
  name: string;
  email: string | null;
  verified: boolean;
  logo: string | null;
} {
  const brand = row.brands;
  if (!brand) return { name: "—", email: null, verified: false, logo: null };
  const rowBrand = Array.isArray(brand) ? brand[0] : brand;
  return {
    name: rowBrand?.brand_name ?? "—",
    email: rowBrand?.contact_email ?? null,
    verified: !!rowBrand?.verified,
    logo: rowBrand?.logo_url ?? null,
  };
}
