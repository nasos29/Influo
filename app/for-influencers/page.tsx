"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Footer from "../../components/Footer";
import { getStoredLanguage, setStoredLanguage } from '@/lib/language';

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
  const [lang, setLang] = useState<Lang>("el"); // Default to Greek, will be updated in useEffect
  const txt = t[lang];

  // Load language from localStorage on client-side
  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Influo.gr Logo" width={160} height={64} className="h-10 w-auto" priority />
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">{txt.back}</Link>
            <button 
              onClick={() => {
                const newLang = lang === "el" ? "en" : "el";
                setLang(newLang);
                setStoredLanguage(newLang);
              }}
              className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
            >
              {lang === "el" ? "EN" : "EL"}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Image */}
      <section className="relative pt-20 pb-32 px-6 bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-block px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium mb-6">
                ✨ #1 Influencer Marketing Platform in Greece
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                {txt.title}
              </h1>
              <p className="text-xl md:text-2xl text-blue-100 mb-4 font-medium">
                {txt.subtitle}
              </p>
              <p className="text-lg text-blue-50 mb-10 leading-relaxed">
                {txt.hero_desc}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  href="/directory" 
                  className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all transform hover:scale-105 shadow-xl text-center"
                >
                  {txt.cta_primary}
                </Link>
                <Link 
                  href="/directory" 
                  className="px-8 py-4 bg-blue-500/20 backdrop-blur-sm text-white font-bold border-2 border-white/30 rounded-xl hover:bg-blue-500/30 transition-all text-center"
                >
                  {txt.cta_secondary}
                </Link>
              </div>
              
              {/* Stats */}
              <div className="mt-12 grid grid-cols-3 gap-6">
                <div>
                  <div className="text-3xl font-bold">500+</div>
                  <div className="text-sm text-blue-200">Active Influencers</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">200+</div>
                  <div className="text-sm text-blue-200">Verified Brands</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">1K+</div>
                  <div className="text-sm text-blue-200">Successful Deals</div>
                </div>
              </div>
            </div>
            
            {/* Right Image */}
            <div className="relative h-[500px] lg:h-[600px] rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20">
              <Image 
                src="https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=1200&q=80"
                alt="Successful influencer creating content"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-purple-900/50 to-transparent"></div>
              {/* Floating Badge */}
              <div className="absolute top-6 right-6 bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-2xl">⭐</span>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600 font-medium">Top Performer</div>
                    <div className="text-lg font-bold text-slate-900">VIP Badge</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid with Images */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Γιατί να Επιλέξετε την Influo
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Όλα τα εργαλεία που χρειάζεστε για να μεγιστοποιήσετε το potential σας
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group bg-gradient-to-br from-white to-blue-50/50 p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all hover:-translate-y-2">
              <div className="relative w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform">
                <span className="text-4xl">📈</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{txt.feat_1_title.replace('📈 ', '')}</h3>
              <p className="text-slate-600 leading-relaxed">{txt.feat_1_desc}</p>
              <div className="mt-6 relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-green-100 to-emerald-100">
                <Image 
                  src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80"
                  alt="Earnings growth"
                  fill
                  className="object-cover opacity-80"
                />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group bg-gradient-to-br from-white to-purple-50/50 p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all hover:-translate-y-2">
              <div className="relative w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-600 rounded-2xl flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform">
                <span className="text-4xl">🎯</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{txt.feat_2_title.replace('🎯 ', '')}</h3>
              <p className="text-slate-600 leading-relaxed">{txt.feat_2_desc}</p>
              <div className="mt-6 relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100">
                <Image 
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80"
                  alt="Target audience"
                  fill
                  className="object-cover opacity-80"
                />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group bg-gradient-to-br from-white to-indigo-50/50 p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all hover:-translate-y-2">
              <div className="relative w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform">
                <span className="text-4xl">✅</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{txt.feat_3_title.replace('✅ ', '')}</h3>
              <p className="text-slate-600 leading-relaxed">{txt.feat_3_desc}</p>
              <div className="mt-6 relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100">
                <Image 
                  src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80"
                  alt="Professional profile"
                  fill
                  className="object-cover opacity-80"
                />
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group bg-gradient-to-br from-white to-cyan-50/50 p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all hover:-translate-y-2">
              <div className="relative w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform">
                <span className="text-4xl">💬</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{txt.feat_4_title.replace('💬 ', '')}</h3>
              <p className="text-slate-600 leading-relaxed">{txt.feat_4_desc}</p>
              <div className="mt-6 relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-cyan-100 to-blue-100">
                <Image 
                  src="https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=600&q=80"
                  alt="Direct messaging"
                  fill
                  className="object-cover opacity-80"
                />
              </div>
            </div>

            {/* Feature 5 */}
            <div className="group bg-gradient-to-br from-white to-amber-50/50 p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all hover:-translate-y-2">
              <div className="relative w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform">
                <span className="text-4xl">⭐</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{txt.feat_5_title.replace('⭐ ', '')}</h3>
              <p className="text-slate-600 leading-relaxed">{txt.feat_5_desc}</p>
              <div className="mt-6 relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-amber-100 to-orange-100">
                <Image 
                  src="https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=600&q=80"
                  alt="Badges and recognition"
                  fill
                  className="object-cover opacity-80"
                />
              </div>
            </div>

            {/* Feature 6 */}
            <div className="group bg-gradient-to-br from-white to-emerald-50/50 p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all hover:-translate-y-2">
              <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform">
                <span className="text-4xl">💰</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{txt.feat_6_title.replace('💰 ', '')}</h3>
              <p className="text-slate-600 leading-relaxed">{txt.feat_6_desc}</p>
              <div className="mt-6 relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-100 to-green-100">
                <Image 
                  src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80"
                  alt="Secure payments"
                  fill
                  className="object-cover opacity-80"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works with Visual Steps */}
      <section className="py-24 px-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">{txt.how_title}</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Από την εγγραφή στην πρώτη συνεργασία σε 3 απλά βήματα
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="relative">
              {/* Connection Line */}
              <div className="hidden md:block absolute top-24 left-full w-full h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 z-0 transform translate-x-6"></div>
              
              <div className="relative bg-white p-10 rounded-3xl shadow-xl border border-slate-200 text-center hover:shadow-2xl transition-all">
                <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
                  <span className="text-4xl">1️⃣</span>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    1
                  </div>
                </div>
                <div className="relative h-64 rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-blue-100 to-blue-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80"
                    alt="Create profile"
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">{txt.step_1_title}</h3>
                <p className="text-slate-600 leading-relaxed">{txt.step_1_desc}</p>
              </div>
            </div>
            
            <div className="relative">
              <div className="relative bg-white p-10 rounded-3xl shadow-xl border border-slate-200 text-center hover:shadow-2xl transition-all">
                <div className="relative w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
                  <span className="text-4xl">2️⃣</span>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-purple-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    2
                  </div>
                </div>
                <div className="relative h-64 rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-purple-100 to-pink-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=600&q=80"
                    alt="Receive offers"
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">{txt.step_2_title}</h3>
                <p className="text-slate-600 leading-relaxed">{txt.step_2_desc}</p>
              </div>
            </div>
            
            <div className="relative">
              <div className="relative bg-white p-10 rounded-3xl shadow-xl border border-slate-200 text-center hover:shadow-2xl transition-all">
                <div className="relative w-24 h-24 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
                  <span className="text-4xl">3️⃣</span>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    3
                  </div>
                </div>
                <div className="relative h-64 rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-indigo-100 to-blue-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80"
                    alt="Close deal"
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">{txt.step_3_title}</h3>
                <p className="text-slate-600 leading-relaxed">{txt.step_3_desc}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials with Photos */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">{txt.testimonials_title}</h2>
            <p className="text-xl text-slate-600">Ακούστε τι λένε οι influencers που μας εμπιστεύονται</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-white to-pink-50/50 p-8 rounded-3xl shadow-xl border border-slate-200 hover:shadow-2xl transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-pink-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80"
                    alt={txt.testimonial_1_name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">{txt.testimonial_1_name}</h4>
                  <p className="text-sm text-slate-600">{txt.testimonial_1_role}</p>
                  <div className="flex gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-amber-400">⭐</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-slate-700 italic text-lg leading-relaxed">"{txt.testimonial_1_text}"</p>
            </div>
            
            <div className="bg-gradient-to-br from-white to-blue-50/50 p-8 rounded-3xl shadow-xl border border-slate-200 hover:shadow-2xl transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-blue-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80"
                    alt={txt.testimonial_2_name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">{txt.testimonial_2_name}</h4>
                  <p className="text-sm text-slate-600">{txt.testimonial_2_role}</p>
                  <div className="flex gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-amber-400">⭐</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-slate-700 italic text-lg leading-relaxed">"{txt.testimonial_2_text}"</p>
            </div>
            
            <div className="bg-gradient-to-br from-white to-purple-50/50 p-8 rounded-3xl shadow-xl border border-slate-200 hover:shadow-2xl transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-purple-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80"
                    alt={txt.testimonial_3_name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">{txt.testimonial_3_name}</h4>
                  <p className="text-sm text-slate-600">{txt.testimonial_3_role}</p>
                  <div className="flex gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-amber-400">⭐</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-slate-700 italic text-lg leading-relaxed">"{txt.testimonial_3_text}"</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-6 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">{txt.cta_section_title}</h2>
          <p className="text-xl md:text-2xl text-blue-100 mb-10">{txt.cta_section_desc}</p>
          <Link 
            href="/directory" 
            className="inline-block px-12 py-5 bg-white text-blue-600 font-bold rounded-2xl hover:bg-blue-50 transition-all transform hover:scale-105 shadow-2xl text-xl"
          >
            {txt.cta_button} →
          </Link>
        </div>
      </section>

      <Footer lang={lang} />
    </div>
  );
}
