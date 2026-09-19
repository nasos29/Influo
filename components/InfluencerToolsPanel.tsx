"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type LinkInfo = {
  approved: boolean;
  slug: string | null;
  slugSupported: boolean;
  path: string;
  url: string;
  category: string;
  displayName: string;
};

function firstCategory(category: string): string {
  const part = (category || '').split(',')[0]?.trim();
  return part || 'Creator';
}

function bioText(info: LinkInfo): string {
  const cat = firstCategory(info.category);
  const host = info.url.replace(/^https?:\/\//, '');
  return `${cat} · συνεργασίες: ${host}`;
}

export default function InfluencerToolsPanel({
  approved,
  displayName,
}: {
  approved?: boolean;
  displayName: string;
}) {
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'link' | 'bio' | ''>('');
  const [slugDraft, setSlugDraft] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Συνδέσου ξανά.');
      const res = await fetch('/api/influencer/profile-link', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Αποτυχία φόρτωσης link');
      setInfo(data);
      setSlugDraft(data.slug || '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Σφάλμα');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copy = async (text: string, kind: 'link' | 'bio') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setError('Δεν έγινε αντιγραφή. Αντίγραψέ το χειροκίνητα.');
    }
  };

  const saveSlug = async () => {
    if (!slugDraft.trim()) return;
    setSavingSlug(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Συνδέσου ξανά.');
      const res = await fetch('/api/influencer/profile-link', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug: slugDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Δεν αποθηκεύτηκε το link');
      setInfo(data);
      setSlugDraft(data.slug || '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Σφάλμα');
    } finally {
      setSavingSlug(false);
    }
  };

  const downloadQr = async (url: string) => {
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(url)}`;
    try {
      const res = await fetch(qr);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'influo-qr.png';
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      window.open(qr, '_blank');
    }
  };

  if (!approved) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Εργαλεία</h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <p className="font-medium">Το προσωπικό σου link θα ενεργοποιηθεί μόλις εγκριθεί το προφίλ.</p>
          <p className="text-sm mt-2">Μόλις είσαι live, θα μπορείς να το βάλεις στο Instagram / TikTok bio.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <p className="text-slate-600">Φόρτωση εργαλείων…</p>;
  }

  if (!info) {
    return <p className="text-red-600">{error || 'Δεν φορτώθηκαν τα εργαλεία.'}</p>;
  }

  const text = bioText(info);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(info.url)}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Εργαλεία για τη δουλειά σου</h2>
        <p className="text-sm text-slate-600 mt-1">
          Βάλε το Influo link στο bio των social, ώστε τα brands να βλέπουν το προφίλ σου και να στέλνουν πρόταση.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Το προσωπικό σου link</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={info.url}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 text-sm"
            />
            <button
              type="button"
              onClick={() => copy(info.url, 'link')}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
            >
              {copied === 'link' ? 'Αντιγράφηκε' : 'Αντιγραφή'}
            </button>
            <Link
              href={info.path}
              target="_blank"
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 text-center"
            >
              Προεπισκόπηση
            </Link>
          </div>

          {info.slugSupported && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Σύντομο όνομα στο URL (λατινικά)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center border border-slate-300 rounded-lg overflow-hidden">
                  <span className="px-3 py-2 bg-slate-100 text-slate-500 text-sm whitespace-nowrap">influo.gr/in/</span>
                  <input
                    value={slugDraft}
                    onChange={(e) => setSlugDraft(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm text-slate-900 outline-none"
                    maxLength={40}
                  />
                </div>
                <button
                  type="button"
                  onClick={saveSlug}
                  disabled={savingSlug}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  {savingSlug ? '…' : 'Αποθήκευση'}
                </button>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Έτοιμο κείμενο για bio</h4>
            <p className="text-xs text-slate-500 mb-2">Αντιγράψ’ το στο Instagram ή TikTok μαζί με το link.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <textarea
                readOnly
                value={text}
                rows={2}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 text-sm resize-none"
              />
              <button
                type="button"
                onClick={() => copy(text, 'bio')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                {copied === 'bio' ? 'Αντιγράφηκε' : 'Αντιγραφή κειμένου'}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-5 text-center space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">QR code</h3>
          <img src={qrSrc} alt={`QR για ${displayName}`} className="w-44 h-44 mx-auto border border-slate-100 rounded-lg bg-white" />
          <p className="text-xs text-slate-500">Για story, media kit ή εκδήλωση.</p>
          <button
            type="button"
            onClick={() => downloadQr(info.url)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
          >
            Λήψη PNG
          </button>
        </div>
      </div>
    </div>
  );
}
