"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Footer from "../../components/Footer";

type Lang = "el" | "en";

const t = {
  el: {
    title: "Βρείτε τους Καλύτερους Influencers για την Εταιρεία σας",
    subtitle: "Συνεργαστείτε με Verified Creators",
    hero_desc: "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Αναζητήστε, επικοινωνήστε και συνεργαστείτε με επαγγελματίες influencers.",
    cta_primary: "Εγγραφείτε ως Brand",
    cta_secondary: "Δείτε το Κατάλογο",
    back: "← Επιστροφή",
    
    feat_1_title: "🔍 Εξαιρετική Αναζήτηση",
    feat_1_desc: "Χρησιμοποιήστε προηγμένα φίλτρα: κατηγορία, engagement rate, followers, budget, location. Βρείτε τον τέλειο influencer για το brand σας.",
    
    feat_2_title: "✅ Verified Creators",
    feat_2_desc: "Όλοι οι influencers είναι verified με πραγματικά stats. Δείτε reviews, completion rate και response time.",
    
    feat_3_title: "💼 Εύκολη Διαχείριση",
    feat_3_desc: "Διαχειριστείτε όλες τις συνεργασίες σας από ένα μέρος. Προσφορές, συνομιλίες, agreements - όλα εκεί.",
    
    feat_4_title: "💬 Άμεση Επικοινωνία",
    feat_4_desc: "Συνομιλήστε απευθείας με influencers, διαπραγματευτείτε τιμές και κλείστε deals γρήγορα.",
    
    feat_5_title: "📊 Αναλυτικά Stats",
    feat_5_desc: "Δείτε engagement rates, audience demographics, past collaborations και reviews από άλλα brands.",
    
    feat_6_title: "⚡ Γρήγορη Εύρεση",
    feat_6_desc: "Από την αναζήτηση στην συνεργασία σε λίγες ώρες. Streamlined process για αποτελεσματικά campaigns.",
    
    how_title: "Πώς Λειτουργεί",
    step_1_title: "1. Εγγραφείτε ως Brand",
    step_1_desc: "Δημιουργήστε λογαριασμό brand, συμπληρώστε τα στοιχεία της εταιρείας σας και λάβετε πρόσβαση στο κατάλογο.",
    
    step_2_title: "2. Αναζητήστε Influencers",
    step_2_desc: "Χρησιμοποιήστε τα φίλτρα για να βρείτε influencers που ταιριάζουν στο niche σας και το budget σας.",
    
    step_3_title: "3. Στείλτε Προσφορά",
    step_3_desc: "Κάντε κλικ στο influencer, συμπληρώστε τη φόρμα προσφοράς και στείλτε. Ο influencer θα λάβει ειδοποίηση.",
    
    step_4_title: "4. Κλείστε Deal",
    step_4_desc: "Αποδέχεστε τους όρους, συνομιλήστε και ολοκληρώστε την συνεργασία.",
    
    testimonials_title: "Τι Λένε τα Brands",
    testimonial_1_name: "Σοφία Α.",
    testimonial_1_role: "Marketing Manager, Tech Startup",
    testimonial_1_text: "Βρήκαμε 3 τέλειους influencers σε μία βδομάδα! Η πλατφόρμα είναι πολύ user-friendly και οι influencers είναι επαγγελματίες.",
    
    testimonial_2_name: "Δημήτρης Κ.",
    testimonial_2_role: "Brand Manager, Fashion Brand",
    testimonial_2_text: "Το badge system και τα reviews μας βοηθούν να επιλέξουμε τους καλύτερους creators. ROI πολύ καλός!",
    
    testimonial_3_name: "Μαρία Λ.",
    testimonial_3_role: "Digital Marketing Director",
    testimonial_3_text: "Η διαχείριση όλων των campaigns από ένα μέρος είναι game-changer. Highly recommended!",
    
    cta_section_title: "Ξεκινήστε σήμερα",
    cta_section_desc: "Δημιουργήστε λογαριασμό brand και ανακαλύψτε τους καλύτερους influencers για το marketing σας.",
    cta_button: "Εγγραφείτε ως Brand",
  },
  en: {
    title: "Find the Best Influencers for Your Company",
    subtitle: "Collaborate with Verified Creators",
    hero_desc: "The most modern Influencer Marketing platform in Greece. Search, connect and collaborate with professional influencers.",
    cta_primary: "Sign Up as Brand",
    cta_secondary: "View Directory",
    back: "← Back",
    
    feat_1_title: "🔍 Excellent Search",
    feat_1_desc: "Use advanced filters: category, engagement rate, followers, budget, location. Find the perfect influencer for your brand.",
    
    feat_2_title: "✅ Verified Creators",
    feat_2_desc: "All influencers are verified with real stats. See reviews, completion rate and response time.",
    
    feat_3_title: "💼 Easy Management",
    feat_3_desc: "Manage all your collaborations from one place. Proposals, conversations, agreements - all there.",
    
    feat_4_title: "💬 Direct Communication",
    feat_4_desc: "Chat directly with influencers, negotiate prices and close deals quickly.",
    
    feat_5_title: "📊 Detailed Stats",
    feat_5_desc: "See engagement rates, audience demographics, past collaborations and reviews from other brands.",
    
    feat_6_title: "⚡ Quick Discovery",
    feat_6_desc: "From search to collaboration in a few hours. Streamlined process for effective campaigns.",
    
    how_title: "How It Works",
    step_1_title: "1. Sign Up as Brand",
    step_1_desc: "Create a brand account, fill in your company details and get access to the directory.",
    
    step_2_title: "2. Search Influencers",
    step_2_desc: "Use filters to find influencers that match your niche and budget.",
    
    step_3_title: "3. Send Proposal",
    step_3_desc: "Click on influencer, fill the proposal form and send. Influencer will receive notification.",
    
    step_4_title: "4. Close Deal",
    step_4_desc: "Accept terms, communicate and complete the collaboration.",
    
    testimonials_title: "What Brands Say",
    testimonial_1_name: "Sophia A.",
    testimonial_1_role: "Marketing Manager, Tech Startup",
    testimonial_1_text: "We found 3 perfect influencers in one week! The platform is very user-friendly and influencers are professionals.",
    
    testimonial_2_name: "Dimitris K.",
    testimonial_2_role: "Brand Manager, Fashion Brand",
    testimonial_2_text: "The badge system and reviews help us choose the best creators. Very good ROI!",
    
    testimonial_3_name: "Maria L.",
    testimonial_3_role: "Digital Marketing Director",
    testimonial_3_text: "Managing all campaigns from one place is a game-changer. Highly recommended!",
    
    cta_section_title: "Start Today",
    cta_section_desc: "Create a brand account and discover the best influencers for your marketing.",
    cta_button: "Sign Up as Brand",
  }
};

export default function ForBrandsPage() {
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
      <section className="relative pt-16 pb-24 px-6 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">{txt.title}</h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-4">{txt.subtitle}</p>
          <p className="text-lg text-blue-50 max-w-2xl mx-auto mb-8">{txt.hero_desc}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/brand/signup" 
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
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_1_title}</h3>
              <p className="text-slate-600">{txt.feat_1_desc}</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_2_title}</h3>
              <p className="text-slate-600">{txt.feat_2_desc}</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">💼</div>
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
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_5_title}</h3>
              <p className="text-slate-600">{txt.feat_5_desc}</p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">⚡</div>
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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">1️⃣</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.step_1_title}</h3>
              <p className="text-slate-600 text-sm">{txt.step_1_desc}</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">2️⃣</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.step_2_title}</h3>
              <p className="text-slate-600 text-sm">{txt.step_2_desc}</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">3️⃣</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.step_3_title}</h3>
              <p className="text-slate-600 text-sm">{txt.step_3_desc}</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
              <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">4️⃣</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.step_4_title}</h3>
              <p className="text-slate-600 text-sm">{txt.step_4_desc}</p>
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
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  ΣΑ
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
                <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  ΔΚ
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
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  ΜΛ
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
            href="/brand/signup" 
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

