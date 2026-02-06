"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Footer from "../../components/Footer";
import { initializeBlogPosts, getBlogPosts, type BlogPost } from "@/lib/blogPosts";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";

type Lang = "el" | "en";

export default function BlogPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Load language from pathname (/en/blog) or localStorage on client-side
  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  useEffect(() => {
    // Initialize and load posts
    initializeBlogPosts();
    const loadedPosts = getBlogPosts();
    setPosts(loadedPosts);
    setLoading(false);
  }, []);

  // Listen for localStorage changes (when admin updates posts)
  useEffect(() => {
    const handleStorageChange = () => {
      const loadedPosts = getBlogPosts();
      setPosts(loadedPosts);
    };

    // Listen for custom event from admin dashboard
    window.addEventListener('blogPostsUpdated', handleStorageChange);
    // Also check periodically (every 2 seconds) for changes
    const interval = setInterval(handleStorageChange, 2000);

    return () => {
      window.removeEventListener('blogPostsUpdated', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  // Fallback posts if localStorage is empty (initial load)
  const initialPosts: BlogPost[] = [
  {
    slug: "influencer-marketing-guide-2025",
    title: {
      el: "Ο Ολοκληρωμένος Οδηγός Influencer Marketing 2025",
      en: "The Complete Influencer Marketing Guide 2025"
    },
    excerpt: {
      el: "Ανακαλύψτε τα τελευταία trends, best practices και strategies για αποτελεσματικό influencer marketing. Από την επιλογή του κατάλληλου creator μέχρι τη μέτρηση του ROI.",
      en: "Discover the latest trends, best practices and strategies for effective influencer marketing. From choosing the right creator to measuring ROI."
    },
    date: "2025-01-15",
    category: { el: "Marketing", en: "Marketing" },
    readTime: { el: "8 λεπτά", en: "8 min" },
    image: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&q=80"
  },
  {
    slug: "how-to-become-successful-influencer",
    title: {
      el: "Πώς να Γίνετε Επιτυχημένος Influencer: 10 Σημαντικές Συμβουλές",
      en: "How to Become a Successful Influencer: 10 Important Tips"
    },
    excerpt: {
      el: "Μάθετε τα βασικά secrets για να ξεκινήσετε την καριέρα σας ως influencer. Από τη δημιουργία quality content μέχρι την ανάπτυξη ενός πιστού audience.",
      en: "Learn the basic secrets to start your career as an influencer. From creating quality content to growing a loyal audience."
    },
    date: "2025-01-10",
    category: { el: "Influencers", en: "Influencers" },
    readTime: { el: "10 λεπτά", en: "10 min" },
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80"
  },
  {
    slug: "micro-vs-macro-influencers",
    title: {
      el: "Micro vs Macro Influencers: Ποιοι Είναι Καλύτεροι για το Brand σας;",
      en: "Micro vs Macro Influencers: Which Are Better for Your Brand?"
    },
    excerpt: {
      el: "Συγκρίνετε micro και macro influencers. Μάθετε πότε να επιλέξετε τον καθένα, τα pros και cons, και πώς να μεγιστοποιήσετε το ROI σας.",
      en: "Compare micro and macro influencers. Learn when to choose each, pros and cons, and how to maximize your ROI."
    },
    date: "2025-01-05",
    category: { el: "Strategy", en: "Strategy" },
    readTime: { el: "7 λεπτά", en: "7 min" },
    image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80"
  },
  {
    slug: "instagram-tiktok-youtube-comparison",
    title: {
      el: "Instagram vs TikTok vs YouTube: Ποια Πλατφόρμα για Influencer Marketing;",
      en: "Instagram vs TikTok vs YouTube: Which Platform for Influencer Marketing?"
    },
    excerpt: {
      el: "Μια αναλυτική σύγκριση των κύριων social media platforms για influencer marketing. Μάθετε ποια πλατφόρμα ταιριάζει καλύτερα στο brand σας.",
      en: "An analytical comparison of the main social media platforms for influencer marketing. Learn which platform best fits your brand."
    },
    date: "2024-12-28",
    category: { el: "Platforms", en: "Platforms" },
    readTime: { el: "9 λεπτά", en: "9 min" },
    image: "https://images.unsplash.com/photo-1611262588024-d12430b98920?w=800&q=80"
  },
  {
    slug: "measuring-influencer-marketing-roi",
    title: {
      el: "Πώς να Μετρήσετε το ROI του Influencer Marketing",
      en: "How to Measure Influencer Marketing ROI"
    },
    excerpt: {
      el: "Μάθετε ποια metrics να παρακολουθείτε, πώς να υπολογίζετε το ROI και να αποδεικνύετε την αξία των influencer campaigns στον CEO σας.",
      en: "Learn which metrics to track, how to calculate ROI and prove the value of influencer campaigns to your CEO."
    },
    date: "2024-12-20",
    category: { el: "Analytics", en: "Analytics" },
    readTime: { el: "6 λεπτά", en: "6 min" },
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80"
  },
  {
    slug: "engagement-rate-explained",
    title: {
      el: "Engagement Rate: Τι Είναι και Πώς να το Υπολογίσετε",
      en: "Engagement Rate: What It Is and How to Calculate It"
    },
    excerpt: {
      el: "Μάθετε τι είναι το engagement rate, γιατί είναι σημαντικό, και πώς να το υπολογίσετε. Κατανόηση αυτού του metric είναι crucial για επιτυχημένο influencer marketing.",
      en: "Learn what engagement rate is, why it matters, and how to calculate it. Understanding this metric is crucial for successful influencer marketing."
    },
    date: "2025-01-12",
    category: { el: "Analytics", en: "Analytics" },
    readTime: { el: "7 λεπτά", en: "7 min" },
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80"
  },
  {
    slug: "negotiating-influencer-rates",
    title: {
      el: "Πώς να Διαπραγματευτείτε Τιμές με Influencers: Ολοκληρωμένος Οδηγός",
      en: "How to Negotiate Rates with Influencers: Complete Guide"
    },
    excerpt: {
      el: "Μάθετε πώς να διαπραγματεύεστε fair prices με influencers, τι factors να λάβετε υπόψη, και πώς να φτιάξετε win-win agreements για και τις δύο πλευρές.",
      en: "Learn how to negotiate fair prices with influencers, what factors to consider, and how to create win-win agreements for both parties."
    },
    date: "2025-01-08",
    category: { el: "Strategy", en: "Strategy" },
    readTime: { el: "8 λεπτά", en: "8 min" },
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80"
  },
  {
    slug: "fake-followers-detection",
    title: {
      el: "Πώς να Ανιχνεύσετε Fake Followers: Οδηγός για Brands",
      en: "How to Detect Fake Followers: Guide for Brands"
    },
    excerpt: {
      el: "Μάθετε τα warning signs των fake followers, τα tools που μπορείτε να χρησιμοποιήσετε, και πώς να προστατευτείτε από influencers με fake audience.",
      en: "Learn the warning signs of fake followers, tools you can use, and how to protect yourself from influencers with fake audiences."
    },
    date: "2025-01-03",
    category: { el: "Strategy", en: "Strategy" },
    readTime: { el: "6 λεπτά", en: "6 min" },
    image: "https://images.unsplash.com/photo-1553484771-371a605b060b?w=800&q=80"
  },
  {
    slug: "influencer-contract-essentials",
    title: {
      el: "Τι να Συμπεριλάβετε σε Influencer Contract: Essential Clauses",
      en: "What to Include in Influencer Contract: Essential Clauses"
    },
    excerpt: {
      el: "Μάθετε τα essential clauses που πρέπει να υπάρχουν σε ένα influencer contract για να προστατεύσετε το brand σας και να εξασφαλίσετε clear expectations.",
      en: "Learn the essential clauses that should be in an influencer contract to protect your brand and ensure clear expectations."
    },
    date: "2024-12-15",
    category: { el: "Legal", en: "Legal" },
    readTime: { el: "9 λεπτά", en: "9 min" },
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80"
  },
  {
    slug: "building-brand-influencer-relationships",
    title: {
      el: "Πώς να Χτίσετε Long-Term Relationships με Influencers",
      en: "How to Build Long-Term Relationships with Influencers"
    },
    excerpt: {
      el: "Discover strategies για building lasting relationships με influencers. Long-term partnerships οδηγούν σε better content, higher ROI, και authentic brand representation.",
      en: "Discover strategies for building lasting relationships with influencers. Long-term partnerships lead to better content, higher ROI, and authentic brand representation."
    },
    date: "2024-12-10",
    category: { el: "Strategy", en: "Strategy" },
    readTime: { el: "7 λεπτά", en: "7 min" },
    image: "https://images.unsplash.com/photo-1556761175-4b46a572b786?w=800&q=80"
  }
];

  // Use posts from localStorage, or fallback to initial posts
  const displayPosts = posts.length > 0 ? posts : initialPosts;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 py-4">
          <Link href={lang === "en" ? "/en" : "/"} className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Influo.gr Logo" width={160} height={64} className="h-10 w-auto" priority />
          </Link>
          <div className="flex items-center gap-6">
            <Link href={lang === "en" ? "/en" : "/"} className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
              {lang === "el" ? "← Επιστροφή" : "← Back"}
            </Link>
            <button 
              onClick={() => {
                const newLang = lang === "el" ? "en" : "el";
                setLang(newLang);
                setStoredLanguage(newLang);
                if (newLang === "en") router.push("/en/blog");
                else router.push("/blog");
              }}
              className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
            >
              {lang === "el" ? "EN" : "EL"}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {lang === "el" ? "Blog Influencer Marketing" : "Influencer Marketing Blog"}
          </h1>
          <p className="text-xl text-blue-100">
            {lang === "el" 
              ? "Μάθετε τα τελευταία trends, tips και strategies"
              : "Learn the latest trends, tips and strategies"}
          </p>
        </div>
      </section>

      {/* Blog Posts */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          {displayPosts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-600">{lang === "el" ? "Δεν υπάρχουν άρθρα ακόμα." : "No articles yet."}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((post) => (
              <Link 
                key={post.slug} 
                href={lang === "en" ? `/en/blog/${post.slug}` : `/blog/${post.slug}`}
                className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-all group"
              >
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={post.image}
                    alt={post.title[lang]}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                      {post.category[lang]}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
                    <span>{new Date(post.date).toLocaleDateString(lang === "el" ? "el-GR" : "en-US", { 
                      year: "numeric", 
                      month: "long", 
                      day: "numeric" 
                    })}</span>
                    <span>•</span>
                    <span>{post.readTime[lang]}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                    {post.title[lang]}
                  </h2>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {post.excerpt[lang]}
                  </p>
                  <div className="mt-4 text-blue-600 font-semibold text-sm group-hover:underline">
                    {lang === "el" ? "Διαβάστε περισσότερα →" : "Read more →"}
                  </div>
                </div>
              </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer lang={lang} />
    </div>
  );
}

const t = {
  el: {},
  en: {}
};

