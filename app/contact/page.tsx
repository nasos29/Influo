// app/contact/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredLanguage, setStoredLanguage } from '@/lib/language';

export default function ContactPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [lang, setLang] = useState<"el" | "en">(pathname?.startsWith("/en") ? "en" : getStoredLanguage());

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const content = {
    el: {
      title: "Επικοινωνία",
      subtitle: "Επικοινωνήστε μαζί μας",
      description: "Έχετε ερωτήσεις, προτάσεις ή ανάγκες υποστήριξης; Στείλτε μας μήνυμα και θα σας απαντήσουμε το συντομότερο δυνατό.",
      
      form_name: "Όνομα",
      form_email: "Email",
      form_subject: "Θέμα",
      form_message: "Μήνυμα",
      form_submit: "Αποστολή",
      form_success: "Το μήνυμά σας στάλθηκε επιτυχώς! Θα σας απαντήσουμε το συντομότερο δυνατό.",
      
      info_title: "Πληροφορίες Επικοινωνίας",
      info_response: "Χρόνος Απάντησης:",
      info_response_value: "48-72 ώρες",
      info_hours: "Ώρες Λειτουργίας:",
      info_hours_value: "Δευτέρα - Παρασκευή, 9:00 - 18:00 (EET)",
      
      back: "← Επιστροφή στην Αρχική",
    },
    en: {
      title: "Contact",
      subtitle: "Get in Touch",
      description: "Have questions, suggestions, or need support? Send us a message and we'll get back to you as soon as possible.",
      
      form_name: "Name",
      form_email: "Email",
      form_subject: "Subject",
      form_message: "Message",
      form_submit: "Send",
      form_success: "Your message has been sent successfully! We'll get back to you as soon as possible.",
      
      info_title: "Contact Information",
      info_response: "Response Time:",
      info_response_value: "48-72 hours",
      info_hours: "Business Hours:",
      info_hours_value: "Monday - Friday, 9:00 AM - 6:00 PM (EET)",
      
      back: "← Back to Home",
    }
  };

  const txt = content[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitted(true);
        setFormData({ name: '', email: '', subject: '', message: '' });
        // Reset success message after 5 seconds
        setTimeout(() => setSubmitted(false), 5000);
      } else {
        alert(lang === 'el' 
          ? `Σφάλμα: ${result.error || 'Αποτυχία αποστολής μηνύματος'}` 
          : `Error: ${result.error || 'Failed to send message'}`);
      }
    } catch (error) {
      console.error('Error submitting contact form:', error);
      alert(lang === 'el' 
        ? 'Σφάλμα: Αποτυχία αποστολής μηνύματος. Παρακαλώ δοκιμάστε ξανά.' 
        : 'Error: Failed to send message. Please try again.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href={lang === "en" ? "/en" : "/"} className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-2">
            {txt.back}
          </Link>
          <button 
            onClick={() => {
              const newLang = lang === "el" ? "en" : "el";
              setLang(newLang);
              setStoredLanguage(newLang);
              if (newLang === "en") router.push("/en/contact");
              else router.push("/contact");
            }} 
            className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
            aria-label="Toggle language"
          >
            {lang === "el" ? "EN" : "EL"}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">{txt.title}</h1>
        <p className="text-xl text-slate-600 mb-8">{txt.subtitle}</p>
        <p className="text-slate-700 mb-12 leading-relaxed">{txt.description}</p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Form */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">{lang === "el" ? "Στείλτε Μήνυμα" : "Send Message"}</h2>
            
            {submitted && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                {txt.form_success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-2">
                  {txt.form_name}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                  {txt.form_email}
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-semibold text-slate-700 mb-2">
                  {txt.form_subject}
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-slate-700 mb-2">
                  {txt.form_message}
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {txt.form_submit}
              </button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">{txt.info_title}</h2>
              <div className="space-y-4 text-slate-700">
                <div>
                  <p className="font-semibold mb-1">{txt.info_response}</p>
                  <p>{txt.info_response_value}</p>
                </div>
                <div>
                  <p className="font-semibold mb-1">{txt.info_hours}</p>
                  <p>{txt.info_hours_value}</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <Link href={lang === "en" ? "/en" : "/"} className="text-blue-600 hover:text-blue-700 font-medium">
            {txt.back}
          </Link>
        </div>
      </main>
    </div>
  );
}

