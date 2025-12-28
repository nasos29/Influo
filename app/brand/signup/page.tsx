"use client";

import BrandSignupForm from '@/components/BrandSignupForm';
import Image from 'next/image';

export default function BrandSignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <a href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">I</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">Influo</span>
          </a>
        </div>
        <BrandSignupForm />
      </div>
    </div>
  );
}

