"use client";

import { useState, useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import Footer from "../../components/Footer";
import { usePathname, useRouter } from "next/navigation";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";
import { supabase } from "@/lib/supabaseClient";

type Lang = "el" | "en";

const t = {
  el: {
    title: "Influo",
    headline: "Το προφίλ σας. Οι συνεργασίες σας.",
    hero_desc:
      "Δημιουργήστε επαγγελματικό προφίλ, δεχτείτε προσφορές από brands και ολοκληρώστε καμπάνιες μέσα από μία πλατφόρμα.",
    cta_primary: "Ξεκινήστε δωρεάν",
    cta_secondary: "Κατάλογος",
    back: "Επιστροφή",
    features_title: "Ό,τι χρειάζεστε ως creator",
    features_desc: "Προφίλ, καμπάνιες, μηνύματα και αξιοπιστία — σε ένα μέρος.",
    feat_1_title: "Rate card",
    feat_1_desc: "Ορίστε τιμές για story, post, reel και άλλα formats στο προφίλ σας.",
    feat_2_title: "Διαθεσιμότητα",
    feat_2_desc: "Δείξτε αν είστε διαθέσιμοι για νέες συνεργασίες — τα brands φιλτράρουν ανάλογα.",
    feat_3_title: "Επαγγελματικό προφίλ",
    feat_3_desc: "Stats, reviews, completion rate και χρόνος απάντησης με πραγματικά δεδομένα.",
    feat_4_title: "Μηνύματα & αρχεία",
    feat_4_desc: "Συνομιλία με brands και αποστολή attachments (briefs, media, συμβόλαια).",
    feat_5_title: "Badges",
    feat_5_desc: "Top Performer, Pro, Elite, VIP — αναγνώριση που χτίζει εμπιστοσύνη.",
    feat_6_title: "Deliverables",
    feat_6_desc: "Υποβάλετε URL παράδοσης· το brand εγκρίνει ή ζητά αλλαγές στη ροή της καμπάνιας.",
    campaign_title: "Αιτήσεις σε καμπάνιες",
    campaign_desc:
      "Verified brands δημοσιεύουν καμπάνιες με budget και brief. Από το dashboard κάνετε αίτηση ενδιαφέροντος — παράλληλα με τις κλασικές προσφορές.",
    campaign_cta: "Άνοιγμα καμπανιών",
    campaign_cta_guest: "Εγγραφή για αιτήσεις",
    how_title: "Πώς λειτουργεί",
    how_desc: "Από την εγγραφή στην παράδοση σε τρία βήματα.",
    step_1_title: "Δημιουργήστε προφίλ",
    step_1_desc: "Εγγραφή, portfolio, rate card και διαθεσιμότητα.",
    step_2_title: "Προσφορές & αιτήσεις",
    step_2_desc: "Λάβετε προσφορές ή κάντε αίτηση σε ανοιχτές καμπάνιες.",
    step_3_title: "Παράδοση & ολοκλήρωση",
    step_3_desc: "Υποβάλετε deliverable, λάβετε έγκριση και κλείστε τη συνεργασία.",
    testimonials_title: "Τι λένε οι creators",
    testimonial_1_name: "Μαρία Κ.",
    testimonial_1_role: "Beauty Influencer",
    testimonial_1_text:
      "Βρήκα σταθερές συνεργασίες γρήγορα. Το προφίλ και τα badges βοηθούν τα brands να με εμπιστευτούν.",
    testimonial_2_name: "Γιάννης Τ.",
    testimonial_2_role: "Tech Creator",
    testimonial_2_text:
      "Καθαρή διαδικασία: προσφορές, μηνύματα και παραδόσεις χωρίς να φεύγω από την πλατφόρμα.",
    testimonial_3_name: "Ελένη Μ.",
    testimonial_3_role: "Fashion Influencer",
    testimonial_3_text:
      "Το rate card και η διαθεσιμότητα κάνουν τη διαπραγμάτευση πιο ξεκάθαρη και από τις δύο πλευρές.",
    cta_section_title: "Ξεκινήστε σήμερα",
    cta_section_desc: "Το προφίλ σας είναι έτοιμο σε λίγα λεπτά.",
    cta_button: "Εγγραφή",
  },
  en: {
    title: "Influo",
    headline: "Your profile. Your collaborations.",
    hero_desc:
      "Build a professional profile, receive brand offers, and complete campaigns in one place.",
    cta_primary: "Start for free",
    cta_secondary: "Directory",
    back: "Back",
    features_title: "Built for creators",
    features_desc: "Profile, campaigns, messaging, and trust signals — together.",
    feat_1_title: "Rate card",
    feat_1_desc: "Set prices for stories, posts, reels, and more on your profile.",
    feat_2_title: "Availability",
    feat_2_desc: "Show whether you are open for new work — brands can filter by status.",
    feat_3_title: "Professional profile",
    feat_3_desc: "Stats, reviews, completion rate, and response time from real activity.",
    feat_4_title: "Messages & files",
    feat_4_desc: "Chat with brands and send attachments (briefs, media, contracts).",
    feat_5_title: "Badges",
    feat_5_desc: "Top Performer, Pro, Elite, VIP — recognition that builds trust.",
    feat_6_title: "Deliverables",
    feat_6_desc: "Submit a delivery URL; the brand approves or requests changes in-campaign.",
    campaign_title: "Apply to campaigns",
    campaign_desc:
      "Verified brands post campaigns with budget and brief. Apply from your dashboard — alongside classic proposals.",
    campaign_cta: "Open campaigns",
    campaign_cta_guest: "Sign up to apply",
    how_title: "How it works",
    how_desc: "From signup to delivery in three steps.",
    step_1_title: "Create your profile",
    step_1_desc: "Sign up, add portfolio, rate card, and availability.",
    step_2_title: "Offers & applications",
    step_2_desc: "Receive offers or apply to open campaigns.",
    step_3_title: "Deliver & close",
    step_3_desc: "Submit deliverables, get approval, and finish the collaboration.",
    testimonials_title: "What creators say",
    testimonial_1_name: "Maria K.",
    testimonial_1_role: "Beauty Influencer",
    testimonial_1_text:
      "I found steady collaborations quickly. Profile and badges help brands trust me.",
    testimonial_2_name: "John T.",
    testimonial_2_role: "Tech Creator",
    testimonial_2_text:
      "Clean process: offers, messages, and deliveries without leaving the platform.",
    testimonial_3_name: "Eleni M.",
    testimonial_3_role: "Fashion Influencer",
    testimonial_3_text:
      "Rate card and availability make negotiation clearer for both sides.",
    cta_section_title: "Start today",
    cta_section_desc: "Your profile can be ready in a few minutes.",
    cta_button: "Sign up",
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
  rate: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  availability: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  profile: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  message: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  badge: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
};

export default function ForInfluencersPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  const txt = t[lang];
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

  const signupHref = lang === "en" ? "/en?signup=influencer" : "/?signup=influencer";
  const directoryHref = lang === "en" ? "/en/directory" : "/directory";
  const homeHref = lang === "en" ? "/en" : "/";

  const features = [
    { title: txt.feat_1_title, desc: txt.feat_1_desc, icon: icons.rate },
    { title: txt.feat_2_title, desc: txt.feat_2_desc, icon: icons.availability },
    { title: txt.feat_3_title, desc: txt.feat_3_desc, icon: icons.profile },
    { title: txt.feat_4_title, desc: txt.feat_4_desc, icon: icons.message },
    { title: txt.feat_5_title, desc: txt.feat_5_desc, icon: icons.badge },
    { title: txt.feat_6_title, desc: txt.feat_6_desc, icon: icons.deliverable },
  ];

  const steps = [
    { n: "1", title: txt.step_1_title, desc: txt.step_1_desc },
    { n: "2", title: txt.step_2_title, desc: txt.step_2_desc },
    { n: "3", title: txt.step_3_title, desc: txt.step_3_desc },
  ];

  const testimonials = [
    {
      name: txt.testimonial_1_name,
      role: txt.testimonial_1_role,
      text: txt.testimonial_1_text,
      img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
    },
    {
      name: txt.testimonial_2_name,
      role: txt.testimonial_2_role,
      text: txt.testimonial_2_text,
      img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
    },
    {
      name: txt.testimonial_3_name,
      role: txt.testimonial_3_role,
      text: txt.testimonial_3_text,
      img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
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
                router.push(newLang === "en" ? "/en/for-influencers" : "/for-influencers");
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
            src="https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=1600&q=80"
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
            <Link
              href={signupHref}
              className="inline-flex justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-center"
            >
              {txt.cta_primary}
            </Link>
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
            <div className="mb-4">
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
              <Link
                href={signupHref}
                className="inline-flex px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
              >
                {txt.campaign_cta_guest}
              </Link>
            )}
          </div>
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-200">
            <Image
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80"
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

      {/* How it works */}
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-2">{txt.how_title}</h2>
            <p className="text-slate-600">{txt.how_desc}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {steps.map((s) => (
              <div key={s.n} className="text-center md:text-left">
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
      <section className="py-16 md:py-20 px-4 sm:px-6 bg-white">
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
          <Link
            href={signupHref}
            className="inline-flex px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            {txt.cta_button}
          </Link>
        </div>
      </section>

      <Footer lang={lang} />
    </div>
  );
}
