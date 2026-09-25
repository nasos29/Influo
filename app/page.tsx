"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Directory from "../components/Directory";
import InfluencerSignupForm from "../components/InfluencerSignupForm";
import BrandSignupForm from "../components/BrandSignupForm";
import Footer from "../components/Footer";
import TopInfluencersSection from "../components/TopInfluencersSection";
import NewlyApprovedInfluencersSection from "../components/NewlyApprovedInfluencersSection";
import { supabase } from "@/lib/supabaseClient";
import { getStoredLanguage, setStoredLanguage, type Language } from "@/lib/language";
import { getCachedImageUrl } from "@/lib/imageProxy";
import FastImage from "@/components/FastImage";

type Lang = "el" | "en";

const HERO_INFLUENCER_IMAGE = "/hero-influencer-left.png";
const HERO_BRAND_COLLAB_IMAGE = "/hero-brand-collab-right.png";

const t = {
  el: {
    nav_join: "Εγγραφή Influencer",
    nav_brand: "Εγγραφή Επιχείρησης",
    nav_directory: "Κατάλογος",
    nav_campaigns: "Καμπάνιες",
    nav_features: "Δυνατότητες",
    nav_admin: "Admin",
    hero_badge: "ΝΕΑ ΠΛΑΤΦΟΡΜΑ",
    hero_title_1: "Σύνδεσε το ταλέντο σου",
    hero_title_2: "με κορυφαία Brands",
    hero_desc: "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Δημιούργησε το επαγγελματικό σου προφίλ και κλείσε συνεργασίες σήμερα.",
    hero_btn_primary: "Ξεκίνα Δωρεάν",
    hero_btn_brand: "Εγγραφή Επιχείρησης",
    hero_btn_secondary: "Εξερεύνηση",
    hero_brand_title_1: "Σύνδεσε το Brand σου",
    hero_brand_title_2: "με κορυφαίους Influencers",
    hero_brand_desc: "Έχετε επιχείρηση; Ανακαλύψτε influencers που ταιριάζουν στο κοινό σας, προβάλετε τα προϊόντα ή τις υπηρεσίες σας και ξεκινήστε συνεργασίες μέσα από το Influo. Η εγγραφή είναι δωρεάν.",
    signup_choice_influencer: "Είμαι Influencer",
    signup_choice_brand: "Έχω Επιχείρηση",
    brand_section_title: "Έχετε Επιχείρηση;",
    brand_section_desc: "Βρείτε τους κατάλληλους influencers για το brand σας. Αναζητήστε, επικοινωνήστε και συνεργαστείτε με verified creators — με AI προτάσεις χωρίς επιπλέον κόστος.",
    brand_section_btn: "Δημιούργησε Λογαριασμό Επιχείρησης",
    brand_feat_search_title: "Αναζήτηση",
    brand_feat_search_desc: "Βρείτε influencers ανά κατηγορία, engagement rate και budget.",
    brand_feat_campaigns_title: "Καμπάνιες",
    brand_feat_campaigns_desc: "Δημοσιεύστε καμπάνιες με budget — οι creators κάνουν αίτηση ενδιαφέροντος.",
    brand_feat_manage_title: "Διαχείριση",
    brand_feat_manage_desc: "Διαχειριστείτε όλες τις συνεργασίες σας από ένα μέρος.",
    brand_feat_verified_title: "Verified",
    brand_feat_verified_desc: "Όλοι οι influencers είναι verified με πραγματικά στοιχεία.",
    brand_feat_ai_title: "AI Προτάσεις",
    brand_feat_ai_desc: "Αυτόματες προτάσεις influencers για το brand σας, με match scores.",
    brand_feat_ai_badge: "Περιλαμβάνεται",
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
    feat_4_title: "Καμπάνιες",
    feat_4_desc: "Τα brands δημοσιεύουν καμπάνιες με budget — οι creators κάνουν αίτηση ενδιαφέροντος.",
    footer_rights: "Με επιφύλαξη παντός δικαιώματος.",
    footer_privacy: "Απόρρητο",
    footer_terms: "Όροι Χρήσης",
    footer_contact: "Επικοινωνία"
  },
  en: {
    nav_join: "Become an Influencer",
    nav_brand: "For Brands",
    nav_directory: "Directory",
    nav_campaigns: "Campaigns",
    nav_features: "Features",
    nav_admin: "Admin",
    hero_badge: "NEW PLATFORM",
    hero_title_1: "Connect your talent",
    hero_title_2: "with top Brands",
    hero_desc: "The most modern Influencer Marketing platform in Greece. Create your professional profile and get hired today.",
    hero_btn_primary: "Start for Free",
    hero_btn_brand: "For Brands",
    hero_btn_secondary: "Explore",
    hero_brand_title_1: "Connect your Brand",
    hero_brand_title_2: "with Top Influencers",
    hero_brand_desc: "Own a business? Find influencers that match your audience, promote your products or services and start successful collaborations through Influo. Registration is free.",
    signup_choice_influencer: "I am an Influencer",
    signup_choice_brand: "I have a Company",
    brand_section_title: "Are you a Company?",
    brand_section_desc: "Find the right influencers for your brand. Search, connect and collaborate with verified creators — with AI recommendations included at no extra cost.",
    brand_section_btn: "Create Company Account",
    brand_feat_search_title: "Search",
    brand_feat_search_desc: "Find influencers by category, engagement rate and budget.",
    brand_feat_campaigns_title: "Campaigns",
    brand_feat_campaigns_desc: "Publish campaigns with a budget — creators apply if interested.",
    brand_feat_manage_title: "Management",
    brand_feat_manage_desc: "Manage all your collaborations from one place.",
    brand_feat_verified_title: "Verified",
    brand_feat_verified_desc: "All influencers are verified with real stats.",
    brand_feat_ai_title: "AI Recommendations",
    brand_feat_ai_desc: "Automatic influencer suggestions for your brand, with match scores.",
    brand_feat_ai_badge: "Included",
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
    feat_4_title: "Campaigns",
    feat_4_desc: "Brands publish campaigns with budget — creators apply if interested.",
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
  const pathname = usePathname();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [signupType, setSignupType] = useState<"influencer" | "brand">("influencer");
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [verifiedBrands, setVerifiedBrands] = useState<VerifiedBrand[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userType, setUserType] = useState<'influencer' | 'brand' | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const txt = t[lang];

  // Load language from pathname (/en) or localStorage on client-side
  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
    
    // Listen for language changes from Header component
    const handleLanguageChange = (event: CustomEvent) => {
      setLang(event.detail);
    };
    
    window.addEventListener('languageChanged', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
    };
  }, [pathname]);

  // Ανοίγει το modal εγγραφής από URL π.χ. Google Ads: ?signup=brand | ?signup=influencer
  useEffect(() => {
    if (typeof window === "undefined") return;
    const signup = new URLSearchParams(window.location.search).get("signup");
    if (signup === "brand" || signup === "influencer") {
      setSignupType(signup);
      setShowModal(true);
    }
  }, []);

  // Check if user is logged in and get user type
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Get session to check if user is logged in and get access token
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && session?.access_token) {
          setIsLoggedIn(true);
          
          // Fetch profile data from API route (avoids hanging queries)
          const response = await fetch('/api/user/profile', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            
            if (result.profile) {
              setUserType(result.profile.type);
              if (result.profile.type === 'influencer') {
                setUserAvatar(result.profile.avatar_url);
                setUserName(result.profile.display_name);
              } else if (result.profile.type === 'brand') {
                setUserAvatar(result.profile.logo_url);
                setUserName(result.profile.brand_name);
              }
            } else {
              // User exists but no profile found
              setUserType(null);
              setUserAvatar(null);
              setUserName(null);
            }
          } else {
            // API error - fallback to initials
            setUserType(null);
            setUserAvatar(null);
            setUserName(null);
          }
        } else {
          setIsLoggedIn(false);
          setUserType(null);
          setUserAvatar(null);
          setUserName(null);
        }
      } catch (err) {
        console.error('[Homepage] Error checking session:', err);
        setIsLoggedIn(false);
        setUserType(null);
        setUserAvatar(null);
        setUserName(null);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user && session?.access_token) {
        setIsLoggedIn(true);
        
        // Fetch profile data from API route (avoids hanging queries)
        try {
          const response = await fetch('/api/user/profile', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            
            if (result.profile) {
              setUserType(result.profile.type);
              if (result.profile.type === 'influencer') {
                setUserAvatar(result.profile.avatar_url);
                setUserName(result.profile.display_name);
              } else if (result.profile.type === 'brand') {
                setUserAvatar(result.profile.logo_url);
                setUserName(result.profile.brand_name);
              }
            } else {
              setUserType(null);
              setUserAvatar(null);
              setUserName(null);
            }
          } else {
            setUserType(null);
            setUserAvatar(null);
            setUserName(null);
          }
        } catch (err) {
          console.error('[Homepage] Error fetching profile on auth change:', err);
          setUserType(null);
          setUserAvatar(null);
          setUserName(null);
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
            "name": lang === "en" ? "Influo - Influencer Marketing Platform" : "Influo.gr - Πλατφόρμα Influencer Marketing",
            "description": lang === "en" ? "The most modern Influencer Marketing platform in Greece. Connect your talent with top Brands. Create your professional profile and get hired today." : "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Σύνδεσε το ταλέντο σου με κορυφαίες Επιχειρήσεις.",
            "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr"}${pathname?.startsWith("/en") ? "/en" : ""}`,
            "inLanguage": lang === "en" ? "en" : "el",
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
            <a href={lang === "en" ? "/en" : "/"} className="flex items-center gap-2" aria-label="Influo Home">
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
                    <li><button onClick={() => { setSignupType("influencer"); setShowModal(true); }} className="hover:text-slate-900 transition-colors">
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
                {isLoggedIn && (
                  <li>
                    <a href={lang === "en" ? "/en/campaigns" : "/campaigns"} className="hover:text-slate-900 transition-colors">
                      {txt.nav_campaigns}
                    </a>
                  </li>
                )}
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
                onClick={() => {
                  const newLang = lang === "el" ? "en" : "el";
                  setLang(newLang);
                  setStoredLanguage(newLang);
                  if (newLang === "en") router.push("/en");
                  else router.push("/");
                }}
                className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
                aria-label="Toggle language"
              >
                {lang === "el" ? "EN" : "EL"}
              </button>
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-3 md:hidden">
            <div className="flex items-center gap-2">
              {isLoggedIn && (
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
              )}
              <button 
                onClick={() => {
                  const newLang = lang === "el" ? "en" : "el";
                  setLang(newLang);
                  setStoredLanguage(newLang);
                  if (newLang === "en") router.push("/en");
                  else router.push("/");
                }}
                className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
                aria-label="Toggle language"
              >
                {lang === "el" ? "EN" : "EL"}
              </button>
            </div>
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
                  setSignupType("influencer");
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
              {isLoggedIn && (
                <a
                  href={lang === "en" ? "/en/campaigns" : "/campaigns"}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
                >
                  {txt.nav_campaigns}
                </a>
              )}
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
                  src={HERO_INFLUENCER_IMAGE}
                  alt="Trendy influencer creating content for social media"
                  fill
                  className="object-cover object-center"
                  priority
                  sizes="(max-width: 1024px) 100vw, 33vw"
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
                
                <div className="flex flex-col sm:flex-row flex-wrap justify-center lg:justify-start gap-4">
                  <button 
                    onClick={() => { setSignupType("influencer"); setShowModal(true); }} 
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
                <h1 className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-slate-900 mb-6 leading-[1.1] tracking-tight mt-10">
                  <span className="block">{txt.hero_brand_title_1}</span>
                  <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {txt.hero_brand_title_2}
                  </span>
                </h1>
                <p className="text-lg md:text-xl lg:text-2xl text-slate-600 mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                  {txt.hero_brand_desc}
                </p>
              </div>
              
              {/* Right Image */}
              <div className="hidden lg:block relative h-[500px] rounded-2xl overflow-hidden shadow-2xl">
                <Image 
                  src={HERO_BRAND_COLLAB_IMAGE}
                  alt="Big brand starting a collaboration with a trendy influencer"
                  fill
                  className="object-cover object-center"
                  priority
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
            </div>
            
            {/* Mobile Images - Stack below */}
            <div className="lg:hidden grid grid-cols-2 gap-4 mt-12">
              <div className="relative h-[300px] rounded-2xl overflow-hidden shadow-xl">
                <Image 
                  src={HERO_INFLUENCER_IMAGE}
                  alt="Trendy influencer creating content for social media"
                  fill
                  className="object-cover object-center"
                  sizes="50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
              <div className="relative h-[300px] rounded-2xl overflow-hidden shadow-xl">
                <Image 
                  src={HERO_BRAND_COLLAB_IMAGE}
                  alt="Big brand starting a collaboration with a trendy influencer"
                  fill
                  className="object-cover object-center"
                  sizes="50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
            </div>
          </div>
        </section>

      {/* Top Influencers of the Month */}
        <TopInfluencersSection lang={lang} />

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

      {/* Newly Approved Influencers */}
      <NewlyApprovedInfluencersSection lang={lang} />

      {/* Brand Section */}
        <section className="relative py-20 px-6 bg-slate-50 border-y border-slate-100" id="brands">
          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">{txt.brand_section_title}</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">{txt.brand_section_desc}</p>
              <button
                type="button"
                onClick={() => {
                  setSignupType("brand");
                  setShowModal(true);
                }}
                className="inline-block px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors text-base"
              >
                {txt.brand_section_btn}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
              {([
                {
                  key: "search",
                  title: txt.brand_feat_search_title,
                  desc: txt.brand_feat_search_desc,
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
                    </svg>
                  ),
                },
                {
                  key: "campaigns",
                  title: txt.brand_feat_campaigns_title,
                  desc: txt.brand_feat_campaigns_desc,
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.993 3.993 0 01-1.564-.317z" />
                    </svg>
                  ),
                },
                {
                  key: "manage",
                  title: txt.brand_feat_manage_title,
                  desc: txt.brand_feat_manage_desc,
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  ),
                },
                {
                  key: "verified",
                  title: txt.brand_feat_verified_title,
                  desc: txt.brand_feat_verified_desc,
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  ),
                },
                {
                  key: "ai",
                  title: txt.brand_feat_ai_title,
                  desc: txt.brand_feat_ai_desc,
                  badge: txt.brand_feat_ai_badge,
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ),
                },
              ] as const).map((feat) => (
                <article
                  key={feat.key}
                  className="group flex flex-col h-full bg-white border border-slate-200/90 p-5 md:p-6 rounded-lg hover:border-slate-300 hover:bg-white transition-colors duration-200"
                >
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                      {feat.icon}
                    </div>
                    {"badge" in feat && feat.badge ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 border border-slate-200 px-2 py-0.5 rounded">
                        {feat.badge}
                      </span>
                    ) : null}
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 mb-2 tracking-tight">{feat.title}</h4>
                  <p className="text-slate-600 text-sm leading-relaxed flex-1">{feat.desc}</p>
                </article>
              ))}
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
                      <FastImage
                        src={getCachedImageUrl(brand.logo_url) ?? brand.logo_url}
                        alt={brand.brand_name}
                        width={260}
                        height={80}
                        className="h-full w-auto max-w-[180px] md:max-w-[220px] lg:max-w-[260px] object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                        quality={75}
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector(".text-fallback")) {
                            const textFallback = document.createElement("div");
                            textFallback.className =
                              "text-fallback font-semibold text-sm md:text-base lg:text-lg text-slate-400 whitespace-nowrap";
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
                { name: 'KORRES', domain: 'korres.com', url: 'https://www.korres.com' },
                { name: 'Skroutz', domain: 'skroutz.gr', url: 'https://www.skroutz.gr' },
                { name: 'Samsung', domain: 'samsung.com', url: 'https://www.samsung.com' },
                { name: "L'Oréal", domain: 'loreal.com', url: 'https://www.loreal.com' },
                { name: 'Zara', domain: 'zara.com', url: 'https://www.zara.com' },
                { name: 'Microsoft', domain: 'microsoft.com', url: 'https://www.microsoft.com' },
                { name: 'Vodafone', domain: 'vodafone.gr', url: 'https://www.vodafone.gr' },
                { name: 'Adidas', domain: 'adidas.com', url: 'https://www.adidas.com' },
                { name: 'Google', domain: 'google.com', url: 'https://www.google.com' },
                { name: 'Cosmote', domain: 'cosmote.gr', url: 'https://www.cosmote.gr' }
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
                      <FastImage
                        src={getCachedImageUrl(brand.logo_url) ?? brand.logo_url}
                        alt={brand.brand_name}
                        width={260}
                        height={80}
                        className="h-full w-auto max-w-[180px] md:max-w-[220px] lg:max-w-[260px] object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                        quality={75}
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector(".text-fallback")) {
                            const textFallback = document.createElement("div");
                            textFallback.className =
                              "text-fallback font-semibold text-sm md:text-base lg:text-lg text-slate-400 whitespace-nowrap";
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
                { name: 'Cosmote', domain: 'cosmote.gr', url: 'https://www.cosmote.gr' }
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
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.text-fallback')) {
                          const textFallback = document.createElement('div');
                          textFallback.className = 'text-fallback font-semibold text-sm md:text-base lg:text-lg text-slate-400 whitespace-nowrap';
                          textFallback.textContent = brand.name;
                          parent.appendChild(textFallback);
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
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex justify-center items-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setShowModal(false)}
          >
            <div
              className="relative w-full max-w-5xl animate-in zoom-in duration-300"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="mb-6">
              <div className="flex gap-3 bg-white/10 backdrop-blur-sm p-2 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setSignupType("influencer")}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm sm:text-base font-bold transition-all ${
                    signupType === "influencer"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-white/80 border border-white/10 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {txt.signup_choice_influencer}
                </button>
                <button
                  type="button"
                  onClick={() => setSignupType("brand")}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm sm:text-base font-bold transition-all ${
                    signupType === "brand"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-white/80 border border-white/10 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {txt.signup_choice_brand}
                </button>
              </div>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label={lang === "el" ? "Κλείσιμο" : "Close"}
                className="absolute top-3 right-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors border border-red-200 shadow-sm"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              {signupType === "influencer" ? <InfluencerSignupForm /> : <BrandSignupForm embedded />}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
