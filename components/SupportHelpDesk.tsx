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

interface Ticket {
  id: string;
  user_id: string;
  user_type: 'influencer' | 'brand';
  user_email: string;
  user_name: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  admin_replied_at: string | null;
  created_at: string;
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
    tickets: "Tickets",
    sendEmail: "Αποστολή Email",
    noTickets: "Δεν υπάρχουν tickets.",
    from: "Από",
    status: "Κατάσταση",
    reply: "Απάντηση",
    replyPlaceholder: "Γράψε την απάντησή σου...",
    sendReply: "Αποστολή Απάντησης",
    sendingReply: "Αποστολή...",
    replySuccess: "✅ Η απάντηση στάλθηκε!",
    open: "Ανοιχτό",
    resolved: "Επιλυμένο",
    viewTicket: "Προβολή Ticket",
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
  const [activeTab, setActiveTab] = useState<'email' | 'tickets'>('tickets');
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [htmlMode, setHtmlMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Load sent emails from localStorage (simple solution for now)
  useEffect(() => {
    loadSentEmails();
    if (activeTab === 'tickets') {
      loadTickets();
    }
  }, [activeTab]);

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

  const loadTickets = async () => {
    try {
      setLoadingTickets(true);
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error: any) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleReply = async (ticketId: string) => {
    if (!replyText.trim()) {
      alert('Παρακαλώ γράψε μια απάντηση');
      return;
    }

    setSendingReply(true);
    try {
      const response = await fetch('/api/tickets/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_id: ticketId,
          admin_reply: replyText,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(t[lang].replySuccess);
        setReplyText('');
        setSelectedTicket(null);
        await loadTickets();
      } else {
        alert(`${t[lang].error} ${data.error}`);
      }
    } catch (error: any) {
      alert(`${t[lang].error} ${error.message}`);
    } finally {
      setSendingReply(false);
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

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      open: t[lang].open,
      in_progress: t[lang].in_progress,
      resolved: t[lang].resolved,
      closed: t[lang].closed,
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      open: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
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
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'tickets'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t[lang].tickets} {tickets.filter(t => t.status === 'open').length > 0 && `(${tickets.filter(t => t.status === 'open').length})`}
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'email'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t[lang].sendEmail}
            </button>
          </div>
        </div>

        {activeTab === 'tickets' ? (
          /* Tickets View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">{t[lang].tickets}</h2>
                
                {loadingTickets ? (
                  <div className="text-center text-gray-500 py-8">Loading...</div>
                ) : tickets.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">{t[lang].noTickets}</div>
                ) : (
                  <div className="space-y-4">
                    {tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-gray-900">{ticket.subject}</h3>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(ticket.status)}`}>
                                {getStatusLabel(ticket.status)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {t[lang].from}: {ticket.user_name} ({ticket.user_email})
                            </p>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{ticket.message}</p>
                            <div className="text-xs text-gray-500">
                              {formatDate(ticket.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ticket Detail Sidebar */}
            {selectedTicket && (
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{selectedTicket.subject}</h3>
                    <button
                      onClick={() => setSelectedTicket(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                        {getStatusLabel(selectedTicket.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>{t[lang].from}:</strong> {selectedTicket.user_name} ({selectedTicket.user_email})
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      {formatDate(selectedTicket.created_at)}
                    </p>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Μήνυμα:</h4>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedTicket.message}
                    </div>
                  </div>

                  {selectedTicket.admin_reply ? (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Η Απάντησή σας:</h4>
                      <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                        {selectedTicket.admin_reply}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {formatDate(selectedTicket.admin_replied_at!)}
                      </p>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">{t[lang].reply}:</h4>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={t[lang].replyPlaceholder}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                      />
                      <button
                        onClick={() => handleReply(selectedTicket.id)}
                        disabled={sendingReply || !replyText.trim()}
                        className="mt-2 w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {sendingReply ? t[lang].sendingReply : t[lang].sendReply}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Email Form */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
        )}
      </div>
    </div>
  );
}

