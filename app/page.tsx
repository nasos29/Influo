"use client";

import { useState } from "react";
import Image from "next/image";
import Directory from "../components/Directory";
import InfluencerSignupForm from "../components/InfluencerSignupForm";

export default function Home() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">I</div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Influo</h1>
          </div>
          <nav className="hidden md:block">
            <ul className="flex gap-8 text-sm font-medium text-slate-600">
              <li>
                <button onClick={() => setShowModal(true)} className="hover:text-blue-600 transition-colors">
                  Γίνε Influencer
                </button>
              </li>
              <li><a href="#directory" className="hover:text-blue-600 transition-colors">Directory</a></li>
              <li><a href="#features" className="hover:text-blue-600 transition-colors">Features</a></li>
            </ul>
          </nav>
          <button
            onClick={() => setShowModal(true)}
            className="md:hidden text-slate-900 font-bold"
          >
            MENU
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-30">
             <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
             <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
             <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider text-blue-800 uppercase bg-blue-100 rounded-full">
            New Platform
          </div>
          <h2 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-8 leading-tight tracking-tight">
            Σύνδεσε το ταλέντο σου <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              με κορυφαία Brands
            </span>
          </h2>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. 
            Δημιούργησε το επαγγελματικό σου προφίλ και κλείσε συνεργασίες σήμερα.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => setShowModal(true)}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-1"
            >
              Ξεκίνα Τώρα Δωρεάν
            </button>
            <a
              href="#directory"
              className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 rounded-xl shadow-sm transition-all"
            >
              Εξερεύνησε το Directory
            </a>
          </div>

          {/* Social Proof Images */}
          <div className="mt-16">
            <p className="text-sm text-slate-500 mb-4 font-medium">TRUSTED BY CREATORS</p>
            <div className="flex justify-center -space-x-4">
              <img className="w-12 h-12 rounded-full border-4 border-white object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="User" />
              <img className="w-12 h-12 rounded-full border-4 border-white object-cover" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80" alt="User" />
              <img className="w-12 h-12 rounded-full border-4 border-white object-cover" src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80" alt="User" />
              <img className="w-12 h-12 rounded-full border-4 border-white object-cover" src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80" alt="User" />
              <div className="w-12 h-12 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                +2k
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Directory Section */}
      <section className="py-24 px-6 bg-white" id="directory">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Κατάλογος Influencers</h3>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Ανακάλυψε τους πιο δημιουργικούς content creators ανά κατηγορία και πλατφόρμα.
            </p>
          </div>
          <Directory />
        </div>
      </section>

      {/* Features Section (Visual Improvement) */}
      <section className="py-24 px-6 bg-slate-50" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { title: "Analytics", desc: "Δες τα στατιστικά σου να μεγαλώνουν.", icon: "📈", color: "bg-blue-100 text-blue-600" },
              { title: "Συνεργασίες", desc: "Απευθείας επικοινωνία με brands.", icon: "🤝", color: "bg-purple-100 text-purple-600" },
              { title: "Πληρωμές", desc: "Ασφαλείς και γρήγορες πληρωμές.", icon: "💳", color: "bg-green-100 text-green-600" }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center text-2xl mb-6`}>
                  {feature.icon}
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h4>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} Influo Inc.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-slate-900">Privacy</a>
            <a href="#" className="hover:text-slate-900">Terms</a>
            <a href="#" className="hover:text-slate-900">Contact</a>
          </div>
        </div>
      </footer>

      {/* Modern Wide Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="relative w-full max-w-5xl animate-in fade-in zoom-in duration-300">
             <button
              onClick={() => setShowModal(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-200 font-bold text-lg flex items-center gap-2"
            >
              Κλείσιμο <span className="text-2xl">×</span>
            </button>
            <InfluencerSignupForm />
          </div>
        </div>
      )}
    </div>
  );
}


















