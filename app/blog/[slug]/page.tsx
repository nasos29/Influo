"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import Footer from "../../../components/Footer";

type Lang = "el" | "en";

const posts = {
  "influencer-marketing-guide-2025": {
    title: {
      el: "Ο Ολοκληρωμένος Οδηγός Influencer Marketing 2025",
      en: "The Complete Influencer Marketing Guide 2025"
    },
    content: {
      el: `# Ο Ολοκληρωμένος Οδηγός Influencer Marketing 2025

Το influencer marketing έχει γίνει ένα από τα πιο αποτελεσματικά digital marketing channels. Το 2025, οι brands επενδύουν περισσότερα από ποτέ σε influencer collaborations.

## Τι είναι το Influencer Marketing;

Το influencer marketing είναι η πρακτική της συνεργασίας με individuals που έχουν build έναν πιστό audience στα social media για να προωθήσουν products ή services.

## Τα Κύρια Trends του 2025

1. **Micro-Influencers**: Brands προτιμούν creators με 10k-100k followers για υψηλότερο engagement
2. **Authenticity**: Οι users θέλουν genuine recommendations, όχι απλά ads
3. **Video Content**: Short-form video (TikTok, Reels) κυριαρχεί
4. **Long-term Partnerships**: Brands αναζητούν ongoing relationships αντί για one-off collaborations

## Best Practices

- Επιλέξτε influencers που ταιριάζουν στο brand values σας
- Δώστε creative freedom στους creators
- Μετρήστε το ROI σας με clear metrics
- Build genuine relationships`,
      en: `# The Complete Influencer Marketing Guide 2025

Influencer marketing has become one of the most effective digital marketing channels. In 2025, brands are investing more than ever in influencer collaborations.

## What is Influencer Marketing?

Influencer marketing is the practice of collaborating with individuals who have built a loyal audience on social media to promote products or services.

## Key 2025 Trends

1. **Micro-Influencers**: Brands prefer creators with 10k-100k followers for higher engagement
2. **Authenticity**: Users want genuine recommendations, not just ads
3. **Video Content**: Short-form video (TikTok, Reels) dominates
4. **Long-term Partnerships**: Brands seek ongoing relationships instead of one-off collaborations

## Best Practices

- Choose influencers that match your brand values
- Give creators creative freedom
- Measure your ROI with clear metrics
- Build genuine relationships`
    }
  },
  "how-to-become-successful-influencer": {
    title: {
      el: "Πώς να Γίνετε Επιτυχημένος Influencer: 10 Σημαντικές Συμβουλές",
      en: "How to Become a Successful Influencer: 10 Important Tips"
    },
    content: {
      el: `# Πώς να Γίνετε Επιτυχημένος Influencer

Η καριέρα του influencer είναι πιο προσιτή από ποτέ, αλλά χρειάζεται strategy και consistency.

## 1. Βρείτε το Niche σας

Εστιάστε σε ένα niche που σας παθιάζει και έχετε knowledge.

## 2. Δημιουργήστε Quality Content

Ποιότητα > Ποσότητα. Invest in good equipment και editing.

## 3. Be Consistent

Post regularly. Consistency builds trust με το audience σας.

## 4. Engage με το Audience

Απαντάτε σε comments, DMs και δημιουργείτε community.

## 5. Collaborate με Άλλους Creators

Networking είναι crucial. Collaborations expand your reach.

## 6. Χρησιμοποιήστε Hashtags Strategically

Research trending hashtags στο niche σας.

## 7. Analyze Your Performance

Χρησιμοποιήστε analytics για να δείτε τι λειτουργεί.

## 8. Build Email List

Don't rely μόνο στα social platforms.

## 9. Stay Authentic

Authenticity builds trust και long-term success.

## 10. Be Patient

Success takes time. Stay consistent και focused.`,
      en: `# How to Become a Successful Influencer

The influencer career is more accessible than ever, but requires strategy and consistency.

## 1. Find Your Niche

Focus on a niche that you're passionate about and have knowledge in.

## 2. Create Quality Content

Quality > Quantity. Invest in good equipment and editing.

## 3. Be Consistent

Post regularly. Consistency builds trust with your audience.

## 4. Engage with Audience

Respond to comments, DMs and build community.

## 5. Collaborate with Other Creators

Networking is crucial. Collaborations expand your reach.

## 6. Use Hashtags Strategically

Research trending hashtags in your niche.

## 7. Analyze Your Performance

Use analytics to see what works.

## 8. Build Email List

Don't rely only on social platforms.

## 9. Stay Authentic

Authenticity builds trust and long-term success.

## 10. Be Patient

Success takes time. Stay consistent and focused.`
    }
  },
  "micro-vs-macro-influencers": {
    title: {
      el: "Micro vs Macro Influencers: Ποιοι Είναι Καλύτεροι;",
      en: "Micro vs Macro Influencers: Which Are Better?"
    },
    content: {
      el: `# Micro vs Macro Influencers

Η επιλογή μεταξύ micro και macro influencers εξαρτάται από το budget και τους goals σας.

## Micro-Influencers (10k-100k followers)

**Pros:**
- Υψηλότερο engagement rate
- Lower cost
- Niche audience
- More authentic

**Cons:**
- Smaller reach
- Less brand recognition

## Macro-Influencers (100k+ followers)

**Pros:**
- Massive reach
- High brand awareness
- Professional content

**Cons:**
- Higher cost
- Lower engagement rate
- Less personalized

## Ποιον να Επιλέξετε;

- **Micro**: Για niche products, local businesses, higher engagement
- **Macro**: Για mass market products, brand awareness campaigns`,
      en: `# Micro vs Macro Influencers

The choice between micro and macro influencers depends on your budget and goals.

## Micro-Influencers (10k-100k followers)

**Pros:**
- Higher engagement rate
- Lower cost
- Niche audience
- More authentic

**Cons:**
- Smaller reach
- Less brand recognition

## Macro-Influencers (100k+ followers)

**Pros:**
- Massive reach
- High brand awareness
- Professional content

**Cons:**
- Higher cost
- Lower engagement rate
- Less personalized

## Which to Choose?

- **Micro**: For niche products, local businesses, higher engagement
- **Macro**: For mass market products, brand awareness campaigns`
    }
  },
  "instagram-tiktok-youtube-comparison": {
    title: {
      el: "Instagram vs TikTok vs YouTube: Ποια Πλατφόρμα;",
      en: "Instagram vs TikTok vs YouTube: Which Platform?"
    },
    content: {
      el: `# Instagram vs TikTok vs YouTube

Κάθε platform έχει τα δικά του advantages για influencer marketing.

## Instagram

**Ideal for:**
- Visual products (fashion, beauty, food)
- Lifestyle brands
- Story ads

**Audience:** 18-34 years old

## TikTok

**Ideal for:**
- Trendy products
- Gen Z audience
- Viral content

**Audience:** 16-24 years old

## YouTube

**Ideal for:**
- Long-form content
- Educational content
- Product reviews

**Audience:** All ages

## Συμβουλή

Χρησιμοποιήστε multiple platforms για maximum reach.`,
      en: `# Instagram vs TikTok vs YouTube

Each platform has its own advantages for influencer marketing.

## Instagram

**Ideal for:**
- Visual products (fashion, beauty, food)
- Lifestyle brands
- Story ads

**Audience:** 18-34 years old

## TikTok

**Ideal for:**
- Trendy products
- Gen Z audience
- Viral content

**Audience:** 16-24 years old

## YouTube

**Ideal for:**
- Long-form content
- Educational content
- Product reviews

**Audience:** All ages

## Tip

Use multiple platforms for maximum reach.`
    }
  },
  "measuring-influencer-marketing-roi": {
    title: {
      el: "Πώς να Μετρήσετε το ROI του Influencer Marketing",
      en: "How to Measure Influencer Marketing ROI"
    },
    content: {
      el: `# Μετρήστε το ROI του Influencer Marketing

Το ROI measurement είναι crucial για να αποδείξετε την αξία των campaigns σας.

## Key Metrics

1. **Engagement Rate**: Likes, comments, shares / Followers
2. **Reach**: Unique users που είδαν το content
3. **Impressions**: Total views
4. **Conversions**: Sales από influencer links
5. **Brand Awareness**: Mentions, hashtag usage

## ROI Formula

ROI = (Revenue - Cost) / Cost × 100

## Tools

- Google Analytics
- Social media analytics
- UTM tracking
- Affiliate links

## Best Practices

- Set clear KPIs πριν το campaign
- Track everything
- Compare με other marketing channels`,
      en: `# Measure Influencer Marketing ROI

ROI measurement is crucial to prove the value of your campaigns.

## Key Metrics

1. **Engagement Rate**: Likes, comments, shares / Followers
2. **Reach**: Unique users who saw the content
3. **Impressions**: Total views
4. **Conversions**: Sales from influencer links
5. **Brand Awareness**: Mentions, hashtag usage

## ROI Formula

ROI = (Revenue - Cost) / Cost × 100

## Tools

- Google Analytics
- Social media analytics
- UTM tracking
- Affiliate links

## Best Practices

- Set clear KPIs before campaign
- Track everything
- Compare with other marketing channels`
    }
  }
};

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const [lang, setLang] = useState<Lang>("el");
  const post = posts[resolvedParams.slug as keyof typeof posts];
  
  if (!post) {
    return <div>Post not found</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Influo.gr Logo" width={160} height={64} className="h-10 w-auto" priority />
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/blog" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
              {lang === "el" ? "← Blog" : "← Blog"}
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

      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8">{post.title[lang]}</h1>
        <div 
          className="prose prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-ul:text-slate-700 prose-ol:text-slate-700"
          dangerouslySetInnerHTML={{ __html: post.content[lang].replace(/\n/g, '<br/>').replace(/#{3}\s(.+)/g, '<h3 class="text-2xl font-bold mt-8 mb-4">$1</h3>').replace(/##\s(.+)/g, '<h2 class="text-3xl font-bold mt-10 mb-6">$1</h2>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*\s(.+)/g, '<li>$1</li>') }}
        />
      </article>

      <Footer lang={lang} />
    </div>
  );
}

