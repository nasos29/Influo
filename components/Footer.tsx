"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

interface FooterProps {
  lang?: "el" | "en";
}

export default function Footer({ lang = "el" }: FooterProps) {
  // Anti-scraping email obfuscation - email is constructed client-side from encoded parts
  const [supportEmail, setSupportEmail] = useState<string>("");
  
  useEffect(() => {
    // Construct email on client-side to avoid scraping
    // Split into parts with character codes to make it harder for scrapers
    const a = String.fromCharCode(115, 117, 112, 112, 111, 114, 116); // "support"
    const b = String.fromCharCode(64); // "@"
    const c = String.fromCharCode(105, 110, 102, 108, 117, 111); // "influo"
    const d = String.fromCharCode(46); // "."
    const e = String.fromCharCode(103, 114); // "gr"
    setSupportEmail([a, b, c, d, e].join(""));
  }, []);

  const t = {
    el: {
      company: "Εταιρεία",
      about: "Σχετικά με εμάς",
      blog: "Blog",
      careers: "Καριέρες",
      press: "Press",
      platform: "Πλατφόρμα",
      forInfluencers: "Για Influencers",
      forBrands: "Για Brands",
      pricing: "Τιμές",
      guide: "Οδηγός",
      directory: "Κατάλογος",
      support: "Υποστήριξη",
      help: "Βοήθεια",
      contact: "Επικοινωνία",
      faq: "FAQ",
      legal: "Νομικά",
      privacy: "Απόρρητο",
      terms: "Όροι Χρήσης",
      cookies: "Cookies",
      rights: "Με επιφύλαξη παντός δικαιώματος.",
      follow: "Ακολουθήστε μας",
      newsletter: "Ενημερωθείτε",
      subscribe: "Εγγραφή",
      emailPlaceholder: "Το email σας",
    },
    en: {
      company: "Company",
      about: "About Us",
      blog: "Blog",
      careers: "Careers",
      press: "Press",
      platform: "Platform",
      forInfluencers: "For Influencers",
      forBrands: "For Brands",
      pricing: "Pricing",
      guide: "Guide",
      directory: "Directory",
      support: "Support",
      help: "Help",
      contact: "Contact",
      faq: "FAQ",
      legal: "Legal",
      privacy: "Privacy",
      terms: "Terms",
      cookies: "Cookies",
      rights: "All rights reserved.",
      follow: "Follow Us",
      newsletter: "Stay Updated",
      subscribe: "Subscribe",
      emailPlaceholder: "Your email",
    },
  };

  const txt = t[lang];

  return (
    <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 md:gap-12 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <Image 
                src="/logo.svg" 
                alt="Influo.gr Logo" 
                width={160} 
                height={64} 
                className="h-10 w-auto"
              />
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-xs">
              {lang === "el" 
                ? "Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Σύνδεσε το ταλέντο σου με κορυφαία Brands."
                : "The most modern Influencer Marketing platform in Greece. Connect your talent with top Brands."}
            </p>
            {/* Social Links */}
            <div className="flex gap-4 mb-4">
              <a 
                href="#" 
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a 
                href="#" 
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Facebook"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a 
                href="#" 
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Twitter"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </a>
              <a 
                href="#" 
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="LinkedIn"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
            {/* Support Email */}
            {supportEmail && (
              <a 
                href={`mailto:${supportEmail}`}
                className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-2 mt-6"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{supportEmail}</span>
              </a>
            )}
          </div>

          {/* Company Column */}
          <div>
            <h3 className="text-white font-semibold mb-4">{txt.company}</h3>
            <ul className="space-y-3">
              <li>
                <Link href="#" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {txt.about}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {txt.blog}
                </Link>
              </li>
              <li>
                <Link href="#" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {txt.careers}
                </Link>
              </li>
              <li>
                <Link href="#" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {txt.press}
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform Column */}
          <div>
            <h3 className="text-white font-semibold mb-4">{txt.platform}</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/for-influencers" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {txt.forInfluencers}
                </Link>
              </li>
              <li>
                <Link href="/for-brands" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {txt.forBrands}
                </Link>
              </li>
              <li>
                <Link href="/directory" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {txt.directory}
                </Link>
              </li>
              <li>
                <Link href="/brands" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {lang === "el" ? "Κατάλογος Επιχειρήσεων" : "Brands Directory"}
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {txt.guide}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Column */}
          <div>
            <h3 className="text-white font-semibold mb-4">{txt.support}</h3>
            <ul className="space-y-3">
              <li>
                <Link href="#" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {txt.help}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {txt.contact}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-slate-400 hover:text-white transition-colors text-sm">
                  {txt.faq}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} Influo Inc. {txt.rights}
            </p>
            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
                {txt.privacy}
              </Link>
              <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">
                {txt.terms}
              </Link>
              <Link href="/cookies" className="text-slate-400 hover:text-white transition-colors">
                {txt.cookies}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

