import BlogPageFrame from "@/components/BlogPageFrame";
import { getBlogPostsForIndex } from "@/lib/blogPosts";

export default function EnBlogPage() {
  const serverPosts = getBlogPostsForIndex();
  return <BlogPageFrame lang="en" serverPosts={serverPosts} />;
}