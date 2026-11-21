"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Footer from "./Footer";
import SiteHeader from "@/components/SiteHeader";
import BlogListing from "@/components/BlogListing";
import {
  getBlogPosts,
  initializeBlogPosts,
  sortBlogPostsByDate,
  type BlogPost,
} from "@/lib/blogPosts";
import { getStoredLanguage } from "@/lib/language";

type Lang = "el" | "en";

type Props = {
  lang: Lang;
  serverPosts: BlogPost[];
};

function postsEqual(a: BlogPost[], b: BlogPost[]): boolean {
  if (a.length !== b.length) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export default function BlogPageFrame({ lang: routeLang, serverPosts }: Props) {
  const pathname = usePathname();
  const [lang, setLang] = useState<Lang>(routeLang);
  const [posts, setPosts] = useState<BlogPost[]>(serverPosts);

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  useEffect(() => {
    setPosts(serverPosts);
  }, [serverPosts]);

  useEffect(() => {
    initializeBlogPosts();
    const loaded = sortBlogPostsByDate(getBlogPosts());
    if (!postsEqual(loaded, serverPosts)) {
      setPosts(loaded);
    }

    const handleStorageChange = () => {
      const next = sortBlogPostsByDate(getBlogPosts());
      setPosts(next);
    };

    window.addEventListener("blogPostsUpdated", handleStorageChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("blogPostsUpdated", handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [serverPosts]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <SiteHeader lang={lang} onLangChange={setLang} />

      <section className="py-16 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-page mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">
            {lang === "el" ? "Blog Influencer Marketing" : "Influencer Marketing Blog"}
          </h1>
          <p className="text-xl text-blue-100">
            {lang === "el"
              ? "Μάθετε τα τελευταία trends, tips και strategies"
              : "Learn the latest trends, tips and strategies"}
          </p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-page mx-auto">
          <BlogListing posts={posts} lang={lang} />
        </div>
      </section>

      <Footer lang={lang} />
    </div>
  );
}