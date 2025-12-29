"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Footer from "../../components/Footer";

type Lang = "el" | "en";

const t = {
  el: {
    title: "Γίνετε Influencer στην Influo",
    subtitle: "Κερδίστε με το ταλέντο σας",
    hero_desc: "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Δημιουργήστε το επαγγελματικό σας προφίλ, συνεργαστείτε με κορυφαία brands και κερδίστε.",
    cta_primary: "Ξεκινήστε Δωρεάν",
    cta_secondary: "Δείτε το Κατάλογο",
    back: "← Επιστροφή",
    
    feat_1_title: "📈 Μεγιστοποιήστε τα Κέρδη σας",
    feat_1_desc: "Ορίστε τις δικές σας τιμές, αποδέχεστε προσφορές που σας ταιριάζουν και κερδίστε περισσότερα από κάθε συνεργασία.",
    
    feat_2_title: "🎯 Βρείτε τις Ιδανικές Συνεργασίες",
    feat_2_desc: "Ανακαλύψτε brands που ταιριάζουν στο niche σας. Προσφορές προσωποποιημένες στα ενδιαφέροντά σας και το audience σας.",
    
    feat_3_title: "✅ Επαγγελματικό Προφίλ",
    feat_3_desc: "Δημιουργήστε ένα επαγγελματικό προφίλ που αντικατοπτρίζει την αξία σας. Εμφανίστε stats, reviews και past collaborations.",
    
    feat_4_title: "💬 Άμεση Επικοινωνία",
    feat_4_desc: "Συνομιλήστε απευθείας με brands, διαπραγματευτείτε προσφορές και κλείστε συνεργασίες γρήγορα.",
    
    feat_5_title: "⭐ Αναγνώριση & Badges",
    feat_5_desc: "Κερδίστε badges (Top Performer, Pro, Elite, VIP) που αναγνωρίζουν την απόδοσή σας και αυξάνουν την αξιοπιστία σας.",
    
    feat_6_title: "💰 Ασφαλείς Πληρωμές",
    feat_6_desc: "Επίσημες συμφωνίες, διαφανείς όροι και ασφαλείς πληρωμές. Προστατευτείτε και εσείς.",
    
    how_title: "Πώς Λειτουργεί",
    step_1_title: "1. Δημιουργήστε Προφίλ",
    step_1_desc: "Εγγραφείτε δωρεάν και συμπληρώστε το προφίλ σας με stats, pricing και portfolio.",
    
    step_2_title: "2. Λάβετε Προσφορές",
    step_2_desc: "Brands θα σας στέλνουν προσφορές για συνεργασίες. Αποδέχεστε, κάντε αντιπροσφορά ή συζητήστε.",
    
    step_3_title: "3. Κλείστε Συνεργασία",
    step_3_desc: "Αποδεχτείτε τους όρους, ολοκληρώστε το project και κερδίστε.",
    
    testimonials_title: "Τι Λένε οι Influencers",
    testimonial_1_name: "Μαρία Κ.",
    testimonial_1_role: "Beauty Influencer",
    testimonial_1_text: "Η Influo μου άλλαξε τη ζωή! Βρήκα 5+ brands σε 2 μήνες και τα κέρδη μου αυξήθηκαν 300%.",
    
    testimonial_2_name: "Γιάννης Τ.",
    testimonial_2_role: "Tech Content Creator",
    testimonial_2_text: "Επαγγελματική πλατφόρμα με αξιόπιστα brands. Η διαδικασία είναι πολύ απλή και αποτελεσματική.",
    
    testimonial_3_name: "Ελένη Μ.",
    testimonial_3_role: "Fashion Influencer",
    testimonial_3_text: "Αγαπώ το badge system και το reviews. Οι brands με εμπιστεύονται περισσότερο τώρα.",
    
    cta_section_title: "Ξεκινήστε σήμερα",
    cta_section_desc: "Δημιουργήστε το προφίλ σας σε λιγότερο από 5 λεπτά και ξεκινήστε να λαμβάνετε προσφορές.",
    cta_button: "Εγγραφείτε Δωρεάν",
  },
  en: {
    title: "Become an Influencer on Influo",
    subtitle: "Earn from your talent",
    hero_desc: "The most modern Influencer Marketing platform in Greece. Create your professional profile, collaborate with top brands and earn.",
    cta_primary: "Start for Free",
    cta_secondary: "View Directory",
    back: "← Back",
    
    feat_1_title: "📈 Maximize Your Earnings",
    feat_1_desc: "Set your own prices, accept offers that suit you and earn more from every collaboration.",
    
    feat_2_title: "🎯 Find Ideal Collaborations",
    feat_2_desc: "Discover brands that match your niche. Personalized offers tailored to your interests and audience.",
    
    feat_3_title: "✅ Professional Profile",
    feat_3_desc: "Create a professional profile that reflects your value. Showcase stats, reviews and past collaborations.",
    
    feat_4_title: "💬 Direct Communication",
    feat_4_desc: "Chat directly with brands, negotiate offers and close deals quickly.",
    
    feat_5_title: "⭐ Recognition & Badges",
    feat_5_desc: "Earn badges (Top Performer, Pro, Elite, VIP) that recognize your performance and increase your credibility.",
    
    feat_6_title: "💰 Secure Payments",
    feat_6_desc: "Official agreements, transparent terms and secure payments. Protect yourself too.",
    
    how_title: "How It Works",
    step_1_title: "1. Create Profile",
    step_1_desc: "Sign up for free and complete your profile with stats, pricing and portfolio.",
    
    step_2_title: "2. Receive Offers",
    step_2_desc: "Brands will send you collaboration offers. Accept, counter-propose or discuss.",
    
    step_3_title: "3. Close Deal",
    step_3_desc: "Accept terms, complete the project and earn.",
    
    testimonials_title: "What Influencers Say",
    testimonial_1_name: "Maria K.",
    testimonial_1_role: "Beauty Influencer",
    testimonial_1_text: "Influo changed my life! I found 5+ brands in 2 months and my earnings increased by 300%.",
    
    testimonial_2_name: "John T.",
    testimonial_2_role: "Tech Content Creator",
    testimonial_2_text: "Professional platform with trusted brands. The process is very simple and effective.",
    
    testimonial_3_name: "Eleni M.",
    testimonial_3_role: "Fashion Influencer",
    testimonial_3_text: "I love the badge system and reviews. Brands trust me more now.",
    
    cta_section_title: "Start Today",
    cta_section_desc: "Create your profile in less than 5 minutes and start receiving offers.",
    cta_button: "Sign Up Free",
  }
};

