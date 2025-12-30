// Shared blog posts data - can be migrated to Supabase later

export interface BlogPost {
  slug: string;
  title: { el: string; en: string };
  excerpt: { el: string; en: string };
  date: string;
  category: { el: string; en: string };
  readTime: { el: string; en: string };
  image: string;
  content?: { el: string; en: string };
}

export const initialBlogPosts: BlogPost[] = [
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
      el: "Micro vs Macro Influencers: Ποιοι Είναι Καλύτεροι;",
      en: "Micro vs Macro Influencers: Which Are Better?"
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

// Initialize localStorage with initial posts if empty
export function initializeBlogPosts() {
  if (typeof window === 'undefined') return;
  
  const stored = localStorage.getItem('blogPosts');
  if (!stored) {
    localStorage.setItem('blogPosts', JSON.stringify(initialBlogPosts));
  }
}

// Get blog posts from localStorage
export function getBlogPosts(): BlogPost[] {
  if (typeof window === 'undefined') return initialBlogPosts;
  
  const stored = localStorage.getItem('blogPosts');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return initialBlogPosts;
    }
  }
  return initialBlogPosts;
}

