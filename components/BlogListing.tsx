import Image from "next/image";
import Link from "next/link";
import { BLOG_CARD_IMAGE_SIZES, type BlogPost } from "@/lib/blogPosts";
import { formatDisplayDate } from "@/lib/formatDate";

type Lang = "el" | "en";

type Props = {
  posts: BlogPost[];
  lang: Lang;
};

export default function BlogListing({ posts, lang }: Props) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-600">{lang === "el" ? "Δεν υπάρχουν άρθρα ακόμα." : "No articles yet."}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 grid-blog-wide">
      {posts.map((post, index) => {
        const isLcp = index === 0;
        return (
          <Link
            key={post.slug}
            href={lang === "en" ? `/en/blog/${post.slug}` : `/blog/${post.slug}`}
            className="min-w-0 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-all group"
          >
            <div className="relative h-48 overflow-hidden">
              <Image
                src={post.image}
                alt={post.title[lang]}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-300"
                sizes={BLOG_CARD_IMAGE_SIZES}
                priority={isLcp}
                fetchPriority={isLcp ? "high" : undefined}
              />
              <div className="absolute top-4 left-4">
                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                  {post.category[lang]}
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
                <span>{formatDisplayDate(post.date)}</span>
                <span>•</span>
                <span>{post.readTime[lang]}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                {post.title[lang]}
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">{post.excerpt[lang]}</p>
              <div className="mt-4 text-blue-600 font-semibold text-sm group-hover:underline">
                {lang === "el" ? "Διαβάστε περισσότερα →" : "Read more →"}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}