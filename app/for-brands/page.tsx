"use client";

import { useState, useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import Footer from "../../components/Footer";
import { usePathname, useRouter } from "next/navigation";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";
import InfluencerSignupForm from "../../components/InfluencerSignupForm";
import BrandSignupForm from "../../components/BrandSignupForm";
import { supabase } from "@/lib/supabaseClient";

type Lang = "el" | "en";

const t = {
  el: {
    title: "Influo",
    headline: "Βρείτε τους σωστούς influencers για το brand σας.",
    hero_desc:
      "Αναζήτηση, AI προτάσεις, καμπάνιες με αιτήσεις και έγκριση deliverables — όλα σε μία πλατφόρμα.",
    cta_primary: "Εγγραφή ως Brand",
    cta_secondary: "Κατάλογος",
    back: "Επιστροφή",
    features_title: "Ό,τι χρειάζεται το brand σας",
    features_desc: "Από την εύρεση μέχρι την παράδοση, χωρίς να αλλάζετε εργαλεία.",
    feat_1_title: "Αναζήτηση & φίλτρα",
    feat_1_desc: "Κατηγορία, engagement, budget και διαθεσιμότητα — βρείτε creators που ταιριάζουν.",
    feat_2_title: "Verified & trust",
    feat_2_desc: "Πραγματικά stats, reviews, χρόνος απάντησης και completion rate στα προφίλ.",
    feat_3_title: "Διαχείριση συνεργασιών",
    feat_3_desc: "Προσφορές, συνομιλίες και καμπάνιες από ένα dashboard.",
    feat_4_title: "Μηνύματα & αρχεία",
    feat_4_desc: "Άμεση συνομιλία με creators και αποστολή attachments.",
    feat_5_title: "Rate cards",
    feat_5_desc: "Δείτε τιμές ανά format πριν στείλετε πρόταση.",
    feat_6_title: "Deliverables",
    feat_6_desc: "Οι creators υποβάλλουν URL· εσείς εγκρίνετε ή ζητάτε αλλαγές.",
    campaign_title: "Καμπάνιες με αιτήσεις",
    campaign_desc:
      "Ανεβάστε τίτλο, περιγραφή και budget. Οι verified influencers κάνουν αίτηση ενδιαφέροντος· εσείς διαχειρίζεστε τις αιτήσεις.",
    campaign_cta: "Δημιουργία καμπάνιας",
    campaign_cta_guest: "Εγγραφή για καμπάνιες",
    ai_badge: "Περιλαμβάνεται",
    ai_title: "AI προτάσεις",
    ai_desc:
      "Το σύστημα προτείνει influencers με match scores βάσει κατηγορίας, engagement και προφίλ brand — χωρίς επιπλέον κόστος.",
    ai_cta: "Ξεκινήστε",
    how_title: "Πώς λειτουργεί",
    how_desc: "Από την εγγραφή στην παράδοση σε τέσσερα βήματα.",
    step_1_title: "Εγγραφή brand",
    step_1_desc: "Λογαριασμός εταιρείας και πρόσβαση στον κατάλογο.",
    step_2_title: "Αναζήτηση ή AI",
    step_2_desc: "Φίλτρα καταλόγου ή αυτόματες προτάσεις με match score.",
    step_3_title: "Πρόταση ή καμπάνια",
    step_3_desc: "Στείλτε προσφορά ή δημοσιεύστε καμπάνια για αιτήσεις.",
    step_4_title: "Έγκριση & κλείσιμο",
    step_4_desc: "Μηνύματα, deliverables και ολοκλήρωση συνεργασίας.",
    testimonials_title: "Τι λένε τα brands",
    testimonial_1_name: "Σοφία Α.",
    testimonial_1_role: "Marketing Manager",
    testimonial_1_text:
      "Βρήκαμε creators που ταιριάζουν στο κοινό μας μέσα σε λίγες μέρες. Η διαδικασία είναι καθαρή.",
    testimonial_2_name: "Δημήτρης Κ.",
    testimonial_2_role: "Brand Manager",
    testimonial_2_text:
      "Reviews, response time και badges μας βοηθούν να επιλέξουμε με περισσότερη σιγουριά.",
    testimonial_3_name: "Μαρία Λ.",
    testimonial_3_role: "Digital Marketing Director",
    testimonial_3_text:
      "Καμπάνιες, αιτήσεις και παραδόσεις από ένα σημείο — λιγότερο χάος στο team.",
    cta_section_title: "Ξεκινήστε σήμερα",
    cta_section_desc: "Δημιουργήστε λογαριασμό brand και ανοίξτε τον κατάλογο.",
    cta_button: "Εγγραφή ως Brand",
    signup_influencer: "Είμαι Influencer",
    signup_brand: "Έχω Επιχείρηση",
    close: "Κλείσιμο",
  },
  en: {
    title: "Influo",
    headline: "Find the right influencers for your brand.",
    hero_desc:
      "Search, AI recommendations, campaign applications, and deliverable approval — in one platform.",
    cta_primary: "Sign up as Brand",
    cta_secondary: "Directory",
    back: "Back",
    features_title: "Everything your brand needs",
    features_desc: "From discovery to delivery without switching tools.",
    feat_1_title: "Search & filters",
    feat_1_desc: "Category, engagement, budget, and availability — find matching creators.",
    feat_2_title: "Verified & trust",
    feat_2_desc: "Real stats, reviews, response time, and completion rate on profiles.",
    feat_3_title: "Collaboration hub",
    feat_3_desc: "Offers, conversations, and campaigns from one dashboard.",
    feat_4_title: "Messages & files",
    feat_4_desc: "Chat with creators and send attachments.",
    feat_5_title: "Rate cards",
    feat_5_desc: "See pricing by format before you send a proposal.",
    feat_6_title: "Deliverables",
    feat_6_desc: "Creators submit a URL; you approve or request changes.",
    campaign_title: "Campaigns with applications",
    campaign_desc:
      "Publish title, description, and budget. Verified influencers apply; you manage applications.",
    campaign_cta: "Create a campaign",
    campaign_cta_guest: "Sign up for campaigns",
    ai_badge: "Included",
    ai_title: "AI recommendations",
    ai_desc:
      "Get influencer suggestions with match scores based on category, engagement, and your brand profile — at no extra cost.",
    ai_cta: "Get started",
    how_title: "How it works",
    how_desc: "From signup to delivery in four steps.",
    step_1_title: "Brand signup",
    step_1_desc: "Company account and directory access.",
    step_2_title: "Search or AI",
    step_2_desc: "Directory filters or automatic suggestions with match scores.",
    step_3_title: "Proposal or campaign",
    step_3_desc: "Send an offer or publish a campaign for applications.",
    step_4_title: "Approve & close",
    step_4_desc: "Messages, deliverables, and completed collaboration.",
    testimonials_title: "What brands say",
    testimonial_1_name: "Sofia A.",
    testimonial_1_role: "Marketing Manager",
    testimonial_1_text:
      "We found creators who fit our audience within days. The process is clear.",
    testimonial_2_name: "Dimitris K.",
    testimonial_2_role: "Brand Manager",
    testimonial_2_text:
      "Reviews, response time, and badges help us choose with more confidence.",
    testimonial_3_name: "Maria L.",
    testimonial_3_role: "Digital Marketing Director",
    testimonial_3_text:
      "Campaigns, applications, and deliveries in one place — less chaos for the team.",
    cta_section_title: "Start today",
    cta_section_desc: "Create a brand account and open the directory.",
    cta_button: "Sign up as Brand",
    signup_influencer: "I'm an Influencer",
    signup_brand: "I have a Business",
    close: "Close",
  },
};

function IconBox({ children }: { children: ReactNode }) {
  return (
    <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
      {children}
    </div>
  );
}

const icons = {
  search: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
    </svg>
  ),
  verified: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  manage: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  message: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  rate: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  deliverable: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  campaign: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.993 3.993 0 01-1.564-.317z" />
    </svg>
  ),
  ai: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
};

