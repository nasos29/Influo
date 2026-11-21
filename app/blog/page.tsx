import BlogPageFrame from "@/components/BlogPageFrame";
import { getBlogPostsForIndex } from "@/lib/blogPosts";

export default function BlogPage() {
  const serverPosts = getBlogPostsForIndex();
  return <BlogPageFrame lang="el" serverPosts={serverPosts} />;
}