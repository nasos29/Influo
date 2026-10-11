import type { Metadata } from "next";
import type { BlogPost } from "@/lib/blogPosts";
import { absoluteUrl, languageAlternates, SITE_NAME, SITE_URL } from "@/lib/site";

export function blogPostMetadata(post: BlogPost, lang: "el" | "en"): Metadata {
  const path = lang === "en" ? `/en/blog/${post.slug}` : `/blog/${post.slug}`;
  const title = `${post.title[lang]} | Influo`;
  const description = post.excerpt[lang];
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: path,
      languages: languageAlternates(`/blog/${post.slug}`, `/en/blog/${post.slug}`),
    },
    openGraph: {
      type: "article",
      url: absoluteUrl(path),
      title,
      description,
      locale: lang === "en" ? "en_US" : "el_GR",
      siteName: SITE_NAME,
      images: post.image ? [{ url: post.image, alt: post.title[lang] }] : undefined,
    },
  };
}

export function blogPostingJsonLd(post: BlogPost, lang: "el" | "en"): Record<string, unknown> {
  const path = lang === "en" ? `/en/blog/${post.slug}` : `/blog/${post.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title[lang],
    description: post.excerpt[lang],
    datePublished: post.date,
    inLanguage: lang,
    image: post.image,
    mainEntityOfPage: absoluteUrl(path),
    url: absoluteUrl(path),
    author: { "@type": "Organization", name: "Influo", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Influo",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo-512.png` },
    },
  };
}
