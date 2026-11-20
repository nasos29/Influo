import { absoluteUrl } from "@/lib/site";

export type BreadcrumbItem = { name: string; path?: string };

export function breadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: absoluteUrl(item.path) } : {}),
    })),
  };
}

export function safeJsonLdStringify(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}