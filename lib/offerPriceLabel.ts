import { formatEuroAmount } from "@/lib/formatEuro";
import { formatFromPriceLabel } from "@/lib/publicInfluencer";

/**
 * Exact service amount for every viewer. The euro sign sits after the number.
 * A tier label is only a fallback when the package has no concrete price.
 * This never reads min_rate.
 */
export function offerPriceLabel(input: {
  price?: string | null;
  priceTier?: string | null;
  suffix?: string | null;
  lang: "el" | "en";
}): string | null {
  if (input.price) {
    const amount = formatEuroAmount(input.price, input.lang);
    if (amount) return input.suffix ? `${amount} ${input.suffix}` : amount;
  }
  return formatFromPriceLabel(input.priceTier, input.lang);
}
