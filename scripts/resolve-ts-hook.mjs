export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    const withExt = /\.[a-z]+$/i.test(rel) ? rel : `${rel}.ts`;
    const url = new URL(`../${withExt}`, import.meta.url);
    return nextResolve(url.href, context);
  }
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasExt = /\.[a-z]+$/i.test(specifier);
  if (relative && !hasExt) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
}
