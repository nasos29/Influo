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
    hero_desc: "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Αναζητήστε, επικοινωνήστε και συνεργαστείτε με επαγγελματίες influencers. 🤖 Χρησιμοποιήστε την έξυπνη υπηρεσία AI προτάσεων για να βρείτε τους καλύτερους influencers - ΔΩΡΕΑΝ!",
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
    
    feat_7_title: "🤖 Έξυπνη Υπηρεσία Προτάσεων",
    feat_7_desc: "Το AI μας αναλύει το brand σας και προτείνει αυτόματα τους καλύτερους influencers. Match score, προσωποποιημένες αιτιολογίες και advanced filters. ΔΩΡΕΑΝ για όλες τις εγγεγραμμένες επιχειρήσεις!",
    
    how_title: "Πώς Λειτουργεί",
    step_1_title: "1. Εγγραφείτε ως Brand",
    step_1_desc: "Δημιουργήστε λογαριασμό brand, συμπληρώστε τα στοιχεία της εταιρείας σας και λάβετε πρόσβαση στο κατάλογο.",
    
    step_2_title: "2. Αναζητήστε Influencers",
    step_2_desc: "Χρησιμοποιήστε τα φίλτρα για να βρείτε influencers που ταιριάζουν στο niche σας και το budget σας. Ή αφήστε το AI να σας προτείνει τους καλύτερους matches με match scores!",
    
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
    hero_desc: "The most modern Influencer Marketing platform in Greece. Search, connect and collaborate with professional influencers. 🤖 Use our smart AI recommendation service to find the best influencers - FREE!",
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
    
    feat_7_title: "🤖 Smart Recommendation Service",
    feat_7_desc: "Our AI analyzes your brand and automatically suggests the best influencers. Match scores, personalized reasons, and advanced filters. FREE for all registered businesses!",
    
    how_title: "How It Works",
    step_1_title: "1. Sign Up as Brand",
    step_1_desc: "Create a brand account, fill in your company details and get access to the directory.",
    
    step_2_title: "2. Search Influencers",
    step_2_desc: "Use filters to find influencers that match your niche and budget. Or let AI suggest the best matches with match scores!",
    
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
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
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

      {/* Hero Section with Image */}
      <section className="relative pt-20 pb-32 px-6 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white overflow-hidden">
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
                🏆 Trusted by 200+ Brands
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
                  href="/brand/signup" 
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
                  <div className="text-sm text-blue-200">Verified Influencers</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">98%</div>
                  <div className="text-sm text-blue-200">Success Rate</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">24h</div>
                  <div className="text-sm text-blue-200">Avg Response Time</div>
                </div>
              </div>
            </div>
            
            {/* Right Image */}
            <div className="relative h-[500px] lg:h-[600px] rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20">
              <Image 
                src="https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1200&q=80"
                alt="Brand collaboration success"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900/50 to-transparent"></div>
              {/* Floating Stats Card */}
              <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-600 font-medium mb-1">Average Campaign ROI</div>
                    <div className="text-3xl font-bold text-green-600">340%</div>
                  </div>
                  <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center">
                    <span className="text-3xl">📈</span>
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
              Όλα όσα χρειάζεται το Brand σας
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Εργαλεία και features για αποτελεσματική διαχείριση influencer campaigns
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group bg-gradient-to-br from-white to-blue-50/50 p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all hover:-translate-y-2">
              <div className="relative w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform">
                <span className="text-4xl">🔍</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{txt.feat_1_title.replace('🔍 ', '')}</h3>
              <p className="text-slate-600 leading-relaxed">{txt.feat_1_desc}</p>
              <div className="mt-6 relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100">
                <Image 
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80"
                  alt="Advanced search"
                  fill
                  className="object-cover opacity-80"
                />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group bg-gradient-to-br from-white to-green-50/50 p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all hover:-translate-y-2">
              <div className="relative w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform">
                <span className="text-4xl">✅</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{txt.feat_2_title.replace('✅ ', '')}</h3>
              <p className="text-slate-600 leading-relaxed">{txt.feat_2_desc}</p>
              <div className="mt-6 relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-green-100 to-emerald-100">
                <Image 
                  src="https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=600&q=80"
                  alt="Verified creators"
                  fill
                  className="object-cover opacity-80"
                />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group bg-gradient-to-br from-white to-purple-50/50 p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all hover:-translate-y-2">
              <div className="relative w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-600 rounded-2xl flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform">
                <span className="text-4xl">💼</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{txt.feat_3_title.replace('💼 ', '')}</h3>
              <p className="text-slate-600 leading-relaxed">{txt.feat_3_desc}</p>
              <div className="mt-6 relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100">
                <Image 
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80"
                  alt="Easy management"
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
                <span className="text-4xl">📊</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{txt.feat_5_title.replace('📊 ', '')}</h3>
              <p className="text-slate-600 leading-relaxed">{txt.feat_5_desc}</p>
              <div className="mt-6 relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-amber-100 to-orange-100">
                <Image 
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80"
                  alt="Detailed analytics"
                  fill
                  className="object-cover opacity-80"
                />
              </div>
            </div>

            {/* Feature 6 */}
            <div className="group bg-gradient-to-br from-white to-indigo-50/50 p-8 rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all hover:-translate-y-2">
              <div className="relative w-20 h-20 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-2xl flex items-center justify-center mb-6 transform group-hover:scale-110 transition-transform">
                <span className="text-4xl">⚡</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{txt.feat_6_title.replace('⚡ ', '')}</h3>
              <p className="text-slate-600 leading-relaxed">{txt.feat_6_desc}</p>
              <div className="mt-6 relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100">
                <Image 
                  src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80"
                  alt="Quick discovery"
                  fill
                  className="object-cover opacity-80"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Recommendation System - Dedicated Section */}
      <section className="py-24 px-6 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v22H20v-1.5zM0 20h2v20H0V20zm4 0h2v20H4V20zm4 0h2v20H8V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 4h20v2H20v-2zm0 4h20v2H20v-2zm0 4h20v2H20v-2zm0 4h20v2H20v-2z'/%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-green-500 rounded-full text-sm font-bold mb-4">
              🎁 100% ΔΩΡΕΑΝ - FREE FOREVER
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">🤖 Έξυπνη Υπηρεσία Προτάσεων AI</h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Το AI μας αναλύει το brand σας και προτείνει αυτόματα τους καλύτερους influencers. Δεν χρειάζεται να ψάχνετε - το σύστημα σας βρίσκει τους τέλειους matches!
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold mb-2">Match Score</h3>
              <p className="text-blue-100 text-sm">Κάθε πρόταση έχει score 0-100% που δείχνει πόσο καλά ταιριάζει με το brand σας.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="text-4xl mb-4">🧠</div>
              <h3 className="text-xl font-bold mb-2">AI-Powered</h3>
              <p className="text-blue-100 text-sm">Το σύστημα αναλύει category, engagement, ratings, και value για προσωποποιημένες προτάσεις.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-bold mb-2">Advanced Filters</h3>
              <p className="text-blue-100 text-sm">Φιλτράρετε με budget, engagement rate, rating, κατηγορία, και πολλά άλλα.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold mb-2">Analytics</h3>
              <p className="text-blue-100 text-sm">Βλέπετε stats: πόσες προτάσεις είδατε, προφίλ που επισκεφτήκατε, προσφορές που στείλατε.</p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-white/20">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-3xl font-bold mb-4">Πώς λειτουργεί;</h3>
                <ul className="space-y-3 text-blue-100">
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl flex-shrink-0">✓</span>
                    <span>Το AI αναλύει το industry και τα προφίλ σας</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl flex-shrink-0">✓</span>
                    <span>Υπολογίζει match score για κάθε influencer</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl flex-shrink-0">✓</span>
                    <span>Προτείνει τους top matches με προσωποποιημένες αιτιολογίες</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 text-xl flex-shrink-0">✓</span>
                    <span>Μπορείτε να φιλτράρετε και να ανανεώνετε ανά πάσα στιγμή</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Link
                    href="/brand/signup"
                    className="inline-block px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all transform hover:scale-105 shadow-xl"
                  >
                    Ξεκινήστε Δωρεάν →
                  </Link>
                </div>
              </div>
              <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden bg-gradient-to-br from-white/20 to-white/5 border border-white/30">
                <Image
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80"
                  alt="AI Recommendations"
                  fill
                  className="object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/50 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900">Match Score: 92%</span>
                      <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">Excellent</span>
                    </div>
                    <p className="text-xs text-slate-600">Perfect match for your brand!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works with Visual Steps */}
      <section className="py-24 px-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">{txt.how_title}</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Από την εγγραφή στην πρώτη συνεργασία σε 4 απλά βήματα
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="relative">
              <div className="relative bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center hover:shadow-2xl transition-all">
                <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-3xl">1️⃣</span>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-blue-400 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg">
                    1
                  </div>
                </div>
                <div className="relative h-48 rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-blue-100 to-blue-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80"
                    alt="Sign up"
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.step_1_title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{txt.step_1_desc}</p>
              </div>
            </div>
            
            <div className="relative">
              <div className="relative bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center hover:shadow-2xl transition-all">
                <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-3xl">2️⃣</span>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-purple-400 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg">
                    2
                  </div>
                </div>
                <div className="relative h-48 rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-purple-100 to-pink-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80"
                    alt="Search influencers"
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.step_2_title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{txt.step_2_desc}</p>
              </div>
            </div>
            
            <div className="relative">
              <div className="relative bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center hover:shadow-2xl transition-all">
                <div className="relative w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-3xl">3️⃣</span>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-indigo-400 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg">
                    3
                  </div>
                </div>
                <div className="relative h-48 rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-indigo-100 to-blue-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=600&q=80"
                    alt="Send proposal"
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.step_3_title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{txt.step_3_desc}</p>
              </div>
            </div>
            
            <div className="relative">
              <div className="relative bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center hover:shadow-2xl transition-all">
                <div className="relative w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-3xl">4️⃣</span>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-green-400 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg">
                    4
                  </div>
                </div>
                <div className="relative h-48 rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-green-100 to-emerald-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&q=80"
                    alt="Close deal"
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{txt.step_4_title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{txt.step_4_desc}</p>
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
            <p className="text-xl text-slate-600">Ακούστε τι λένε τα brands που μας εμπιστεύονται</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-white to-blue-50/50 p-8 rounded-3xl shadow-xl border border-slate-200 hover:shadow-2xl transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-blue-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&q=80"
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
            
            <div className="bg-gradient-to-br from-white to-purple-50/50 p-8 rounded-3xl shadow-xl border border-slate-200 hover:shadow-2xl transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-purple-200">
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
            
            <div className="bg-gradient-to-br from-white to-green-50/50 p-8 rounded-3xl shadow-xl border border-slate-200 hover:shadow-2xl transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-green-200">
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
      <section className="relative py-24 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white overflow-hidden">
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
            href="/brand/signup" 
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
