import type { Metadata } from "next";
import BlogPostPage from "../../../blog/[slug]/page";
import { initialBlogPosts } from "@/lib/blogPosts";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = initialBlogPosts.find((p) => p.slug === slug);
  const title = post?.title?.en ?? "Blog Post";
  const description = post?.excerpt?.en ?? "Read this article on Influo.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/en/blog/${slug}`,
    },
    alternates: {
      canonical: `/en/blog/${slug}`,
      languages: { el: `/blog/${slug}`, en: `/en/blog/${slug}` },
    },
  };
}

export default function EnBlogPostPage(props: Props) {
  return <BlogPostPage params={props.params} />;
}
