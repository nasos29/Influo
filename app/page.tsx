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
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">I</div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Influo</h1>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <ul className="flex gap-8 text-sm font-medium text-slate-600">
              <li><button onClick={() => setShowModal(true)} className="hover:text-blue-600 transition-colors">{txt.nav_join}</button></li>
              <li><a href="#directory" className="hover:text-blue-600 transition-colors">{txt.nav_directory}</a></li>
              <li><a href="/admin" className="hover:text-blue-600 transition-colors">{txt.nav_admin}</a></li>
            </ul>
            {/* Lang Toggle */}
            <button 
                onClick={() => setLang(lang === "el" ? "en" : "el")}
                className="text-xs font-bold border border-slate-300 px-2 py-1 rounded hover:bg-slate-100 text-slate-700"
            >
                {lang === "el" ? "🇬🇧 EN" : "🇬🇷 EL"}
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 px-6 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider text-blue-800 uppercase bg-blue-100 rounded-full">
            {txt.hero_badge}
          </div>
          <h2 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-8 leading-tight tracking-tight">
            {txt.hero_title_1} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              {txt.hero_title_2}
            </span>
          </h2>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            {txt.hero_desc}
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={() => setShowModal(true)} className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-1">
              {txt.hero_btn_primary}
            </button>
            <a href="#directory" className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 rounded-xl shadow-sm transition-all">
              {txt.hero_btn_secondary}
            </a>
          </div>

          {/* Social Proof Images */}
          <div className="mt-16">
            <p className="text-sm text-slate-500 mb-4 font-medium">{txt.trusted_by}</p>
            <div className="flex justify-center -space-x-4">
              <img className="w-12 h-12 rounded-full border-4 border-white object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="User" />
              <img className="w-12 h-12 rounded-full border-4 border-white object-cover" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80" alt="User" />
              <img className="w-12 h-12 rounded-full border-4 border-white object-cover" src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80" alt="User" />
              <div className="w-12 h-12 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">+2k</div>
            </div>
          </div>
        </div>
      </section>

      {/* Directory Section */}
      <section className="py-24 px-6 bg-white" id="directory">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{txt.dir_title}</h3>
            <p className="text-slate-600 max-w-2xl mx-auto">{txt.dir_desc}</p>
          </div>
          {/* Περνάμε τη γλώσσα στο Directory */}
          <Directory lang={lang} /> 
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-slate-50" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-10">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-6">📈</div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_1_title}</h4>
                <p className="text-slate-600">{txt.feat_1_desc}</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-2xl mb-6">🤝</div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_2_title}</h4>
                <p className="text-slate-600">{txt.feat_2_desc}</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center text-2xl mb-6">💳</div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">{txt.feat_3_title}</h4>
                <p className="text-slate-600">{txt.feat_3_desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} Influo Inc. {txt.footer_rights}</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-slate-900">{txt.footer_privacy}</a>
            <a href="#" className="hover:text-slate-900">{txt.footer_terms}</a>
            <a href="#" className="hover:text-slate-900">{txt.footer_contact}</a>
          </div>
        </div>
      </footer>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="relative w-full max-w-5xl animate-in fade-in zoom-in duration-300">
             <button onClick={() => setShowModal(false)} className="absolute -top-12 right-0 text-white font-bold text-lg flex items-center gap-2">
              {lang === "el" ? "Κλείσιμο" : "Close"} <span className="text-2xl">×</span>
            </button>
            <InfluencerSignupForm />
          </div>
        </div>
      )}
    </div>
  );
}


















