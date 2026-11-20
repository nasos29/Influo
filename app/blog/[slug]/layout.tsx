import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLdScript from "@/components/JsonLdScript";
import { breadcrumbJsonLd } from "@/lib/breadcrumbJsonLd";
import { blogPostingJsonLd, blogPostMetadata } from "@/lib/blogSeo";
import { initialBlogPosts } from "@/lib/blogPosts";

export const revalidate = 86400;

type Params = Promise<{ slug: string }>;

export function generateStaticParams(): { slug: string }[] {
  return initialBlogPosts.map((post) => ({ slug: post.slug }));
}

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
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Αρχική", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: post.title.el, path: `/blog/${post.slug}` },
  ]);
  return (
    <>
      <JsonLdScript data={breadcrumbLd} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
