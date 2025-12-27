"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Messaging from '@/components/Messaging';
import { supabase } from '@/lib/supabaseClient';

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const influencerId = searchParams.get('influencer');
  const brandEmail = searchParams.get('brandEmail');
  const brandName = searchParams.get('brandName');
  
  const [influencerData, setInfluencerData] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

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
            Please provide influencer ID and brand email to start messaging.
          </p>
          <a href="/" className="text-blue-600 hover:underline">Go back home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <a href="/" className="text-blue-600 hover:underline mb-4 inline-block">← Back to Site</a>
          <h1 className="text-3xl font-bold text-slate-900">Messages with {influencerData.name}</h1>
        </div>
        <Messaging
          influencerId={influencerData.id}
          influencerName={influencerData.name}
          influencerEmail={influencerData.email}
          brandEmail={brandEmail}
          brandName={brandName || null}
          mode="brand"
        />
      </div>
    </div>
  );
}

