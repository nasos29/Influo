import { formatEuro, formatEuroAmount } from "@/lib/formatEuro";

/**
 * Exact service amount for every viewer: "40 €" or "90 € / φωτογραφία".
 * Uses the price string when present, otherwise the public from_price.
 * Never prefixes «Από» and never reads min_rate.
 */
export function offerPriceLabel(input: {
  price?: string | null;
  fromPrice?: number | null;
  suffix?: string | null;
  lang: "el" | "en";
}): string | null {
  const fromAmount =
    input.fromPrice != null && input.fromPrice > 0 ? formatEuro(input.fromPrice, input.lang) : "";
  const amount = input.price ? formatEuroAmount(input.price, input.lang) || fromAmount : fromAmount;
  if (!amount) return null;
  return input.suffix ? `${amount} ${input.suffix}` : amount;
}
