"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Directory from "../components/Directory";
import InfluencerSignupForm from "../components/InfluencerSignupForm";
import Footer from "../components/Footer";
import { supabase } from "@/lib/supabaseClient";

type Lang = "el" | "en";

const t = {
  el: {
    nav_join: "Εγγραφή Influencer",
    nav_brand: "Εγγραφή Επιχείρησης",
    nav_directory: "Κατάλογος",
    nav_features: "Δυνατότητες",
    nav_admin: "Admin",
    hero_badge: "ΝΕΑ ΠΛΑΤΦΟΡΜΑ",
    hero_title_1: "Σύνδεσε το ταλέντο σου",
    hero_title_2: "με κορυφαία Brands",
    hero_desc: "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Δημιούργησε το επαγγελματικό σου προφίλ και κλείσε συνεργασίες σήμερα.",
    hero_btn_primary: "Ξεκίνα Δωρεάν",
    hero_btn_brand: "Εγγραφή Επιχείρησης",
    hero_btn_secondary: "Εξερεύνηση",
    brand_section_title: "Είστε Επιχείρηση;",
    brand_section_desc: "Βρείτε τους καλύτερους influencers για την εταιρεία σας. Αναζητήστε, επικοινωνήστε και συνεργαστείτε με verified creators. 🤖 Λάβετε AI-powered προτάσεις δωρεάν!",
    brand_section_btn: "Δημιούργησε Λογαριασμό Επιχείρησης",
    trusted_by: "ΤΗΝ ΕΜΠΙΣΤΕΥΟΝΤΑΙ CREATORS",
    top_influencers: "Top Influencers",
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
    nav_brand: "For Brands",
    nav_directory: "Directory",
    nav_features: "Features",
    nav_admin: "Admin",
    hero_badge: "NEW PLATFORM",
    hero_title_1: "Connect your talent",
    hero_title_2: "with top Brands",
    hero_desc: "The most modern Influencer Marketing platform in Greece. Create your professional profile and get hired today.",
    hero_btn_primary: "Start for Free",
    hero_btn_brand: "For Brands",
    hero_btn_secondary: "Explore",
    brand_section_title: "Are you a Company?",
    brand_section_desc: "Find the best influencers for your company. Search, connect and collaborate with verified creators. 🤖 Get AI-powered recommendations for free!",
    brand_section_btn: "Create Company Account",
    trusted_by: "TRUSTED BY CREATORS",
    top_influencers: "Top Influencers",
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

interface VerifiedBrand {
  id: string;
  brand_name: string;
  logo_url: string | null;
  website: string | null;
}

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const [lang, setLang] = useState<Lang>("el");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [verifiedBrands, setVerifiedBrands] = useState<VerifiedBrand[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userType, setUserType] = useState<'influencer' | 'brand' | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const txt = t[lang];

  // Check if user is logged in and get user type
  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        
        // Check if user is influencer
        const { data: influencerData } = await supabase
          .from('influencers')
          .select('avatar_url, display_name')
          .eq('contact_email', user.email)
          .maybeSingle();
        
        if (influencerData) {
          setUserType('influencer');
          setUserAvatar(influencerData.avatar_url);
          setUserName(influencerData.display_name);
        } else {
          // Check if user is brand
          const { data: brandDataByContact } = await supabase
            .from('brands')
            .select('logo_url, brand_name')
            .ilike('contact_email', user.email || '')
            .maybeSingle();
          
          if (brandDataByContact) {
            setUserType('brand');
            setUserAvatar(brandDataByContact.logo_url);
            setUserName(brandDataByContact.brand_name);
          } else {
            const { data: brandDataByEmail } = await supabase
              .from('brands')
              .select('logo_url, brand_name')
              .ilike('email', user.email || '')
              .maybeSingle();
            
            if (brandDataByEmail) {
              setUserType('brand');
              setUserAvatar(brandDataByEmail.logo_url);
              setUserName(brandDataByEmail.brand_name);
            }
          }
        }
      } else {
        setIsLoggedIn(false);
        setUserType(null);
        setUserAvatar(null);
        setUserName(null);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        
        // Check if user is influencer
        const { data: influencerData } = await supabase
          .from('influencers')
          .select('avatar_url, display_name')
          .eq('contact_email', session.user.email)
          .maybeSingle();
        
        if (influencerData) {
          setUserType('influencer');
          setUserAvatar(influencerData.avatar_url);
          setUserName(influencerData.display_name);
        } else {
          // Check if user is brand
          const { data: brandDataByContact } = await supabase
            .from('brands')
            .select('logo_url, brand_name')
            .ilike('contact_email', session.user.email || '')
            .maybeSingle();
          
          if (brandDataByContact) {
            setUserType('brand');
            setUserAvatar(brandDataByContact.logo_url);
            setUserName(brandDataByContact.brand_name);
          } else {
            const { data: brandDataByEmail } = await supabase
              .from('brands')
              .select('logo_url, brand_name')
              .ilike('email', session.user.email || '')
              .maybeSingle();
            
            if (brandDataByEmail) {
              setUserType('brand');
              setUserAvatar(brandDataByEmail.logo_url);
              setUserName(brandDataByEmail.brand_name);
            }
          }
        }
      } else {
        setIsLoggedIn(false);
        setUserType(null);
        setUserAvatar(null);
        setUserName(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch verified brands
  useEffect(() => {
    const fetchVerifiedBrands = async () => {
      try {
        const { data, error } = await supabase
          .from('brands')
          .select('id, brand_name, logo_url, website')
          .eq('verified', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching verified brands:', error);
          return;
        }

        if (data && data.length > 0) {
          console.log('[Homepage] Fetched verified brands:', data);
          setVerifiedBrands(data as VerifiedBrand[]);
        }
      } catch (err) {
        console.error('Error in fetchVerifiedBrands:', err);
      }
    };

    fetchVerifiedBrands();
  }, []);

  return (
    <>
      {/* SEO Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Influo.gr - Πλατφόρμα Influencer Marketing",
            "description": "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Σύνδεσε το ταλέντο σου με κορυφαίες Επιχειρήσεις.",
            "url": process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr",
            "inLanguage": "el",
            "alternateName": {
              "en": "Influo.gr - Influencer Marketing Platform",
              "el": "Influo.gr - Πλατφόρμα Influencer Marketing"
            },
            "isPartOf": {
              "@type": "WebSite",
              "name": "Influo.gr",
              "url": process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr",
              "inLanguage": "el"
            },
            "about": {
              "@type": "Service",
              "serviceType": "Πλατφόρμα Influencer Marketing",
              "provider": {
                "@type": "Organization",
                "name": "Influo.gr"
              }
            }
          })
        }}
      />
      
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30 font-sans text-slate-900 selection:bg-purple-200">
      {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 py-4">
            <a href="/" className="flex items-center gap-2" aria-label="Influo Home">
              <Image 
                src="/logo.svg" 
                alt="Influo.gr Logo" 
                width={160} 
                height={64} 
                className="h-10 w-auto"
                priority
              />
            </a>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
              <ul className="flex gap-6 text-sm font-medium text-slate-700">
                {!isLoggedIn && (
                  <>
                    <li><button onClick={() => setShowModal(true)} className="hover:text-slate-900 transition-colors">
                      {txt.nav_join}
                    </button></li>
                    <li><a href="/brand/signup" className="hover:text-slate-900 transition-colors">
                      {txt.nav_brand}
                    </a></li>
                  </>
                )}
                <li><a href="/directory" className="hover:text-slate-900 transition-colors">
                  {txt.nav_directory}
                </a></li>
                {isLoggedIn ? (
                  <li><a href={userType === 'brand' ? '/brand/dashboard' : '/dashboard'} className="hover:text-slate-900 transition-colors">
                    {lang === "el" ? "Dashboard" : "Dashboard"}
                  </a></li>
                ) : (
                  <li><a href="/login" className="hover:text-slate-900 transition-colors">
                    {lang === "el" ? "Σύνδεση" : "Sign In"}
                  </a></li>
                )}
            </ul>
            {/* User Avatar/Logo and Lang Toggle */}
            <div className="flex items-center gap-3">
              {isLoggedIn && (
                <a 
                  href={userType === 'brand' ? '/brand/dashboard' : '/dashboard'}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="w-10 h-10 rounded-full border-2 border-slate-300 overflow-hidden bg-slate-100 flex items-center justify-center">
                    {userAvatar ? (
                      <Image
                        src={userAvatar}
                        alt={userName || 'Profile'}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold text-sm">
                        {userName ? userName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>
                </a>
              )}
              <button 
                onClick={() => setLang(lang === "el" ? "en" : "el")}
                className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
                aria-label="Toggle language"
              >
                {lang === "el" ? "EN" : "EL"}
              </button>
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-3 md:hidden">
            {isLoggedIn ? (
              <a 
                href={userType === 'brand' ? '/brand/dashboard' : '/dashboard'}
                className="flex items-center"
              >
                <div className="w-10 h-10 rounded-full border-2 border-slate-300 overflow-hidden bg-slate-100 flex items-center justify-center">
                  {userAvatar ? (
                    <Image
                      src={userAvatar}
                      alt={userName || 'Profile'}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold text-sm">
                      {userName ? userName.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                </div>
              </a>
            ) : (
              <button 
                onClick={() => setLang(lang === "el" ? "en" : "el")}
                className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
                aria-label="Toggle language"
              >
                {lang === "el" ? "EN" : "EL"}
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-slate-200 bg-white">
            <div className="px-4 py-3 space-y-2">
              <button 
                onClick={() => {
                  setShowModal(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
              >
                {txt.nav_join}
              </button>
              <a 
                href="/brand/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
              >
                {txt.nav_brand}
              </a>
              <a 
                href="/directory"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
              >
                {txt.nav_directory}
              </a>
              {isLoggedIn ? (
                <a 
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
                >
                  Dashboard
                </a>
              ) : (
                <a 
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
                >
                  {lang === "el" ? "Σύνδεση" : "Sign In"}
                </a>
              )}
            </div>
          </nav>
        )}
      </header>

      {/* Hero Section */}
        <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 px-6 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
          {/* Gray background with handshake pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100"></div>
          
          {/* Decorative background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-100/10 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-8 lg:gap-12 items-center">
              
              {/* Left Image */}
              <div className="hidden lg:block relative h-[500px] rounded-2xl overflow-hidden shadow-2xl">
                <Image 
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80"
                  alt="Creative content creator"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
              
              {/* Center Content */}
              <div className="lg:col-span-1 text-center lg:text-left">
                <h1 className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-slate-900 mb-6 leading-[1.1] tracking-tight">
                  <span className="block">{txt.hero_title_1}</span>
                  <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {txt.hero_title_2}
                  </span>
                </h1>
                <p className="text-lg md:text-xl lg:text-2xl text-slate-600 mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                  {txt.hero_desc}
                </p>
                
                <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
                  <button 
                    onClick={() => setShowModal(true)} 
                    className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg hover:shadow-xl text-lg"
                  >
                    {txt.hero_btn_primary}
                  </button>
                  <a 
                    href="#directory" 
                    className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 font-semibold border-2 border-slate-200 rounded-xl transition-all transform hover:scale-105 shadow-md hover:shadow-lg text-lg"
                  >
                    {txt.hero_btn_secondary}
                  </a>
                </div>
              </div>
              
              {/* Right Image */}
              <div className="hidden lg:block relative h-[500px] rounded-2xl overflow-hidden shadow-2xl">
                <Image 
                  src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80"
                  alt="Company collaboration"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
            </div>
            
            {/* Mobile Images - Stack below */}
            <div className="lg:hidden grid grid-cols-2 gap-4 mt-12">
              <div className="relative h-[300px] rounded-2xl overflow-hidden shadow-xl">
                <Image 
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80"
                  alt="Creative content creator"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
              <div className="relative h-[300px] rounded-2xl overflow-hidden shadow-xl">
                <Image 
                  src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80"
                  alt="Company collaboration"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
            </div>
          </div>
        </section>

      {/* Directory Section */}
        <section className="relative py-20 px-6 bg-white" id="directory">
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
          <div className="relative max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">{txt.dir_title}</h3>
            <p className="text-slate-600 max-w-2xl mx-auto">{txt.dir_desc}</p>
          </div>
          {/* Περνάμε τη γλώσσα στο Directory */}
          <Directory lang={lang} /> 
        </div>
      </section>

      {/* Brand Section */}
        <section className="relative py-20 px-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50" id="brands">
          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{txt.brand_section_title}</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">{txt.brand_section_desc}</p>
              <a 
                href="/brand/signup"
                className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg hover:shadow-xl text-lg"
              >
                {txt.brand_section_btn}
              </a>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-blue-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl mb-4 transition-transform duration-300 hover:scale-110">🔍</div>
                <h4 className="text-lg font-semibold text-slate-900 mb-2">{lang === "el" ? "Αναζήτηση" : "Search"}</h4>
                <p className="text-slate-600 text-sm leading-relaxed">{lang === "el" ? "Βρείτε influencers ανά κατηγορία, engagement rate και budget." : "Find influencers by category, engagement rate and budget."}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-indigo-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-2xl mb-4 transition-transform duration-300 hover:scale-110">💼</div>
                <h4 className="text-lg font-semibold text-slate-900 mb-2">{lang === "el" ? "Διαχείριση" : "Management"}</h4>
                <p className="text-slate-600 text-sm leading-relaxed">{lang === "el" ? "Διαχειριστείτε όλες τις συνεργασίες σας από ένα μέρος." : "Manage all your collaborations from one place."}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-purple-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl mb-4 transition-transform duration-300 hover:scale-110">✅</div>
                <h4 className="text-lg font-semibold text-slate-900 mb-2">{lang === "el" ? "Verified" : "Verified"}</h4>
                <p className="text-slate-600 text-sm leading-relaxed">{lang === "el" ? "Όλοι οι influencers είναι verified με πραγματικά στοιχεία." : "All influencers are verified with real stats."}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-xl border-2 border-blue-400 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 text-white md:col-span-2 lg:col-span-1">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-2xl mb-4 transition-transform duration-300 hover:scale-110">🤖</div>
                <div className="inline-block px-2 py-1 bg-green-500 rounded-full text-xs font-bold mb-2">🎁 {lang === "el" ? "ΔΩΡΕΑΝ" : "FREE"}</div>
                <h4 className="text-lg font-semibold mb-2">{lang === "el" ? "AI Προτάσεις" : "AI Recommendations"}</h4>
                <p className="text-blue-100 text-sm leading-relaxed">{lang === "el" ? "Το AI μας προτείνει αυτόματα τους καλύτερους influencers για το brand σας με match scores." : "Our AI automatically suggests the best influencers for your brand with match scores."}</p>
              </div>
            </div>
          </div>
        </section>

      {/* Brands Logos Slideshow */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">
              {lang === "el" ? "Συνεργάζονται μαζί μας" : "Trusted by"}
            </h3>
            <p className="text-slate-500 text-sm md:text-base">
              {lang === "el" ? "Αξιόπιστα brands που συνεργάζονται με influencers μέσω της πλατφόρμας μας" : "Trusted brands collaborating with influencers through our platform"}
            </p>
          </div>
          
          {/* Slideshow Container with gradient fade */}
          <div className="relative overflow-hidden">
            {/* Left gradient fade */}
            <div className="absolute left-0 top-0 bottom-0 w-32 md:w-48 lg:w-64 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none"></div>
            {/* Right gradient fade */}
            <div className="absolute right-0 top-0 bottom-0 w-32 md:w-48 lg:w-64 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none"></div>
            
            <div className="flex animate-scroll gap-8 md:gap-12 lg:gap-16 items-center">
              {/* Verified Brands from Database */}
              {verifiedBrands.map((brand) => {
                const websiteUrl = brand.website 
                  ? (brand.website.startsWith('http') ? brand.website : `https://${brand.website}`)
                  : null;
                
                console.log('[Homepage] Rendering brand:', brand.brand_name, 'logo_url:', brand.logo_url);
                
                return (
                  <a 
                    key={brand.id}
                    href={websiteUrl || '#'}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="flex-shrink-0 flex items-center justify-center h-12 md:h-16 lg:h-20 opacity-60 hover:opacity-100 transition-opacity duration-300"
                  >
                    {brand.logo_url ? (
                      <img 
                        src={brand.logo_url}
                        alt={brand.brand_name}
                        className="h-full w-auto max-w-[180px] md:max-w-[220px] lg:max-w-[260px] object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                        loading="lazy"
                        onLoad={() => {
                          console.log('[Homepage] Logo loaded successfully:', brand.brand_name, brand.logo_url);
                        }}
                        onError={(e) => {
                          console.error('[Homepage] Logo failed to load:', brand.brand_name, brand.logo_url, e);
                          // Fallback to text if logo fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.text-fallback')) {
                            const textFallback = document.createElement('div');
                            textFallback.className = 'text-fallback font-semibold text-sm md:text-base lg:text-lg text-slate-400 whitespace-nowrap';
                            textFallback.textContent = brand.brand_name;
                            parent.appendChild(textFallback);
                          }
                        }}
                      />
                    ) : (
                      <div className="font-semibold text-sm md:text-base lg:text-lg text-slate-400 whitespace-nowrap">
                        {brand.brand_name}
                      </div>
                    )}
                  </a>
                );
              })}
              
              {/* Dummy Data Brands - Always show */}
              {[
                { name: 'Nike', domain: 'nike.com', url: 'https://www.nike.com' },
                { name: 'Apple', domain: 'apple.com', url: 'https://www.apple.com' },
                { name: 'Skroutz', domain: 'skroutz.gr', url: 'https://www.skroutz.gr' },
                { name: 'Samsung', domain: 'samsung.com', url: 'https://www.samsung.com' },
                { name: 'Zara', domain: 'zara.com', url: 'https://www.zara.com' },
                { name: 'Microsoft', domain: 'microsoft.com', url: 'https://www.microsoft.com' },
                { name: 'Vodafone', domain: 'vodafone.gr', url: 'https://www.vodafone.gr' },
                { name: 'Adidas', domain: 'adidas.com', url: 'https://www.adidas.com' },
                { name: 'Google', domain: 'google.com', url: 'https://www.google.com' },
                { name: 'Cosmote', domain: 'cosmote.gr', url: 'https://www.cosmote.gr' },
                { name: 'H&M', domain: 'hm.com', url: 'https://www.hm.com' },
                { name: 'Dell', domain: 'dell.com', url: 'https://www.dell.com' },
                { name: 'Mango', domain: 'mango.com', url: 'https://www.mango.com' },
                { name: 'HP', domain: 'hp.com', url: 'https://www.hp.com' },
                { name: 'Kotsovolos', domain: 'kotsovolos.gr', url: 'https://www.kotsovolos.gr' },
                { name: 'Lenovo', domain: 'lenovo.com', url: 'https://www.lenovo.com' },
                { name: 'Alpha Bank', domain: 'alpha.gr', url: 'https://www.alpha.gr' },
                { name: 'Asus', domain: 'asus.com', url: 'https://www.asus.com' },
                { name: 'Coffee Island', domain: 'coffeeisland.gr', url: 'https://www.coffeeisland.gr' },
                { name: 'Temu', domain: 'temu.com', url: 'https://www.temu.com' },
                { name: 'Sony', domain: 'sony.com', url: 'https://www.sony.com' },
                { name: 'Everest', domain: 'everest.gr', url: 'https://www.everest.gr' },
                { name: 'Wolt', domain: 'wolt.com', url: 'https://wolt.com' },
                { name: 'e-Food', domain: 'e-food.gr', url: 'https://www.e-food.gr' },
                { name: 'MyMarket', domain: 'mymarket.gr', url: 'https://www.mymarket.gr' },
                { name: 'Gregory\'s', domain: 'gregorys.gr', url: 'https://www.gregorys.gr' },
                { name: 'Aegean Airlines', domain: 'aegeanair.com', url: 'https://www.aegeanair.com' },
                { name: 'Hellenic Petroleum', domain: 'helpe.gr', url: 'https://www.helpe.gr' }
              ].map((brand, idx) => {
                const brandfetchUrl = `https://cdn.brandfetch.io/${brand.domain}?c=1idGP6EnrL-eVdz6PLO`;
                return (
                  <a 
                    key={`dummy-${idx}`}
                    href={brand.url}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="flex-shrink-0 flex items-center justify-center h-12 md:h-16 lg:h-20 opacity-60 hover:opacity-100 transition-opacity duration-300"
                  >
                    <img 
                      src={brandfetchUrl}
                      alt={brand.name}
                      className="h-full w-auto max-w-[180px] md:max-w-[220px] lg:max-w-[260px] object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to text if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        if (!target.nextElementSibling) {
                          const textFallback = document.createElement('div');
                          textFallback.className = 'font-semibold text-sm md:text-base lg:text-lg text-slate-400 whitespace-nowrap';
                          textFallback.textContent = brand.name;
                          target.parentElement?.appendChild(textFallback);
                        }
                      }}
                    />
                  </a>
                );
              })}
              
              {/* Duplicate verified brands for seamless loop */}
              {verifiedBrands.map((brand) => {
                const websiteUrl = brand.website 
                  ? (brand.website.startsWith('http') ? brand.website : `https://${brand.website}`)
                  : null;
                
                return (
                  <a 
                    key={`dup-verified-${brand.id}`}
                    href={websiteUrl || '#'}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="flex-shrink-0 flex items-center justify-center h-12 md:h-16 lg:h-20 opacity-60 hover:opacity-100 transition-opacity duration-300"
                  >
                    {brand.logo_url ? (
                      <img 
                        src={brand.logo_url}
                        alt={brand.brand_name}
                        className="h-full w-auto max-w-[180px] md:max-w-[220px] lg:max-w-[260px] object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.text-fallback')) {
                            const textFallback = document.createElement('div');
                            textFallback.className = 'text-fallback font-semibold text-sm md:text-base lg:text-lg text-slate-400 whitespace-nowrap';
                            textFallback.textContent = brand.brand_name;
                            parent.appendChild(textFallback);
                          }
                        }}
                      />
                    ) : (
                      <div className="font-semibold text-sm md:text-base lg:text-lg text-slate-400 whitespace-nowrap">
                        {brand.brand_name}
                      </div>
                    )}
                  </a>
                );
              })}
              
              {/* Duplicate dummy data for seamless loop */}
              {[
                { name: 'Nike', domain: 'nike.com', url: 'https://www.nike.com' },
                { name: 'Apple', domain: 'apple.com', url: 'https://www.apple.com' },
                { name: 'Skroutz', domain: 'skroutz.gr', url: 'https://www.skroutz.gr' },
                { name: 'Samsung', domain: 'samsung.com', url: 'https://www.samsung.com' },
                { name: 'Zara', domain: 'zara.com', url: 'https://www.zara.com' },
                { name: 'Microsoft', domain: 'microsoft.com', url: 'https://www.microsoft.com' },
                { name: 'Vodafone', domain: 'vodafone.gr', url: 'https://www.vodafone.gr' },
                { name: 'Adidas', domain: 'adidas.com', url: 'https://www.adidas.com' },
                { name: 'Google', domain: 'google.com', url: 'https://www.google.com' },
                { name: 'Cosmote', domain: 'cosmote.gr', url: 'https://www.cosmote.gr' },
                { name: 'H&M', domain: 'hm.com', url: 'https://www.hm.com' },
                { name: 'Dell', domain: 'dell.com', url: 'https://www.dell.com' },
                { name: 'Mango', domain: 'mango.com', url: 'https://www.mango.com' },
                { name: 'HP', domain: 'hp.com', url: 'https://www.hp.com' },
                { name: 'Kotsovolos', domain: 'kotsovolos.gr', url: 'https://www.kotsovolos.gr' },
                { name: 'Lenovo', domain: 'lenovo.com', url: 'https://www.lenovo.com' },
                { name: 'Alpha Bank', domain: 'alpha.gr', url: 'https://www.alpha.gr' },
                { name: 'Asus', domain: 'asus.com', url: 'https://www.asus.com' },
                { name: 'Coffee Island', domain: 'coffeeisland.gr', url: 'https://www.coffeeisland.gr' },
                { name: 'Temu', domain: 'temu.com', url: 'https://www.temu.com' },
                { name: 'Sony', domain: 'sony.com', url: 'https://www.sony.com' },
                { name: 'Everest', domain: 'everest.gr', url: 'https://www.everest.gr' },
                { name: 'Wolt', domain: 'wolt.com', url: 'https://wolt.com' },
                { name: 'e-Food', domain: 'e-food.gr', url: 'https://www.e-food.gr' },
                { name: 'MyMarket', domain: 'mymarket.gr', url: 'https://www.mymarket.gr' },
                { name: 'Gregory\'s', domain: 'gregorys.gr', url: 'https://www.gregorys.gr' },
                { name: 'Aegean Airlines', domain: 'aegeanair.com', url: 'https://www.aegeanair.com' },
                { name: 'Hellenic Petroleum', domain: 'helpe.gr', url: 'https://www.helpe.gr' }
              ].map((brand, idx) => {
                const brandfetchUrl = `https://cdn.brandfetch.io/${brand.domain}?c=1idGP6EnrL-eVdz6PLO`;
                return (
                  <a 
                    key={`dup-${idx}`}
                    href={brand.url}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="flex-shrink-0 flex items-center justify-center h-12 md:h-16 lg:h-20 opacity-60 hover:opacity-100 transition-opacity duration-300"
                  >
                    <img 
                      src={brandfetchUrl}
                      alt={brand.name}
                      className="h-full w-auto max-w-[180px] md:max-w-[220px] lg:max-w-[260px] object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        if (!target.nextElementSibling) {
                          const textFallback = document.createElement('div');
                          textFallback.className = 'font-semibold text-sm md:text-base lg:text-lg text-slate-400 whitespace-nowrap';
                          textFallback.textContent = brand.name;
                          target.parentElement?.appendChild(textFallback);
                        }
                      }}
                    />
                  </a>
                );
              })}

            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer lang={lang} />

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
