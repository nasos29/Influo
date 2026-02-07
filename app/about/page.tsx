"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Footer from "@/components/Footer";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";

type Lang = "el" | "en";

const content = {
  el: {
    title: "Σχετικά με εμάς",
    back: "Επιστροφή στην Αρχική",
    intro1:
      "Στο Influo πιστεύουμε ότι το influencer marketing δεν είναι απλώς αριθμοί, likes και followers. Είναι ιστορίες, εμπιστοσύνη και αυθεντική επιρροή.",
    intro2:
      "Δημιουργήσαμε το Influo για να αλλάξουμε τον τρόπο με τον οποίο συνεργάζονται brands και influencers. Όχι με ατελείωτα emails, ασαφείς συμφωνίες και «μαύρο κουτί» αποτελεσμάτων — αλλά με διαφάνεια, δομή και πραγματικό αντίκτυπο.",
    missionTitle: "Η αποστολή μας",
    missionIntro:
      "Η αποστολή μας είναι απλή αλλά φιλόδοξη: 👉 να κάνουμε το influencer marketing πιο έξυπνο, πιο δίκαιο και πιο αποδοτικό για όλους.",
    forBrands: "Για τα brands, αυτό σημαίνει:",
    forBrands1: "πρόσβαση στους σωστούς creators,",
    forBrands2: "με πραγματικό engagement,",
    forBrands3: "ξεκάθαρα metrics και μετρήσιμα αποτελέσματα.",
    forInfluencers: "Για τους influencers, σημαίνει:",
    forInfluencers1: "συνεργασίες που ταιριάζουν στο προφίλ και τις αξίες τους,",
    forInfluencers2: "δίκαιες αμοιβές,",
    forInfluencers3: "και επαγγελματική εξέλιξη μέσα από σοβαρά brands.",
    whatTitle: "Τι είναι το Influo",
    whatBody:
      "Το Influo είναι μια σύγχρονη πλατφόρμα που φέρνει κοντά brands και influencers σε ένα κοινό, δυναμικό περιβάλλον συνεργασίας.",
    whatList:
      "Με έξυπνα φίλτρα, αναλυτικά προφίλ και αυτοματοποιημένες διαδικασίες: τα brands βρίσκουν τους ιδανικούς influencers για κάθε καμπάνια, οι influencers ανακαλύπτουν συνεργασίες που πραγματικά τους ταιριάζουν, και όλα γίνονται γρήγορα, οργανωμένα και χωρίς περιττή γραφειοκρατία.",
    whyTitle: "Γιατί Influo",
    why1Title: "Ποιότητα αντί για ποσότητα",
    why1Body: "Δεν μας ενδιαφέρουν τα «φουσκωμένα» νούμερα. Μας ενδιαφέρει η πραγματική επιρροή.",
    why2Title: "Διαφάνεια σε κάθε βήμα",
    why2Body: "Ξέρεις με ποιον συνεργάζεσαι, γιατί τον διάλεξες και τι αποτελέσματα έφερε.",
    why3Title: "Τεχνολογία με ανθρώπινη λογική",
    why3Body: "Χτίζουμε εργαλεία που δουλεύουν υπέρ σου — όχι που σε μπερδεύουν.",
    why4Title: "Εστίαση στην ελληνική αγορά (και όχι μόνο)",
    why4Body:
      "Γνωρίζουμε την αγορά, τη νοοτροπία και τις ανάγκες της. Και παράλληλα σχεδιάζουμε με διεθνή standards.",
    visionTitle: "Το όραμά μας",
    visionBody:
      "Οραματιζόμαστε έναν κόσμο όπου: οι συνεργασίες brand–influencer βασίζονται στην αυθεντικότητα, τα αποτελέσματα είναι μετρήσιμα και ξεκάθαρα, και η επιρροή δημιουργεί πραγματική αξία — όχι απλώς θόρυβο.",
    visionClose:
      "Το Influo δεν είναι απλώς μια πλατφόρμα. Είναι ένα οικοσύστημα συνεργασίας, ανάπτυξης και δημιουργικότητας.",
    ctaTitle: "Γίνε μέρος του Influo",
    ctaBody:
      "Είτε είσαι brand που θέλει να ξεχωρίσει, είτε influencer που θέλει να συνεργαστεί με τον σωστό τρόπο, 👉 στο Influo είσαι στο σωστό μέρος.",
  },
  en: {
    title: "About Us",
    back: "Back to Home",
    intro1:
      "At Influo we believe that influencer marketing is not just numbers, likes and followers. It's stories, trust and authentic influence.",
    intro2:
      "We created Influo to change the way brands and influencers collaborate. Not with endless emails, vague agreements and «black box» results — but with transparency, structure and real impact.",
    missionTitle: "Our mission",
    missionIntro:
      "Our mission is simple but ambitious: to make influencer marketing smarter, fairer and more effective for everyone. 👉",
    forBrands: "For brands, this means:",
    forBrands1: "access to the right creators,",
    forBrands2: "with real engagement,",
    forBrands3: "clear metrics and measurable results.",
    forInfluencers: "For influencers, it means:",
    forInfluencers1: "collaborations that match their profile and values,",
    forInfluencers2: "fair compensation,",
    forInfluencers3: "and professional growth through serious brands.",
    whatTitle: "What is Influo",
    whatBody:
      "Influo is a modern platform that brings brands and influencers together in a shared, dynamic collaboration environment.",
    whatList:
      "With smart filters, detailed profiles and automated processes: brands find the ideal influencers for every campaign, influencers discover collaborations that truly fit them, and everything happens quickly, in an organised way and without unnecessary bureaucracy.",
    whyTitle: "Why Influo",
    why1Title: "Quality over quantity",
    why1Body: "We don't care about «inflated» numbers. We care about real influence.",
    why2Title: "Transparency at every step",
    why2Body: "You know who you're working with, why you chose them and what results they delivered.",
    why3Title: "Technology with a human touch",
    why3Body: "We build tools that work for you — not tools that confuse you.",
    why4Title: "Focus on the Greek market (and beyond)",
    why4Body:
      "We know the market, the mindset and the needs. And we design with international standards in mind.",
    visionTitle: "Our vision",
    visionBody:
      "We envision a world where: brand–influencer collaborations are built on authenticity, results are measurable and clear, and influence creates real value — not just noise.",
    visionClose:
      "Influo is not just a platform. It's an ecosystem of collaboration, growth and creativity.",
    ctaTitle: "Join Influo",
    ctaBody:
      "Whether you're a brand that wants to stand out or an influencer who wants to collaborate the right way — at Influo you're in the right place. 👉",
  },
};

