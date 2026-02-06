import BlogPostPage from "../../../blog/[slug]/page";

export default function EnBlogPostPage(props: { params: Promise<{ slug: string }> }) {
  return <BlogPostPage params={props.params} />;
}
