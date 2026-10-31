"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import Messaging from '@/components/Messaging';
import { supabase } from '@/lib/supabaseClient';
import { getStoredLanguage } from '@/lib/language';
import { displayNameForLang } from '@/lib/greeklish';
import { loadOwnBrand } from '@/lib/ownProfile';
import { useOwnPresenceHeartbeat } from '@/lib/useOwnPresenceHeartbeat';

function MessagesContent() {
  const searchParams = useSearchParams();
  const influencerId = searchParams?.get('influencer') || null;
  const conversationId = searchParams?.get('conversation');

  const [influencerData, setInfluencerData] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [brandEmail, setBrandEmail] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'el' | 'en'>('el');
  const copy = {
    el: {
      title: "Μηνύματα",
      signIn: "Συνδεθείτε ως επιχείρηση για να δείτε τις συνομιλίες σας.",
      login: "Σύνδεση",
      back: "← Πίνακας ελέγχου",
      withName: (name: string) => `Μηνύματα με ${name}`,
    },
    en: {
      title: "Messages",
      signIn: "Sign in as a brand to see your conversations.",
      login: "Sign in",
      back: "← Dashboard",
      withName: (name: string) => `Messages with ${name}`,
    },
  }[lang];

  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const brand = await loadOwnBrand(supabase);
        if (!brand.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const email = typeof brand.profile.contact_email === 'string' ? brand.profile.contact_email : '';
        const name = typeof brand.profile.brand_name === 'string' ? brand.profile.brand_name : '';
        if (!cancelled) {
          setBrandEmail(email);
          setBrandName(name);
        }
        if (influencerId) {
          const { data, error } = await supabase
            .from('influencers')
            .select('id, display_name')
            .eq('id', influencerId)
            .single();
          if (!error && data && !cancelled) {
            setInfluencerData({ id: data.id, name: data.display_name });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [influencerId]);

  useOwnPresenceHeartbeat(brandEmail ? { kind: 'brand', brandEmail } : null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!brandEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">{copy.title}</h1>
          <p className="text-slate-600 mb-6">
            {copy.signIn}
          </p>
          <a href="/login?redirect=/brand/dashboard" className="text-blue-600 hover:underline">{copy.login}</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <a href="/brand/dashboard?tab=messages" className="text-blue-600 hover:underline mb-4 inline-block">{copy.back}</a>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {influencerData ? copy.withName(displayNameForLang(influencerData.name, lang)) : copy.title}
          </h1>
        </div>
        <Messaging
          influencerId={influencerData?.id}
          influencerName={influencerData ? displayNameForLang(influencerData.name, lang) : undefined}
          brandEmail={brandEmail}
          brandName={brandName ?? undefined}
          initialConversationId={conversationId}
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