export default function AboutPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  const t = content[lang];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <Link
            href={lang === "en" ? "/en" : "/"}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-2"
          >
            ← {t.back}
          </Link>
          <div className="flex items-center gap-4">
            <Link href={lang === "en" ? "/en" : "/"} className="flex items-center gap-2" aria-label="Influo Home">
              <Image src="/logo.svg" alt="Influo.gr" width={120} height={48} className="h-8 w-auto" />
            </Link>
            <button
              onClick={() => {
                const newLang = lang === "el" ? "en" : "el";
                setLang(newLang);
                setStoredLanguage(newLang);
                if (newLang === "en") router.push("/en/about");
                else router.push("/about");
              }}
              className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
              aria-label="Toggle language"
            >
              {lang === "el" ? "EN" : "EL"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8">{t.title}</h1>

        <div className="space-y-10 text-slate-700 leading-relaxed">
          <p className="text-lg">{t.intro1}</p>
          <p>{t.intro2}</p>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{t.missionTitle}</h2>
            <p className="mb-4">{t.missionIntro}</p>
            <p className="font-medium text-slate-800 mb-2">{t.forBrands}</p>
            <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
              <li>{t.forBrands1}</li>
              <li>{t.forBrands2}</li>
              <li>{t.forBrands3}</li>
            </ul>
            <p className="font-medium text-slate-800 mb-2">{t.forInfluencers}</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t.forInfluencers1}</li>
              <li>{t.forInfluencers2}</li>
              <li>{t.forInfluencers3}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{t.whatTitle}</h2>
            <p className="mb-4">{t.whatBody}</p>
            <p>{t.whatList}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{t.whyTitle}</h2>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <span className="text-green-600 font-bold shrink-0">✔</span>
                <div>
                  <span className="font-semibold text-slate-800">{t.why1Title}</span>
                  <p className="mt-1">{t.why1Body}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="text-green-600 font-bold shrink-0">✔</span>
                <div>
                  <span className="font-semibold text-slate-800">{t.why2Title}</span>
                  <p className="mt-1">{t.why2Body}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="text-green-600 font-bold shrink-0">✔</span>
                <div>
                  <span className="font-semibold text-slate-800">{t.why3Title}</span>
                  <p className="mt-1">{t.why3Body}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="text-green-600 font-bold shrink-0">✔</span>
                <div>
                  <span className="font-semibold text-slate-800">{t.why4Title}</span>
                  <p className="mt-1">{t.why4Body}</p>
                </div>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{t.visionTitle}</h2>
            <p className="mb-4">{t.visionBody}</p>
            <p className="font-medium text-slate-800">{t.visionClose}</p>
          </section>

          <section className="bg-slate-100/80 border border-slate-200 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-3">{t.ctaTitle}</h2>
            <p>{t.ctaBody}</p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href={lang === "en" ? "/en/for-brands" : "/for-brands"}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
              >
                {lang === "el" ? "Για Brands" : "For Brands"}
              </Link>
              <Link
                href={lang === "en" ? "/en/for-influencers" : "/for-influencers"}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                {lang === "el" ? "Για Influencers" : "For Influencers"}
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  );
}
