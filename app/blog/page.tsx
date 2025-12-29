"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Footer from "../../components/Footer";

type Lang = "el" | "en";

interface BlogPost {
  slug: string;
  title: { el: string; en: string };
  excerpt: { el: string; en: string };
  date: string;
  category: { el: string; en: string };
  readTime: { el: string; en: string };
  image: string;
}

const posts: BlogPost[] = [
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
    image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80"
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
  }
];

export default function BlogPage() {
  const [lang, setLang] = useState<Lang>("el");
  const txt = t[lang];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Influo.gr Logo" width={160} height={64} className="h-10 w-auto" priority />
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
              {lang === "el" ? "← Επιστροφή" : "← Back"}
            </Link>
            <button 
              onClick={() => setLang(lang === "el" ? "en" : "el")}
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link 
                key={post.slug} 
                href={`/blog/${post.slug}`}
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

