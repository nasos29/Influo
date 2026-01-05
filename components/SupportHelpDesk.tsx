"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

interface SentEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  sentAt: string;
}

const t = {
  el: {
    title: "Help Desk - Support",
    subtitle: "Αποστολή & Διαχείριση Emails",
    back: "← Πίσω στο Admin Dashboard",
    sendEmail: "Αποστολή Email",
    sentEmails: "Αποστολές",
    to: "Προς",
    subject: "Θέμα",
    message: "Μήνυμα",
    send: "Αποστολή",
    sending: "Αποστολή...",
    success: "✅ Email στάλθηκε επιτυχώς!",
    error: "❌ Σφάλμα:",
    placeholderTo: "recipient@example.com",
    placeholderSubject: "Θέμα του Email",
    placeholderMessage: "Γράψε το μήνυμα σου εδώ...",
    noEmails: "Δεν υπάρχουν αποστολές ακόμα.",
    sender: "Από: support@influo.gr",
    sentAt: "Στάλθηκε:",
    preview: "Προεπισκόπηση",
    htmlMode: "HTML Mode",
    textMode: "Text Mode",
  },
  en: {
    title: "Help Desk - Support",
    subtitle: "Send & Manage Emails",
    back: "← Back to Admin Dashboard",
    sendEmail: "Send Email",
    sentEmails: "Sent Emails",
    to: "To",
    subject: "Subject",
    message: "Message",
    send: "Send",
    sending: "Sending...",
    success: "✅ Email sent successfully!",
    error: "❌ Error:",
    placeholderTo: "recipient@example.com",
    placeholderSubject: "Email Subject",
    placeholderMessage: "Write your message here...",
    noEmails: "No sent emails yet.",
    sender: "From: support@influo.gr",
    sentAt: "Sent at:",
    preview: "Preview",
    htmlMode: "HTML Mode",
    textMode: "Text Mode",
  }
};

export default function SupportHelpDesk({ adminEmail }: { adminEmail: string }) {
  const lang = 'el';
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [htmlMode, setHtmlMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  // Load sent emails from localStorage (simple solution for now)
  useEffect(() => {
    loadSentEmails();
  }, []);

  const loadSentEmails = () => {
    try {
      const stored = localStorage.getItem('support_sent_emails');
      if (stored) {
        setSentEmails(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading sent emails:', error);
    }
  };

  const saveSentEmail = (email: SentEmail) => {
    try {
      const updated = [email, ...sentEmails].slice(0, 50); // Keep last 50
      setSentEmails(updated);
      localStorage.setItem('support_sent_emails', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving sent email:', error);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!toEmail || !subject || !message) {
      setResult({ type: 'error', message: 'Παρακαλώ συμπλήρωσε όλα τα πεδία' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      // Convert plain text to HTML if not in HTML mode
      const htmlContent = htmlMode 
        ? message 
        : `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
             <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0;">
               <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">📧 ${subject}</h1>
             </div>
             <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
               <div style="white-space: pre-wrap; font-size: 14px; color: #4b5563;">${message.replace(/\n/g, '<br>')}</div>
               <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                 <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo<br>support@influo.gr</p>
               </div>
             </div>
           </div>`;

      const response = await fetch('/api/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'custom_email',
          toEmail: toEmail,
          customSubject: subject,
          customHtml: htmlContent,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({ type: 'success', message: t[lang].success });
        
        // Save to history
        saveSentEmail({
          id: Date.now().toString(),
          to: toEmail,
          subject: subject,
          html: htmlContent,
          sentAt: new Date().toISOString(),
        });

        // Clear form
        setToEmail('');
        setSubject('');
        setMessage('');
      } else {
        setResult({ type: 'error', message: `${t[lang].error} ${data.error || 'Unknown error'}` });
      }
    } catch (error: any) {
      setResult({ type: 'error', message: `${t[lang].error} ${error.message}` });
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link 
                href="/admin" 
                className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
              >
                {t[lang].back}
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">{t[lang].title}</h1>
              <p className="text-sm text-gray-600 mt-1">{t[lang].subtitle}</p>
            </div>
            <div className="text-sm text-gray-500">
              {t[lang].sender}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Send Email Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">{t[lang].sendEmail}</h2>
              
              <form onSubmit={handleSend} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t[lang].to}
                  </label>
                  <input
                    type="email"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder={t[lang].placeholderTo}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t[lang].subject}
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t[lang].placeholderSubject}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {t[lang].message}
                    </label>
                    <button
                      type="button"
                      onClick={() => setHtmlMode(!htmlMode)}
                      className="text-xs text-purple-600 hover:text-purple-700"
                    >
                      {htmlMode ? t[lang].textMode : t[lang].htmlMode}
                    </button>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t[lang].placeholderMessage}
                    rows={12}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                    required
                  />
                  {htmlMode && (
                    <p className="text-xs text-gray-500 mt-1">
                      HTML mode: Μπορείς να γράψεις HTML code
                    </p>
                  )}
                </div>

                {result && (
                  <div
                    className={`p-4 rounded-lg ${
                      result.type === 'success'
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {result.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {sending ? t[lang].sending : t[lang].send}
                </button>
              </form>
            </div>
          </div>

          {/* Sent Emails Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{t[lang].sentEmails}</h2>
              
              {loadingEmails ? (
                <div className="text-center text-gray-500 py-8">Loading...</div>
              ) : sentEmails.length === 0 ? (
                <div className="text-center text-gray-500 py-8">{t[lang].noEmails}</div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {sentEmails.map((email) => (
                    <div
                      key={email.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        {email.subject}
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        {t[lang].to}: {email.to}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t[lang].sentAt} {formatDate(email.sentAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

