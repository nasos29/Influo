import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin, userFromBearer } from "@/lib/apiAuth";
import { SITE_SETTING_META, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import { HOMEPAGE_SECTION_ORDER_KEY, HOMEPAGE_SECTION_REGISTRY } from "@/lib/homepageSections";
import {
  HOMEPAGE_FEATURED_COLLABORATIONS_KEY,
  featuredCollaborationSlotsFromConfig,
} from "@/lib/homepageFeaturedCollaborations";
import { HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO_KEY } from "@/lib/homepageBrandCtaDecorativePhoto";
import {
  getSiteSettings,
  getHomepageSectionOrderSetting,
  getHomepageFeaturedCollaborationsSetting,
  getHomepageBrandCtaDecorativePhotoSetting,
  resetSiteSetting,
  resetHomepageSectionOrder,
  resetHomepageFeaturedCollaborationsSetting,
  resetHomepageBrandCtaDecorativePhotoSetting,
  updateSiteSetting,
  updateHomepageSectionOrder,
  updateHomepageFeaturedCollaborationsSetting,
  updateHomepageBrandCtaDecorativePhotoSetting,
} from "@/lib/siteSettingsServer";

export const runtime = "nodejs";

/** Admin: full settings + metadata + homepage section order registry. */
export async function GET(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  const [settings, sectionOrder, featuredCollaborations, decorativePhoto] = await Promise.all([
    getSiteSettings(),
    getHomepageSectionOrderSetting(),
    getHomepageFeaturedCollaborationsSetting(),
    getHomepageBrandCtaDecorativePhotoSetting(),
  ]);
  return NextResponse.json({
    settings,
    meta: SITE_SETTING_KEYS.map((key) => SITE_SETTING_META[key]),
    homepage_section_order: sectionOrder.order,
    homepage_section_hidden: sectionOrder.hidden,
    homepage_sections: HOMEPAGE_SECTION_REGISTRY,
    homepage_featured_collaborations: featuredCollaborations,
    homepage_featured_collaboration_slots: featuredCollaborationSlotsFromConfig(featuredCollaborations),
    homepage_brand_cta_decorative_photo: decorativePhoto,
  });
}

/**
 * Admin: update one numeric key `{ key, value }` / reset `{ key, reset: true }`,
 * or homepage section order `{ key: "homepage_section_order", value: string[], hidden?: string[] }`.
 */
export async function PATCH(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  let body: {
    key?: unknown;
    value?: unknown;
    hidden?: unknown;
    reset?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key : "";
  const user = await userFromBearer(request);
  const updatedBy = user?.id ?? null;

  if (key === HOMEPAGE_SECTION_ORDER_KEY) {
    const result =
      body.reset === true
        ? await resetHomepageSectionOrder(updatedBy)
        : await updateHomepageSectionOrder(body.value, body.hidden ?? [], updatedBy);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      settings: result.settings,
      homepage_section_order: result.order,
      homepage_section_hidden: result.hidden,
    });
  }

  if (key === HOMEPAGE_FEATURED_COLLABORATIONS_KEY) {
    const result =
      body.reset === true
        ? await resetHomepageFeaturedCollaborationsSetting(updatedBy)
        : await updateHomepageFeaturedCollaborationsSetting(body.value, updatedBy);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const config = result.homepage_featured_collaborations!;
    return NextResponse.json({
      ok: true,
      homepage_featured_collaborations: config,
      homepage_featured_collaboration_slots: featuredCollaborationSlotsFromConfig(config),
    });
  }

  if (key === HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO_KEY) {
    const result =
      body.reset === true
        ? await resetHomepageBrandCtaDecorativePhotoSetting(updatedBy)
        : await updateHomepageBrandCtaDecorativePhotoSetting(body.value, updatedBy);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      homepage_brand_cta_decorative_photo: result.homepage_brand_cta_decorative_photo,
    });
  }

  const result =
    body.reset === true
      ? await resetSiteSetting(key, updatedBy)
      : await updateSiteSetting(key, body.value, updatedBy);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, settings: result.settings });
}
