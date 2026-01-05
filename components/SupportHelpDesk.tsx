"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

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

interface User {
  id: string;
  email: string;
  name: string;
}

const t = {
  el: {
    title: "Help Desk - Support",
    subtitle: "Διαχείριση Support Tickets",
    back: "← Πίσω στο Admin Dashboard",
    tickets: "Tickets",
    noTickets: "Δεν υπάρχουν tickets.",
    from: "Από",
    status: "Κατάσταση",
    reply: "Απάντηση",
    replyPlaceholder: "Γράψε την απάντησή σου...",
    sendReply: "Αποστολή Απάντησης",
    sendingReply: "Αποστολή...",
    replySuccess: "✅ Η απάντηση στάλθηκε!",
    error: "❌ Σφάλμα:",
    open: "Ανοιχτό",
    in_progress: "Σε Εξέλιξη",
    resolved: "Επιλυμένο",
    closed: "Κλειστό",
    viewTicket: "Προβολή Ticket",
    createTicket: "Δημιουργία Νέου Ticket",
    createTicketFor: "Δημιουργία Ticket για",
    selectUser: "Επιλογή Χρήστη",
    selectUserType: "Επιλογή Τύπου",
    influencer: "Influencer",
    brand: "Brand",
    subject: "Θέμα",
    message: "Μήνυμα",
    create: "Δημιουργία",
    creating: "Δημιουργία...",
    createSuccess: "✅ Το ticket δημιουργήθηκε! Email στάλθηκε στον χρήστη.",
    placeholderSubject: "Π.χ. Ενημέρωση για τον λογαριασμό σας",
    placeholderMessage: "Γράψτε το μήνυμα που θέλετε να στείλετε...",
  },
  en: {
    title: "Help Desk - Support",
    subtitle: "Manage Support Tickets",
    back: "← Back to Admin Dashboard",
    tickets: "Tickets",
    noTickets: "No tickets yet.",
    from: "From",
    status: "Status",
    reply: "Reply",
    replyPlaceholder: "Write your reply...",
    sendReply: "Send Reply",
    sendingReply: "Sending...",
    replySuccess: "✅ Reply sent!",
    error: "❌ Error:",
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
    viewTicket: "View Ticket",
    createTicket: "Create New Ticket",
    createTicketFor: "Create Ticket for",
    selectUser: "Select User",
    selectUserType: "Select Type",
    influencer: "Influencer",
    brand: "Brand",
    subject: "Subject",
    message: "Message",
    create: "Create",
    creating: "Creating...",
    createSuccess: "✅ Ticket created! Email sent to user.",
    placeholderSubject: "E.g. Update about your account",
    placeholderMessage: "Write the message you want to send...",
  }
};

