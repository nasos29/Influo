import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogPostPage from "../../../blog/[slug]/page";
import { blogPostingJsonLd, blogPostMetadata } from "@/lib/blogSeo";
import { initialBlogPosts } from "@/lib/blogPosts";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = initialBlogPosts.find((item) => item.slug === slug);
  if (!post) return { title: { absolute: "Article not found | Influo" }, robots: { index: false, follow: false } };
  return blogPostMetadata(post, "en");
}

export default async function EnBlogPostPage(props: Props) {
  const { slug } = await props.params;
  const post = initialBlogPosts.find((item) => item.slug === slug);
  if (!post) notFound();
  const jsonLd = blogPostingJsonLd(post, "en");
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <BlogPostPage params={props.params} />
    </>
  );
}
