"use client";

import { useEffect, useRef, useState } from 'react';
import { isTimeoutError, withTimeout } from '@/lib/withTimeout';
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

function bioText(info: LinkInfo, lang: 'el' | 'en'): string {
  const cat = firstCategory(info.category);
  const host = info.url.replace(/^https?:\/\//, '');
  return lang === 'en' ? `${cat} · collaborations: ${host}` : `${cat} · συνεργασίες: ${host}`;
}

export default function InfluencerToolsPanel({
  approved,
  displayName,
  lang = 'el',
}: {
  approved?: boolean;
  displayName: string;
  lang?: 'el' | 'en';
}) {
  const uiCopy = lang === 'en'
    ? {
        title: 'Tools',
        pendingTitle: 'Your personal link will turn on once your profile is approved.',
        pendingBody: 'When you are live, you can put it in your Instagram or TikTok bio.',
        loading: 'Loading tools…',
        failed: 'Tools could not be loaded.',
        timeout: 'This took too long. Try again.',
        retry: 'Try again',
        signIn: 'Sign in again.',
        loadFailed: 'Could not load the link',
        copyFailed: 'Copy failed. Copy it manually.',
        slugFailed: 'The link was not saved',
        generic: 'Something went wrong',
        heading: 'Tools for your work',
        intro: 'Put your Influo link in your social bio so brands can see your profile and send a proposal.',
        linkTitle: 'Your personal link',
        copied: 'Copied',
        copy: 'Copy',
        preview: 'Preview',
        slugLabel: 'Short name in the URL (Latin characters)',
        slugHint: 'If you change it, the old link still opens your profile.',
        save: 'Save',
        bioTitle: 'Ready-made bio text',
        bioHint: 'Paste it on Instagram or TikTok together with the link.',
        copyText: 'Copy text',
        qr: 'QR code',
        qrAlt: `QR for ${displayName}`,
        qrHint: 'For a story, media kit, or event.',
        download: 'Download PNG',
        kitTitle: 'Media kit PDF',
        kitBody: 'One page with your photo, bio, social accounts, minimum rate, and Influo link. Open it and choose Save as PDF.',
        kitOpen: 'Open media kit',
      }
    : {
        title: 'Εργαλεία',
        pendingTitle: 'Το προσωπικό σου link θα ενεργοποιηθεί μόλις εγκριθεί το προφίλ.',
        pendingBody: 'Μόλις δημοσιευτεί, μπορείς να το βάλεις στην περιγραφή του Instagram ή του TikTok.',
        loading: 'Φόρτωση εργαλείων…',
        failed: 'Τα εργαλεία δεν φορτώθηκαν.',
        timeout: 'Η φόρτωση άργησε. Δοκίμασε ξανά.',
        retry: 'Δοκίμασε ξανά',
        signIn: 'Συνδέσου ξανά.',
        loadFailed: 'Αποτυχία φόρτωσης link',
        copyFailed: 'Δεν έγινε αντιγραφή. Αντίγραψέ το χειροκίνητα.',
        slugFailed: 'Δεν αποθηκεύτηκε το link',
        generic: 'Κάτι πήγε στραβά',
        heading: 'Εργαλεία για τη δουλειά σου',
        intro: 'Βάλε το link του Influo στην περιγραφή των κοινωνικών δικτύων, ώστε οι επιχειρήσεις να βλέπουν το προφίλ σου και να στέλνουν πρόταση.',
        linkTitle: 'Το προσωπικό σου link',
        copied: 'Αντιγράφηκε',
        copy: 'Αντιγραφή',
        preview: 'Προεπισκόπηση',
        slugLabel: 'Σύντομο όνομα στο URL (λατινικά)',
        slugHint: 'Αν το αλλάξεις, το παλιό link συνεχίζει να ανοίγει το προφίλ σου.',
        save: 'Αποθήκευση',
        bioTitle: 'Έτοιμο κείμενο για την περιγραφή',
        bioHint: 'Αντιγράψ’ το στο Instagram ή στο TikTok μαζί με το link.',
        copyText: 'Αντιγραφή κειμένου',
        qr: 'Κωδικός QR',
        qrAlt: `QR για ${displayName}`,
        qrHint: 'Για ιστορία, παρουσίαση ή εκδήλωση.',
        download: 'Λήψη PNG',
        kitTitle: 'PDF παρουσίασης',
        kitBody: 'Μία σελίδα με φωτογραφία, βιογραφικό, κοινωνικά δίκτυα, την ελάχιστη τιμή και το link του Influo. Άνοιξέ την και πάτα «Αποθήκευση ως PDF».',
        kitOpen: 'Άνοιγμα παρουσίασης',
      };
  const langRef = useRef(lang);
  langRef.current = lang;
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
      if (!session?.access_token) throw new Error(langRef.current === 'en' ? 'Sign in again.' : 'Συνδέσου ξανά.');
      const res = await withTimeout(fetch('/api/influencer/profile-link', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }), 20000);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (langRef.current === 'en' ? 'Could not load the link' : 'Αποτυχία φόρτωσης link'));
      setInfo(data);
      setSlugDraft(data.slug || '');
    } catch (e: unknown) {
      const fallback = isTimeoutError(e)
        ? langRef.current === 'en'
          ? 'This took too long. Try again.'
          : 'Η φόρτωση άργησε. Δοκίμασε ξανά.'
        : e instanceof Error
          ? e.message
          : langRef.current === 'en'
            ? 'Something went wrong'
            : 'Κάτι πήγε στραβά';
      setError(fallback);
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
      setError(langRef.current === 'en' ? 'Copy failed. Copy it manually.' : 'Δεν έγινε αντιγραφή. Αντίγραψέ το χειροκίνητα.');
    }
  };

  const saveSlug = async () => {
    if (!slugDraft.trim()) return;
    setSavingSlug(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error(langRef.current === 'en' ? 'Sign in again.' : 'Συνδέσου ξανά.');
      const res = await withTimeout(fetch('/api/influencer/profile-link', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug: slugDraft }),
      }), 20000);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (langRef.current === 'en' ? 'The link was not saved' : 'Δεν αποθηκεύτηκε το link'));
      setInfo(data);
      setSlugDraft(data.slug || '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (langRef.current === 'en' ? 'Something went wrong' : 'Κάτι πήγε στραβά'));
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
        <h2 className="text-xl font-semibold text-slate-900">{uiCopy.title}</h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <p className="font-medium">{uiCopy.pendingTitle}</p>
          <p className="text-sm mt-2">{uiCopy.pendingBody}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-48 rounded bg-slate-200 animate-pulse" />
        <div className="h-40 rounded-xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-slate-600">{error || uiCopy.failed}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 inline-flex min-h-11 items-center justify-center px-5 rounded-xl bg-slate-900 text-white text-sm font-medium"
        >
          {uiCopy.retry}
        </button>
      </div>
    );
  }

  const text = bioText(info, lang);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(info.url)}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{uiCopy.heading}</h2>
        <p className="text-sm text-slate-600 mt-1">
          {uiCopy.intro}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{uiCopy.linkTitle}</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={info.url}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 text-sm"
            />
            <button
              type="button"
              onClick={() => copy(info.url, 'link')}
              className="inline-flex min-h-11 items-center justify-center px-4 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
            >
              {copied === 'link' ? uiCopy.copied : uiCopy.copy}
            </button>
            <Link
              href={info.path}
              target="_blank"
              className="inline-flex min-h-11 items-center justify-center px-4 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 text-center"
            >
              {uiCopy.preview}
            </Link>
          </div>

          {info.slugSupported && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {uiCopy.slugLabel}
              </label>
              <p className="text-xs text-slate-500 mb-1">
                {uiCopy.slugHint}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center border border-slate-300 rounded-lg overflow-hidden">
                  <span className="px-3 py-2 bg-slate-100 text-slate-500 text-sm whitespace-nowrap">www.influo.gr/in/</span>
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
                  className="inline-flex min-h-11 items-center justify-center px-4 border border-slate-300 bg-white rounded-lg text-sm font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                >
                  {savingSlug ? '…' : uiCopy.save}
                </button>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">{uiCopy.bioTitle}</h4>
            <p className="text-xs text-slate-500 mb-2">{uiCopy.bioHint}</p>
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
                className="inline-flex min-h-11 items-center justify-center px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                {copied === 'bio' ? uiCopy.copied : uiCopy.copyText}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-5 text-center space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{uiCopy.qr}</h3>
          <img src={qrSrc} alt={uiCopy.qrAlt} className="w-44 h-44 mx-auto border border-slate-100 rounded-lg bg-white" />
          <p className="text-xs text-slate-500">{uiCopy.qrHint}</p>
          <button
            type="button"
            onClick={() => downloadQr(info.url)}
            className="w-full inline-flex min-h-11 items-center justify-center px-4 border border-slate-300 bg-white rounded-lg text-sm font-bold text-slate-900 hover:bg-slate-50"
          >
            {uiCopy.download}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{uiCopy.kitTitle}</h3>
          <p className="text-sm text-slate-600 mt-1">
            {uiCopy.kitBody}
          </p>
        </div>
        <Link
          href="/dashboard/media-kit"
          className="inline-flex min-h-11 items-center justify-center px-4 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 whitespace-nowrap text-center"
        >
          {uiCopy.kitOpen}
        </Link>
      </div>
    </div>
  );
}
