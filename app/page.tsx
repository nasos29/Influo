"use client";

import { useState } from "react";
import Image from "next/image";
import Directory from "../components/Directory";
import InfluencerSignupForm from "../components/InfluencerSignupForm";

export default function Home() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-md py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-6">
          <h1 className="text-2xl font-bold text-gray-900">Influo</h1>
          <nav>
            <ul className="flex gap-6 text-gray-700">
              <li>
                <button
                  onClick={() => setShowModal(true)}
                  className="hover:text-blue-600 transition-colors"
                >
                  Γίνε Influencer
                </button>
              </li>
              <li>
                <a href="#directory" className="hover:text-blue-600 transition-colors">
                  Directory
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-blue-600 transition-colors">
                  Επικοινωνία
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col justify-center items-center text-center px-6 py-24 bg-gradient-to-r from-purple-100 via-pink-100 to-yellow-50">
        <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
          Σύνδεσε τον εαυτό σου με τις καλύτερες επιχειρήσεις
        </h2>
        <p className="text-lg md:text-xl text-gray-700 max-w-2xl mb-10">
          Δημιούργησε το προφίλ σου ως influencer, πρόσθεσε τα social accounts σου, βίντεο και κατηγορίες.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded shadow-lg transition-colors"
        >
          Ξεκίνα Τώρα
        </button>

        {/* Hero images */}
        <div className="mt-16 flex flex-wrap justify-center gap-6">
          <Image src="/hero1.jpg" alt="Happy influencer" width={150} height={150} className="rounded-full shadow-lg" />
          <Image src="/hero2.jpg" alt="Creative influencer" width={150} height={150} className="rounded-full shadow-lg" />
          <Image src="/hero3.jpg" alt="Social media influencer" width={150} height={150} className="rounded-full shadow-lg" />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto text-center mb-12">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">Γιατί να γίνεις μέλος;</h3>
          <p className="text-gray-700 max-w-3xl mx-auto">
            Σύνδεση με κορυφαίες εταιρείες, προφίλ με βίντεο και social accounts, εύκολη διαχείριση συνεργασιών.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          <div className="p-6 bg-gradient-to-tr from-purple-100 to-pink-100 rounded-xl shadow-lg">
            <h4 className="text-xl font-bold mb-2 text-gray-900">Αύξησε το Audience σου</h4>
            <p className="text-gray-700">Πρόσθεσε τα social accounts σου και εμφάνιση σε κορυφαίες επιχειρήσεις.</p>
          </div>
          <div className="p-6 bg-gradient-to-tr from-yellow-100 to-orange-100 rounded-xl shadow-lg">
            <h4 className="text-xl font-bold mb-2 text-gray-900">Δημιούργησε Brand συνεργασίες</h4>
            <p className="text-gray-700">Συνδέσου με εταιρείες που ταιριάζουν στο προφίλ σου και στις κατηγορίες σου.</p>
          </div>
          <div className="p-6 bg-gradient-to-tr from-green-100 to-teal-100 rounded-xl shadow-lg">
            <h4 className="text-xl font-bold mb-2 text-gray-900">Ασφαλής πλατφόρμα</h4>
            <p className="text-gray-700">Όλα τα προφίλ εγκρίνονται πριν εμφανιστούν, εξασφαλίζοντας αξιοπιστία.</p>
          </div>
        </div>
      </section>

      {/* Directory Section */}
      <section className="py-20 px-6 bg-gray-50" id="directory">
        <div className="max-w-7xl mx-auto text-center mb-10">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">Κατάλογος Influencers</h3>
          <p className="text-gray-700 max-w-3xl mx-auto">
            Δες τα εγκεκριμένα προφίλ, φιλτράρισμα ανά πλατφόρμα και κατηγορία.
          </p>
        </div>
        <Directory />
      </section>

      {/* Footer */}
      <footer className="bg-white shadow-inner py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-600">
          © {new Date().getFullYear()} Inflо. All rights reserved.
        </div>
      </footer>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start pt-20 z-50 overflow-auto">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-3 text-gray-600 hover:text-gray-900 font-bold text-xl"
            >
              Χ
            </button>
            <InfluencerSignupForm />
          </div>
        </div>
      )}
    </div>
  );
}


