export default function ForBrandsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  const txt = t[lang];
  const [showModal, setShowModal] = useState(false);
  const [signupType, setSignupType] = useState<"influencer" | "brand">("brand");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) setIsLoggedIn(!!session);
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const openBrandModal = () => {
    setSignupType("brand");
    setShowModal(true);
  };

  const directoryHref = lang === "en" ? "/en/directory" : "/directory";
  const homeHref = lang === "en" ? "/en" : "/";

  const features = [
    { title: txt.feat_1_title, desc: txt.feat_1_desc, icon: icons.search },
    { title: txt.feat_2_title, desc: txt.feat_2_desc, icon: icons.verified },
    { title: txt.feat_3_title, desc: txt.feat_3_desc, icon: icons.manage },
    { title: txt.feat_4_title, desc: txt.feat_4_desc, icon: icons.message },
    { title: txt.feat_5_title, desc: txt.feat_5_desc, icon: icons.rate },
    { title: txt.feat_6_title, desc: txt.feat_6_desc, icon: icons.deliverable },
  ];

  const steps = [
    { n: "1", title: txt.step_1_title, desc: txt.step_1_desc },
    { n: "2", title: txt.step_2_title, desc: txt.step_2_desc },
    { n: "3", title: txt.step_3_title, desc: txt.step_3_desc },
    { n: "4", title: txt.step_4_title, desc: txt.step_4_desc },
  ];

  const testimonials = [
    {
      name: txt.testimonial_1_name,
      role: txt.testimonial_1_role,
      text: txt.testimonial_1_text,
      img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80",
    },
    {
      name: txt.testimonial_2_name,
      role: txt.testimonial_2_role,
      text: txt.testimonial_2_text,
      img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
    },
    {
      name: txt.testimonial_3_name,
      role: txt.testimonial_3_role,
      text: txt.testimonial_3_text,
      img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto flex justify-between items-center px-4 sm:px-6 py-4">
          <Link href={homeHref} className="flex items-center">
            <Image src="/logo.svg" alt="Influo" width={160} height={64} className="h-9 w-auto" priority />
          </Link>
          <div className="flex items-center gap-4">
            <Link href={homeHref} className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              {txt.back}
            </Link>
            <button
              type="button"
              onClick={() => {
                const newLang = lang === "el" ? "en" : "el";
                setLang(newLang);
                setStoredLanguage(newLang);
                router.push(newLang === "en" ? "/en/for-brands" : "/for-brands");
              }}
              className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
            >
              {lang === "el" ? "EN" : "EL"}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative border-b border-slate-100">
        <div className="absolute inset-0 bg-slate-950">
          <Image
            src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=80"
            alt=""
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <p className="text-sm font-semibold tracking-wide text-blue-300 mb-3">{txt.title}</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight max-w-2xl mb-4">
            {txt.headline}
          </h1>
          <p className="text-lg text-slate-200 max-w-xl mb-8 leading-relaxed">{txt.hero_desc}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={openBrandModal}
              className="inline-flex justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              {txt.cta_primary}
            </button>
            <Link
              href={directoryHref}
              className="inline-flex justify-center px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-lg border border-white/20 transition-colors text-center"
            >
              {txt.cta_secondary}
            </Link>
          </div>
        </div>
      </section>

      {/* Campaigns */}
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-slate-50 border-b border-slate-100">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="mb-4 group">
              <IconBox>{icons.campaign}</IconBox>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-3">
              {txt.campaign_title}
            </h2>
            <p className="text-slate-600 leading-relaxed mb-6 max-w-lg">{txt.campaign_desc}</p>
            {isLoggedIn ? (
              <Link
                href="/dashboard?tab=campaigns"
                className="inline-flex px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
              >
                {txt.campaign_cta}
              </Link>
            ) : (
              <button
                type="button"
                onClick={openBrandModal}
                className="inline-flex px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
              >
                {txt.campaign_cta_guest}
              </button>
            )}
          </div>
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-200">
            <Image
              src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80"
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-2">
              {txt.features_title}
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">{txt.features_desc}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {features.map((f) => (
              <article
                key={f.title}
                className="group flex flex-col h-full bg-white border border-slate-200/90 p-5 md:p-6 rounded-lg hover:border-slate-300 transition-colors"
              >
                <div className="mb-4">
                  <IconBox>{f.icon}</IconBox>
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2 tracking-tight">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed flex-1">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* AI */}
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto">
          <article className="group border border-slate-200 bg-white rounded-lg p-6 md:p-10 max-w-3xl mx-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <IconBox>{icons.ai}</IconBox>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 border border-slate-200 px-2 py-0.5 rounded">
                {txt.ai_badge}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-3">{txt.ai_title}</h2>
            <p className="text-slate-600 leading-relaxed mb-6">{txt.ai_desc}</p>
            <button
              type="button"
              onClick={openBrandModal}
              className="inline-flex px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              {txt.ai_cta}
            </button>
          </article>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-2">{txt.how_title}</h2>
            <p className="text-slate-600">{txt.how_desc}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {steps.map((s) => (
              <div key={s.n}>
                <div className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-semibold mb-4">
                  {s.n}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight text-center mb-12">
            {txt.testimonials_title}
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((item) => (
              <blockquote key={item.name} className="border border-slate-200 rounded-lg p-6 bg-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-100 shrink-0">
                    <Image src={item.img} alt="" fill className="object-cover" sizes="48px" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.role}</div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">&ldquo;{item.text}&rdquo;</p>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-slate-900 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">{txt.cta_section_title}</h2>
          <p className="text-slate-300 mb-8">{txt.cta_section_desc}</p>
          <button
            type="button"
            onClick={openBrandModal}
            className="inline-flex px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            {txt.cta_button}
          </button>
        </div>
      </section>

      <Footer lang={lang} />

      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex justify-center items-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex gap-2 bg-slate-800 p-1.5 rounded-lg">
              <button
                type="button"
                onClick={() => setSignupType("influencer")}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  signupType === "influencer"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:text-white hover:bg-slate-700"
                }`}
              >
                {txt.signup_influencer}
              </button>
              <button
                type="button"
                onClick={() => setSignupType("brand")}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  signupType === "brand"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:text-white hover:bg-slate-700"
                }`}
              >
                {txt.signup_brand}
              </button>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label={txt.close}
                className="absolute top-3 right-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              {signupType === "influencer" ? <InfluencerSignupForm /> : <BrandSignupForm embedded />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
