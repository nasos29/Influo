/** PATCH payload for /api/collaborations/tracking — brand sets promo/utm; creator sets spark only. */
export function collabTrackingSavePayload(
  isBrand: boolean,
  fields: { promo: string; utm: string; spark: string }
): Record<string, string> {
  if (isBrand) {
    return { promoCode: fields.promo, utmLink: fields.utm };
  }
  return { sparkAdsCode: fields.spark };
}