export default function SupportHelpDesk({ adminEmail }: { adminEmail: string }) {
  const lang = 'el';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [createUserType, setCreateUserType] = useState<'influencer' | 'brand'>('influencer');
  const [createUserId, setCreateUserId] = useState('');
  const [createSubject, setCreateSubject] = useState('');
  const [createMessage, setCreateMessage] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [influencers, setInfluencers] = useState<User[]>([]);
  const [brands, setBrands] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Load tickets on mount
  useEffect(() => {
    loadTickets();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      // Load influencers
      const { data: infData, error: infError } = await supabase
        .from('influencers')
        .select('id, contact_email, display_name')
        .order('display_name', { ascending: true });

      if (!infError && infData) {
        setInfluencers(infData.map((inf: any) => ({
          id: inf.id,
          email: inf.contact_email,
          name: inf.display_name || inf.contact_email,
        })));
      }

      // Load brands via API
      try {
        const brandsResponse = await fetch('/api/admin/brands');
        const brandsResult = await brandsResponse.json();
        if (brandsResult.success && brandsResult.brands) {
          setBrands(brandsResult.brands.map((b: any) => ({
            id: b.id || b.contact_email,
            email: b.contact_email,
            name: b.brand_name || b.contact_email,
          })));
        }
      } catch (err) {
        console.error('Error loading brands:', err);
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
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

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createUserId || !createSubject || !createMessage) {
      alert('Παρακαλώ συμπληρώστε όλα τα πεδία');
      return;
    }

    setCreatingTicket(true);
    try {
      const selectedUser = createUserType === 'influencer' 
        ? influencers.find(u => u.id === createUserId)
        : brands.find(u => u.id === createUserId);

      if (!selectedUser) {
        alert('Παρακαλώ επιλέξτε χρήστη');
        return;
      }

      const response = await fetch('/api/tickets/admin-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: createUserId,
          user_type: createUserType,
          user_email: selectedUser.email,
          user_name: selectedUser.name,
          subject: createSubject,
          message: createMessage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(t[lang].createSuccess);
        setCreateSubject('');
        setCreateMessage('');
        setCreateUserId('');
        setShowCreateTicket(false);
        await loadTickets();
      } else {
        alert(`${t[lang].error} ${data.error}`);
      }
    } catch (error: any) {
      alert(`${t[lang].error} ${error.message}`);
    } finally {
      setCreatingTicket(false);
    }
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
                className="text-sm text-gray-800 hover:text-gray-900 mb-2 inline-block"
              >
                {t[lang].back}
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">{t[lang].title}</h1>
              <p className="text-sm text-gray-800 mt-1">{t[lang].subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tickets View */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {t[lang].tickets} {tickets.filter(t => t.status === 'open').length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-sm font-bold rounded-full px-2 py-1">
                {tickets.filter(t => t.status === 'open').length}
              </span>
            )}
          </h2>
          <button
            onClick={() => setShowCreateTicket(!showCreateTicket)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            {showCreateTicket ? '✕' : '+ ' + t[lang].createTicket}
          </button>
        </div>

        {/* Create Ticket Form */}
        {showCreateTicket && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">{t[lang].createTicket}</h2>
            
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  {t[lang].selectUserType}
                </label>
                <select
                  value={createUserType}
                  onChange={(e) => {
                    setCreateUserType(e.target.value as 'influencer' | 'brand');
                    setCreateUserId('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                >
                  <option value="influencer">{t[lang].influencer}</option>
                  <option value="brand">{t[lang].brand}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  {t[lang].selectUser}
                </label>
                {loadingUsers ? (
                  <div className="text-gray-700">Loading...</div>
                ) : (
                  <select
                    value={createUserId}
                    onChange={(e) => setCreateUserId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                    required
                  >
                    <option value="">-- Επιλογή {createUserType === 'influencer' ? 'Influencer' : 'Brand'} --</option>
                    {(createUserType === 'influencer' ? influencers : brands).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  {t[lang].subject}
                </label>
                <input
                  type="text"
                  value={createSubject}
                  onChange={(e) => setCreateSubject(e.target.value)}
                  placeholder={t[lang].placeholderSubject}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  {t[lang].message}
                </label>
                <textarea
                  value={createMessage}
                  onChange={(e) => setCreateMessage(e.target.value)}
                  placeholder={t[lang].placeholderMessage}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creatingTicket}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {creatingTicket ? t[lang].creating : t[lang].create}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateTicket(false);
                    setCreateSubject('');
                    setCreateMessage('');
                    setCreateUserId('');
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Ακύρωση
                </button>
              </div>
            </form>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">{t[lang].tickets}</h2>
                
                {loadingTickets ? (
                  <div className="text-center text-gray-700 py-8">Loading...</div>
                ) : tickets.length === 0 ? (
                  <div className="text-center text-gray-700 py-8">{t[lang].noTickets}</div>
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
                            <p className="text-sm text-gray-800 mb-2">
                              {t[lang].from}: {ticket.user_name} ({ticket.user_email})
                            </p>
                            <p className="text-sm text-gray-800 mb-2 line-clamp-2">{ticket.message}</p>
                            <div className="text-xs text-gray-700">
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
                    <p className="text-sm text-gray-800 mb-2">
                      <strong>{t[lang].from}:</strong> {selectedTicket.user_name} ({selectedTicket.user_email})
                    </p>
                    <p className="text-sm text-gray-700 mb-4">
                      {formatDate(selectedTicket.created_at)}
                    </p>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Μήνυμα:</h4>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-900 whitespace-pre-wrap">
                      {selectedTicket.message}
                    </div>
                  </div>

                  {selectedTicket.admin_reply ? (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Η Απάντησή σας:</h4>
                      <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-sm text-gray-900 whitespace-pre-wrap">
                        {selectedTicket.admin_reply}
                      </div>
                      <p className="text-xs text-gray-700 mt-2">
                        {formatDate(selectedTicket.admin_replied_at!)}
                      </p>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">{t[lang].reply}:</h4>
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
      </div>
    </div>
  );
}

