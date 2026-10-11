import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogPostingJsonLd, blogPostMetadata } from "@/lib/blogSeo";
import { initialBlogPosts } from "@/lib/blogPosts";

export const revalidate = 86400;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = initialBlogPosts.find((item) => item.slug === slug);
  if (!post) return { title: { absolute: "Άρθρο δεν βρέθηκε | Influo" }, robots: { index: false, follow: false } };
  return blogPostMetadata(post, "el");
}

export default async function BlogPostLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { slug } = await params;
  const post = initialBlogPosts.find((item) => item.slug === slug);
  if (!post) notFound();
  const jsonLd = blogPostingJsonLd(post, "el");
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
