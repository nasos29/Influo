"use client";

import { useState } from "react";
import Image from "next/image";
import Directory from "../components/Directory";
import InfluencerSignupForm from "../components/InfluencerSignupForm";

type Lang = "el" | "en";

const t = {
  el: {
    nav_join: "Γίνε Influencer",
    nav_directory: "Κατάλογος",
    nav_features: "Δυνατότητες",
    nav_admin: "Admin",
    hero_badge: "ΝΕΑ ΠΛΑΤΦΟΡΜΑ",
    hero_title_1: "Σύνδεσε το ταλέντο σου",
    hero_title_2: "με κορυφαία Brands",
    hero_desc: "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Δημιούργησε το επαγγελματικό σου προφίλ και κλείσε συνεργασίες σήμερα.",
    hero_btn_primary: "Ξεκίνα Δωρεάν",
    hero_btn_secondary: "Εξερεύνηση",
    trusted_by: "ΤΗΝ ΕΜΠΙΣΤΕΥΟΝΤΑΙ CREATORS",
    dir_title: "Κατάλογος Influencers",
    dir_desc: "Ανακάλυψε τους πιο δημιουργικούς content creators ανά κατηγορία και πλατφόρμα.",
    feat_1_title: "Analytics",
    feat_1_desc: "Δες τα στατιστικά σου να μεγαλώνουν.",
    feat_2_title: "Συνεργασίες",
    feat_2_desc: "Απευθείας επικοινωνία με brands.",
    feat_3_title: "Πληρωμές",
    feat_3_desc: "Ασφαλείς και γρήγορες πληρωμές.",
    footer_rights: "Με επιφύλαξη παντός δικαιώματος.",
    footer_privacy: "Απόρρητο",
    footer_terms: "Όροι Χρήσης",
    footer_contact: "Επικοινωνία"
  },
  en: {
    nav_join: "Become an Influencer",
    nav_directory: "Directory",
    nav_features: "Features",
    nav_admin: "Admin",
    hero_badge: "NEW PLATFORM",
    hero_title_1: "Connect your talent",
    hero_title_2: "with top Brands",
    hero_desc: "The most modern Influencer Marketing platform in Greece. Create your professional profile and get hired today.",
    hero_btn_primary: "Start for Free",
    hero_btn_secondary: "Explore",
    trusted_by: "TRUSTED BY CREATORS",
    dir_title: "Influencer Directory",
    dir_desc: "Discover the most creative content creators by category and platform.",
    feat_1_title: "Analytics",
    feat_1_desc: "Watch your stats grow daily.",
    feat_2_title: "Collaborations",
    feat_2_desc: "Direct communication with brands.",
    feat_3_title: "Payments",
    feat_3_desc: "Secure and fast payouts.",
    footer_rights: "All rights reserved.",
    footer_privacy: "Privacy",
    footer_terms: "Terms",
    footer_contact: "Contact"
  }
};

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const [lang, setLang] = useState<Lang>("el");
  const txt = t[lang];

  return (
    <>
      {/* SEO Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Influo - Influencer Marketing Platform",
            "description": "Connect your talent with top brands. The most modern Influencer Marketing platform in Greece.",
            "url": process.env.NEXT_PUBLIC_SITE_URL || "https://influo.com",
            "inLanguage": ["en", "el"],
            "isPartOf": {
              "@type": "WebSite",
              "name": "Influo",
              "url": process.env.NEXT_PUBLIC_SITE_URL || "https://influo.com"
            },
            "about": {
              "@type": "Service",
              "serviceType": "Influencer Marketing Platform",
              "provider": {
                "@type": "Organization",
                "name": "Influo"
              }
            }
          })
        }}
      />
      
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 font-sans text-slate-900 selection:bg-blue-100">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
          <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
            <a href="/" className="flex items-center gap-3" aria-label="Influo Home">
              <Image 
                src="/logo-icon.svg" 
                alt="Influo Logo" 
                width={40} 
                height={40} 
                className="w-10 h-10"
                priority
              />
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent tracking-tight">Influo</h1>
            </a>
            <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
              <ul className="flex gap-8 text-sm font-semibold text-slate-700">
                <li><button onClick={() => setShowModal(true)} className="hover:text-blue-600 transition-colors relative group">
                  {txt.nav_join}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
                </button></li>
                <li><a href="#directory" className="hover:text-blue-600 transition-colors relative group">
                  {txt.nav_directory}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
                </a></li>
                <li><a href="/admin" className="hover:text-blue-600 transition-colors relative group">
                  {txt.nav_admin}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
                </a></li>
              </ul>
              {/* Lang Toggle */}
              <button 
                  onClick={() => setLang(lang === "el" ? "en" : "el")}
                  className="text-xs font-bold border-2 border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 hover:border-blue-300 text-slate-700 transition-all shadow-sm"
                  aria-label="Toggle language"
              >
                  {lang === "el" ? "🇬🇧 EN" : "🇬🇷 EL"}
              </button>
            </nav>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative pt-20 pb-32 px-6 overflow-hidden">
          {/* Background decorations */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10 max-w-7xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-5 py-2 mb-8 text-xs font-bold tracking-wider text-blue-700 uppercase bg-blue-50 border border-blue-200 rounded-full shadow-sm animate-in fade-in slide-in-from-top-4">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
              {txt.hero_badge}
            </div>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-slate-900 mb-8 leading-[1.1] tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-700">
              {txt.hero_title_1} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                {txt.hero_title_2}
              </span>
            </h2>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
              {txt.hero_desc}
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
              <button onClick={() => setShowModal(true)} className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/40">
                <span className="flex items-center justify-center gap-2">
                  {txt.hero_btn_primary}
                  <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
              <a href="#directory" className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 font-bold border-2 border-slate-200 hover:border-blue-300 rounded-xl shadow-sm hover:shadow-md transition-all transform hover:-translate-y-0.5">
                {txt.hero_btn_secondary}
              </a>
            </div>

            {/* Social Proof Images */}
            <div className="mt-20 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
              <p className="text-xs text-slate-500 mb-6 font-semibold tracking-wider uppercase">{txt.trusted_by}</p>
              <div className="flex justify-center items-center -space-x-3">
                <img className="w-14 h-14 rounded-full border-4 border-white object-cover shadow-lg hover:scale-110 transition-transform cursor-pointer" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="Creator" />
                <img className="w-14 h-14 rounded-full border-4 border-white object-cover shadow-lg hover:scale-110 transition-transform cursor-pointer" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80" alt="Creator" />
                <img className="w-14 h-14 rounded-full border-4 border-white object-cover shadow-lg hover:scale-110 transition-transform cursor-pointer" src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80" alt="Creator" />
                <div className="w-14 h-14 rounded-full border-4 border-white bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center text-xs font-bold text-slate-700 shadow-lg">+2k</div>
              </div>
            </div>
          </div>
        </section>

        {/* Directory Section */}
        <section className="py-24 px-6 bg-white/80 backdrop-blur-sm" id="directory">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">{txt.dir_title}</h3>
              <p className="text-slate-600 max-w-2xl mx-auto text-lg">{txt.dir_desc}</p>
            </div>
            {/* Περνάμε τη γλώσσα στο Directory */}
            <Directory lang={lang} /> 
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-6 bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20" id="features">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="group bg-white p-8 rounded-2xl shadow-md border border-slate-100 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 hover:border-blue-200">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">📈</div>
                  <h4 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_1_title}</h4>
                  <p className="text-slate-600 leading-relaxed">{txt.feat_1_desc}</p>
              </div>
              <div className="group bg-white p-8 rounded-2xl shadow-md border border-slate-100 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 hover:border-purple-200">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-purple-200 text-purple-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">🤝</div>
                  <h4 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_2_title}</h4>
                  <p className="text-slate-600 leading-relaxed">{txt.feat_2_desc}</p>
              </div>
              <div className="group bg-white p-8 rounded-2xl shadow-md border border-slate-100 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 hover:border-green-200">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-green-200 text-green-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-lg shadow-green-500/20 group-hover:scale-110 transition-transform">💳</div>
                  <h4 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_3_title}</h4>
                  <p className="text-slate-600 leading-relaxed">{txt.feat_3_desc}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gradient-to-br from-slate-900 to-slate-800 border-t border-slate-700 py-12 text-slate-300">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm">
            <p className="mb-4 md:mb-0">© {new Date().getFullYear()} Influo Inc. {txt.footer_rights}</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">{txt.footer_privacy}</a>
              <a href="#" className="hover:text-white transition-colors">{txt.footer_terms}</a>
              <a href="#" className="hover:text-white transition-colors">{txt.footer_contact}</a>
            </div>
          </div>
        </footer>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex justify-center items-center z-50 p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-5xl animate-in zoom-in duration-300">
               <button onClick={() => setShowModal(false)} className="absolute -top-14 right-0 text-white font-bold text-base flex items-center gap-2 hover:text-slate-300 transition-colors bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
                {lang === "el" ? "Κλείσιμο" : "Close"} <span className="text-xl">×</span>
              </button>
              <InfluencerSignupForm />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
