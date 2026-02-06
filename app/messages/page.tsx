"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import Messaging from '@/components/Messaging';
import { supabase } from '@/lib/supabaseClient';
import { getStoredLanguage } from '@/lib/language';
import { displayNameForLang } from '@/lib/greeklish';

function MessagesContent() {
  const searchParams = useSearchParams();
  const influencerId = searchParams?.get('influencer') || null;
  const brandEmail = searchParams?.get('brandEmail') || null;
  const brandName = searchParams?.get('brandName') || null;
  
  const [influencerData, setInfluencerData] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'el' | 'en'>('el');

  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  useEffect(() => {
    if (influencerId) {
      loadInfluencerData();
    } else {
      setLoading(false);
    }
  }, [influencerId]);

  const loadInfluencerData = async () => {
    try {
      const { data, error } = await supabase
        .from('influencers')
        .select('id, display_name, contact_email')
        .eq('id', influencerId)
        .single();

      if (error) throw error;
      
      setInfluencerData({
        id: data.id,
        name: data.display_name,
        email: data.contact_email,
      });
    } catch (error) {
      console.error('Error loading influencer:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!influencerId || !influencerData || !brandEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Messages</h1>
          <p className="text-slate-600 mb-6">
            Παρακαλώ δώστε influencer ID και brand email για να ξεκινήσετε τη συνομιλία.
          </p>
          <a href="/" className="text-blue-600 hover:underline">Πίσω στην αρχική</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <a href="/" className="text-blue-600 hover:underline mb-4 inline-block">← Πίσω στο Site</a>
          <h1 className="text-3xl font-bold text-slate-900">Μηνύματα με {displayNameForLang(influencerData.name, lang)}</h1>
        </div>
        <Messaging
          influencerId={influencerData.id}
          influencerName={displayNameForLang(influencerData.name, lang)}
          influencerEmail={influencerData.email}
          brandEmail={brandEmail}
          brandName={brandName ?? undefined}
          mode="brand"
          lang={lang}
        />
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading...</div>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  );
}

