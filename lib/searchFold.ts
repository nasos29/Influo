/**
 * One latin key for directory search.
 * Accents are ignored. Greek and common greeklish spellings fold to the same key
 * (η/ι/υ/ει/οι → i, ω/ο → o, θ → th, 8 as a letter → th, χ → x via ch/x/h,
 * ψ → ps, ξ → x via ks/x, β → b via v/b, μπ → b via mp, ντ → d via nt,
 * γκ → g via gk, ου → u via ou, αι → e via ai).
 */

const GREEK_DIGIT: Record<string, string> = {
  α: "a",
  β: "b",
  γ: "g",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "i",
  θ: "th",
  ι: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  τ: "t",
  υ: "i",
  φ: "f",
  χ: "x",
  ψ: "ps",
  ω: "o",
};

function replaceAll(value: string, from: string, to: string): string {
  return value.split(from).join(to);
}

export function searchFold(value: string): string {
  let text = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ς/g, "σ");
  text = text.replace(/(?<!\d)8(?!\d)/g, "θ");

  for (const [from, to] of [
    ["μπ", "b"],
    ["ντ", "d"],
    ["γκ", "g"],
    ["γγ", "g"],
    ["ου", "u"],
    ["αι", "e"],
    ["ει", "i"],
    ["οι", "i"],
  ] as const) {
    text = replaceAll(text, from, to);
  }

  text = [...text].map((ch) => GREEK_DIGIT[ch] ?? ch).join("");

  text = replaceAll(text, "th", "\u0001");
  text = replaceAll(text, "ch", "x");
  text = replaceAll(text, "h", "x");
  text = replaceAll(text, "\u0001", "th");
  text = replaceAll(text, "ks", "x");
  text = text.replace(/v/g, "b");
  text = text.replace(/y/g, "i");

  for (const [from, to] of [
    ["mp", "b"],
    ["nt", "d"],
    ["gk", "g"],
    ["ou", "u"],
    ["ai", "e"],
    ["ei", "i"],
    ["oi", "i"],
  ] as const) {
    text = replaceAll(text, from, to);
  }

  return text.replace(/[^a-z0-9θ]+/g, " ").replace(/\s+/g, " ").trim().replace(/θ/g, "th");
}

/** True when the query appears in the field after the same fold. */
export function searchIncludes(field: string, query: string): boolean {
  const needle = searchFold(query);
  if (!needle) return true;
  return searchFold(field).includes(needle);
}
