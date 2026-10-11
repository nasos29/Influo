import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Η σελίδα δεν βρέθηκε | Influo" },
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-16">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold tracking-wide text-blue-600 mb-3">404</p>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Η σελίδα δεν βρέθηκε</h1>
        <p className="text-slate-600 mb-8">
          Η διεύθυνση δεν υπάρχει ή το προφίλ δεν είναι διαθέσιμο. Δοκίμασε τον κατάλογο influencers ή γύρνα στην αρχική.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="px-6 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800">
            Αρχική
          </Link>
          <Link href="/directory" className="px-6 py-3 rounded-xl bg-white text-slate-900 font-semibold border border-slate-200 hover:bg-slate-50">
            Κατάλογος influencers
          </Link>
        </div>
      </div>
    </main>
  );
}
