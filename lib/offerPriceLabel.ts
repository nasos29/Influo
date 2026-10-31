import { formatEuro } from "@/lib/formatEuro";
import { formatListedPrice, formatPriceSpan } from "@/lib/parsePrice";

/**
 * Service amount for every viewer: "40 €", "30–100 €", or "90 € / φωτογραφία".
 * A stored range keeps both ends. A single amount is the number only, never «Από».
 * Uses the price string when present, otherwise from_price / price_max.
 * Never reads min_rate.
 */
export function offerPriceLabel(input: {
  price?: string | null;
  fromPrice?: number | null;
  priceMax?: number | null;
  suffix?: string | null;
  lang: "el" | "en";
}): string | null {
  const listed = input.price ? formatListedPrice(input.price, input.lang) : "";
  const span =
    !listed &&
    input.fromPrice != null &&
    input.priceMax != null &&
    input.priceMax > input.fromPrice
      ? formatPriceSpan(input.fromPrice, input.priceMax, input.lang)
      : "";
  const fromAmount =
    input.fromPrice != null && input.fromPrice > 0 ? formatEuro(input.fromPrice, input.lang) : "";
  const amount = listed || span || fromAmount;
  if (!amount) return null;
  return input.suffix ? `${amount} ${input.suffix}` : amount;
}
