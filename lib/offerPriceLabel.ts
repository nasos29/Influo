import { formatEuroAmount } from "@/lib/formatEuro";
import { formatFromPriceLabel } from "@/lib/publicInfluencer";

/**
 * Exact service amount for every viewer: "120 €".
 * When the row has no price string, fall back to the guest «Από X €» label
 * built from `from_price`. This never reads min_rate.
 */
export function offerPriceLabel(input: {
  price?: string | null;
  fromPrice?: number | null;
  suffix?: string | null;
  lang: "el" | "en";
}): string | null {
  if (input.price) {
    const amount = formatEuroAmount(input.price, input.lang);
    if (amount) return input.suffix ? `${amount} ${input.suffix}` : amount;
  }
  return formatFromPriceLabel(input.fromPrice, input.lang);
}