export default function ForInfluencersPage() {
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
            <Link href="/" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">{txt.back}</Link>
            <button 
              onClick={() => setLang(lang === "el" ? "en" : "el")}
              className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
            >
              {lang === "el" ? "EN" : "EL"}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 px-6 bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">{txt.title}</h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-4">{txt.subtitle}</p>
          <p className="text-lg text-blue-50 max-w-2xl mx-auto mb-8">{txt.hero_desc}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/#directory" 
              className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all transform hover:scale-105 shadow-lg"
            >
              {txt.cta_primary}
            </Link>
            <Link 
              href="/#directory" 
              className="px-8 py-4 bg-blue-500/20 backdrop-blur-sm text-white font-bold border-2 border-white/30 rounded-xl hover:bg-blue-500/30 transition-all"
            >
              {txt.cta_secondary}
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_1_title}</h3>
              <p className="text-slate-600">{txt.feat_1_desc}</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_2_title}</h3>
              <p className="text-slate-600">{txt.feat_2_desc}</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_3_title}</h3>
              <p className="text-slate-600">{txt.feat_3_desc}</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_4_title}</h3>
              <p className="text-slate-600">{txt.feat_4_desc}</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">⭐</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_5_title}</h3>
              <p className="text-slate-600">{txt.feat_5_desc}</p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_6_title}</h3>
              <p className="text-slate-600">{txt.feat_6_desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-12">{txt.how_title}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">1️⃣</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.step_1_title}</h3>
              <p className="text-slate-600">{txt.step_1_desc}</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">2️⃣</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.step_2_title}</h3>
              <p className="text-slate-600">{txt.step_2_desc}</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">3️⃣</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.step_3_title}</h3>
              <p className="text-slate-600">{txt.step_3_desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-12">{txt.testimonials_title}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  ΜΚ
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{txt.testimonial_1_name}</h4>
                  <p className="text-sm text-slate-600">{txt.testimonial_1_role}</p>
                </div>
              </div>
              <p className="text-slate-700 italic">"{txt.testimonial_1_text}"</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  ΓΤ
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{txt.testimonial_2_name}</h4>
                  <p className="text-sm text-slate-600">{txt.testimonial_2_role}</p>
                </div>
              </div>
              <p className="text-slate-700 italic">"{txt.testimonial_2_text}"</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  ΕΜ
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{txt.testimonial_3_name}</h4>
                  <p className="text-sm text-slate-600">{txt.testimonial_3_role}</p>
                </div>
              </div>
              <p className="text-slate-700 italic">"{txt.testimonial_3_text}"</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{txt.cta_section_title}</h2>
          <p className="text-xl text-blue-100 mb-8">{txt.cta_section_desc}</p>
          <Link 
            href="/#directory" 
            className="inline-block px-10 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all transform hover:scale-105 shadow-lg text-lg"
          >
            {txt.cta_button}
          </Link>
        </div>
      </section>

      <Footer lang={lang} />
    </div>
  );
}

